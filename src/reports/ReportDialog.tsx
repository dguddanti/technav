import { watchPhotoCoverage } from '../services/photoCoverage';
import type { PhotoCoverage } from '../services/photoCoverage';
import { PhotoAttachment } from './PhotoAttachment';
import { Select } from '../components/ui/Select';
import { places, placeFloor } from '../locations';
import { useEffect, useRef, useState } from 'react';
import { FLOORS, floorName, floorOf, nodes } from '../building';
import { photoStations } from '../data/photoStations';
import type { Floor } from '../building';
import type { Point } from '../route';
import type { ReportContext, ReportDraft, ReportKind } from '../types/reports';
import { Button } from '../components/ui/Button';
import { Combobox } from '../components/ui/Combobox';
import { Message } from '../components/ui/Message';
import { MapPicker } from './MapPicker';
import { validatePhoto, validateReport } from './validation';
import { addAdminPhoto } from '../services/admin';
import { submitReport } from '../services/reports';
import './reports.css';

interface ReportDialogProps { context: ReportContext; adminPhoto?: boolean; onClose: () => void }
const kinds: { id: ReportKind; label: string; detail: string }[] = [
  { id: 'map', label: 'Route or map issue', detail: 'Wrong directions, a blocked path, or an incorrect label' },
  { id: 'entrance', label: 'Correct an entrance', detail: 'Mark the actual door and its connecting hallway' },
  { id: 'photo', label: 'Add a location photo', detail: 'Share a hallway view from a marked photo spot' },
];


export const ReportDialog = ({ context, adminPhoto = false, onClose }: ReportDialogProps) => {
  const dialog = useRef<HTMLDialogElement>(null);
  const initialKind = adminPhoto ? 'photo' : context.kind;
  const initialStation = photoStations.find((station) => station.id === context.photoStationId && station.floor === context.floor);
  const [draft, setDraft] = useState<ReportDraft>({ kind: initialKind ?? 'map', category: 'wrong_route', floor: context.floor, point: initialStation?.point ?? (initialKind === 'photo' ? null : context.point ?? null), placeName: '', hallwayNodeId: null, photoStationId: initialStation?.id ?? null, mapHeading: initialStation ? context.mapHeading ?? null : null, description: '', photo: null, context });
  const [selectedKind, setSelectedKind] = useState<ReportKind | null>(initialKind ?? null);
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [mapTarget, setMapTarget] = useState<'door' | 'hallway'>('door');
  const [mapReset, setMapReset] = useState(0);
  const [coverageState, setCoverageState] = useState<{ floor: Floor; coverage: PhotoCoverage; failed: boolean } | null>(null);
  const [coverageRetry, setCoverageRetry] = useState(0);
  const [editPhotoLocation, setEditPhotoLocation] = useState(false);
  const quickPhoto = context.kind === 'photo' && !!initialStation && selectedKind === 'photo' && !editPhotoLocation;
  const selectedStation = photoStations.find((station) => station.id === draft.photoStationId);
  useEffect(() => {
    if (selectedKind !== 'photo') return;
    return watchPhotoCoverage(draft.floor,
      (coverage) => setCoverageState({ floor: draft.floor, coverage, failed: false }),
      () => setCoverageState({ floor: draft.floor, coverage: {}, failed: true }));
  }, [draft.floor, selectedKind, coverageRetry]);
  const coverageReady = coverageState?.floor === draft.floor && !coverageState.failed;
  const coverage = coverageReady ? coverageState.coverage : {};
  const captured = draft.photoStationId ? coverage[draft.photoStationId] ?? [] : [];
  const duplicatePhoto = draft.kind === 'photo' && draft.mapHeading !== null && captured.includes(draft.mapHeading);
  const completeSpot = captured.length === 4;
  const photoBlocked = draft.kind === 'photo' && (!coverageReady || duplicatePhoto || completeSpot);

  useEffect(() => {
    const node = dialog.current!;
    const opener = document.activeElement;
    if (typeof node.showModal === 'function') node.showModal(); else node.setAttribute('open', '');
    return () => { if (typeof node.close === 'function') node.close(); if (opener instanceof HTMLElement) opener.focus(); };
  }, []);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);
  const update = (patch: Partial<ReportDraft>) => { setDraft((d) => ({ ...d, ...patch })); setError(''); };
  const setKind = (kind: ReportKind) => {
    update({ kind, point: kind === 'map' && draft.floor === context.floor ? context.point ?? null : null, placeName: '', hallwayNodeId: null, photoStationId: null, mapHeading: null });
    setMapTarget('door');
  };
  const setFloor = (floor: Floor) => {
    update({ floor, point: null, placeName: '', hallwayNodeId: null, photoStationId: null, mapHeading: null });
    setMapTarget('door');
  };
  const floorNodes = Object.keys(nodes).filter((id) => floorOf[id] === draft.floor);
  const stations = photoStations.filter((spot) => spot.floor === draft.floor);
  const listedRoom = Object.hasOwn(places, draft.placeName) && placeFloor[draft.placeName] === draft.floor;
  const original = listedRoom ? places[draft.placeName][1] : undefined;
  const selectRoom = (value: string) => {
    const match = Object.keys(places).find((name) => name.toLowerCase() === value.trim().toLowerCase() && placeFloor[name] === draft.floor);
    update({ placeName: match ?? value, hallwayNodeId: match ? places[match][0] : null, point: null });
    if (match) setMapReset((v) => v + 1);
  };
  const pick = (point: Point) => {
    if (draft.kind === 'photo') {
      const nearest = [...stations].sort((a, b) => Math.hypot(a.point[0] - point[0], a.point[1] - point[1]) - Math.hypot(b.point[0] - point[0], b.point[1] - point[1]))[0];
      if (nearest) update({ point: nearest.point, photoStationId: nearest.id });
    } else if (draft.kind === 'entrance' && mapTarget === 'hallway') {
      const nearest = [...floorNodes].sort((a, b) => Math.hypot(nodes[a][0] - point[0], nodes[a][1] - point[1]) - Math.hypot(nodes[b][0] - point[0], nodes[b][1] - point[1]))[0];
      if (nearest) update({ hallwayNodeId: nearest });
    } else update({ point });
  };
  const headingLabel = draft.kind === 'entrance' ? (mapTarget === 'door' ? 'Tap the actual doorway' : 'Tap the hallway outside the door') : draft.kind === 'photo' ? 'Select where you took the photo' : 'Mark the problem on the map';
  const center = original ?? (draft.floor === context.floor ? context.point : undefined);

  return (
    <dialog ref={dialog} className="report-dialog" data-quick-photo={quickPhoto} aria-labelledby="report-title" onCancel={(event) => { event.preventDefault(); if (!sending) onClose(); }}>
      <div className="report-shell">
        <header className="report-header"><h2 id="report-title">{sent ? (adminPhoto ? 'Photo published' : 'Report submitted') : selectedKind ? kinds.find((k) => k.id === selectedKind)!.label : 'Report an issue'}</h2><button type="button" className="report-close" aria-label="Close report" disabled={sending} onClick={onClose}>×</button></header>
        {sent ? <><div className="report-confirmation"><svg viewBox="0 0 48 48" aria-hidden="true"><path d="m12 24 8 8 16-19" /></svg><h3>{adminPhoto ? 'Photo published.' : 'Ready for review.'}</h3><p>{adminPhoto ? 'This photo is now part of the location photo collection.' : 'Map changes and photos are checked before they are published.'}</p></div><footer className="report-actions"><Button variant="primary" onClick={onClose}>Done</Button></footer></> : !selectedKind ? <div className="report-type-chooser"><p>What would you like to report?</p>{kinds.map((kind, index) => <button key={kind.id} type="button" onClick={() => { setKind(kind.id); setSelectedKind(kind.id); }}><span className="report-type-symbol" aria-hidden="true">{['↗', '⌖', '▧'][index]}</span><span><strong>{kind.label}</strong><small>{kind.detail}</small></span><span aria-hidden="true">›</span></button>)}</div> : (
          <form className="report-form" onSubmit={async (event) => {
            event.preventDefault();
            if (photoBlocked) { setError('Choose a direction without an existing photo.'); return; }
            const validation = validateReport(draft);
            if (validation) { setError(validation); return; }
            setSending(true); setError('');
            try { if (adminPhoto) await addAdminPhoto(draft); else await submitReport(draft); setSent(true); }
            catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not send your report. Please try again.'); }
            finally { setSending(false); }
          }}>
            <fieldset className={`report-body ${quickPhoto ? 'report-body--quick' : ''}`} disabled={sending}>
              <legend className="sr-only">Report details</legend>
              {!adminPhoto && !quickPhoto && <button type="button" className="report-change-type" onClick={() => setSelectedKind(null)}>← Change report type</button>}
              {!quickPhoto && context.from && context.to && <p className="report-context">{context.from} → {context.to}{context.stepIndex !== undefined && ` · Step ${context.stepIndex + 1}`}</p>}
              {draft.kind === 'map' && <Select label="What is wrong?" value={draft.category} options={[{ value: 'wrong_route', label: 'Incorrect directions' }, { value: 'blocked_path', label: 'Blocked or inaccessible path' }, { value: 'incorrect_label', label: 'Wrong location or room label' }, { value: 'other', label: 'Something else' }]} onChange={(category) => update({ category: category as ReportDraft['category'] })} />}
              {quickPhoto ? <section className="quick-photo-context" aria-label="Selected photo view"><div><span>{floorName(draft.floor)} · Step {(context.stepIndex ?? 0) + 1}</span><strong>{selectedStation?.label}</strong><p>{({0:'↑ Facing up on map',90:'→ Facing right on map',180:'↓ Facing down on map',270:'← Facing left on map'})[draft.mapHeading ?? 0]}</p></div><button type="button" onClick={() => setEditPhotoLocation(true)}>Change</button></section> : <>
              <div className="report-label"><span>Floor</span><div className="report-floors" role="group" aria-label="Floor">{FLOORS.map((f) => <button type="button" key={f.id} aria-label={f.name} aria-pressed={draft.floor === f.id} onClick={() => setFloor(f.id)}>{f.id}</button>)}</div></div>
              {draft.kind === 'entrance' && <Combobox id="report-room" label="Room or location" value={draft.placeName} options={Object.keys(places).filter((name) => placeFloor[name] === draft.floor)} placeholder="Search this floor" onChange={selectRoom} />}
              <section className="report-location" aria-labelledby="report-location-title">
                <div className="report-map-heading"><h3 id="report-location-title">{headingLabel}</h3><span>{floorName(draft.floor)}</span></div>
                {draft.kind === 'entrance' && <div className="report-map-target" role="group" aria-label="Entrance marker"><button type="button" aria-pressed={mapTarget === 'door'} onClick={() => setMapTarget('door')}>Door</button><button type="button" aria-pressed={mapTarget === 'hallway'} onClick={() => setMapTarget('hallway')}>Connected hallway</button></div>}
                <MapPicker key={`${draft.kind}-${draft.floor}-${mapReset}`} floor={draft.floor} point={draft.point} center={mapReset && draft.point ? draft.point : center} original={draft.kind === 'entrance' ? original : undefined}
                  capturedHeadings={coverage} unavailableHeadings={captured} spots={draft.kind === 'photo' ? stations : undefined} hallwayPoints={draft.kind === 'entrance' && mapTarget === 'hallway' ? floorNodes.map((id) => nodes[id]) : undefined}
                  connection={draft.kind === 'entrance' && draft.hallwayNodeId ? nodes[draft.hallwayNodeId] : undefined} heading={draft.kind === 'photo' ? draft.mapHeading : null} onHeadingChange={draft.kind === 'photo' ? (mapHeading) => update({ mapHeading }) : undefined} onPick={pick} />
                <p className="report-help">{draft.kind === 'entrance' ? 'Purple: proposed door. Blue: connected hallway. Outline: current mapped door.' : draft.kind === 'photo' ? 'Purple: views still needed. Green: all four directions photographed.' : 'Tap to place the pin. Drag to pan; use + to zoom in.'}</p>
                {draft.kind === 'photo' && <Select label="Photo spot" searchable placeholder="Choose a spot on the map" value={draft.photoStationId ?? ''} options={stations.map((spot, index) => ({ value: spot.id, label: `${spot.label} · spot ${index + 1}` })).filter((option) => (coverage[option.value]?.length ?? 0) < 4)} onChange={(id) => { const spot = stations.find((s) => s.id === id); if (spot) { update({ point: spot.point, photoStationId: spot.id }); setMapReset((v) => v + 1); } }} />}
              </section>
              {context.kind === 'photo' && initialStation && selectedKind === 'photo' && <button type="button" className="quick-photo-done" disabled={!draft.photoStationId || draft.mapHeading === null} onClick={() => setEditPhotoLocation(false)}>Use this view</button>}
              </>}


              {!quickPhoto && <label className="report-label" htmlFor="report-description">{draft.kind === 'map' ? 'Describe the issue' : 'Details (optional)'}<textarea id="report-description" value={draft.description} maxLength={1500} rows={3} placeholder={draft.kind === 'entrance' ? 'What should we know about this entrance?' : draft.kind === 'photo' ? 'Any useful landmarks or context?' : 'What happened, and what should be different?'} onChange={(e) => update({ description: e.target.value })} /></label>}
              {draft.kind === 'photo' && (!quickPhoto || !coverageReady || duplicatePhoto || completeSpot) && <div className="report-coverage-status" aria-live="polite">{!coverageReady ? coverageState?.floor === draft.floor && coverageState.failed ? <><p>Could not check existing photos. Try again before adding a photo.</p><button type="button" onClick={() => { setCoverageState(null); setCoverageRetry((value) => value + 1); }}>Retry</button></> : <p>Checking existing photos…</p> : completeSpot ? <p>All four directions already have photos. Choose another spot.</p> : duplicatePhoto ? <p>This direction already has a photo. Choose another direction or spot.</p> : captured.length > 0 ? <p>{captured.length} of 4 directions already photographed. Checked directions cannot be added again.</p> : <p>Choose a spot and a direction that still needs a photo.</p>}</div>}
              <fieldset className="report-photo-fieldset" disabled={photoBlocked}><PhotoAttachment required={draft.kind === 'photo'} file={draft.photo} preview={preview} onFile={(file) => {
                const invalid = validatePhoto(file); if (invalid) { setError(invalid); return; }
                setPreview(URL.createObjectURL(file)); update({ photo: file });
              }} onRemove={() => { setPreview(null); update({ photo: null }); }} /></fieldset>
              {quickPhoto && <details className="quick-photo-note"><summary>Add a note (optional)</summary><label className="report-label" htmlFor="quick-photo-note">Details<textarea id="quick-photo-note" value={draft.description} maxLength={1500} rows={2} onChange={(event) => update({ description: event.target.value })} /></label></details>}
            </fieldset>
            <footer className="report-actions">{error && <Message role="alert" tone="error">{error}</Message>}<p className="report-help">{adminPhoto ? 'Administrator photos are published immediately.' : quickPhoto ? 'Photos are reviewed before publishing.' : `Submitted privately for review${context.from ? ', including this route and step' : ''}.`}</p><Button type="submit" variant="primary" disabled={sending || photoBlocked}>{sending ? 'Sending…' : adminPhoto ? 'Publish photo' : 'Submit report'}</Button></footer>
          </form>
        )}
      </div>
    </dialog>
  );
};
