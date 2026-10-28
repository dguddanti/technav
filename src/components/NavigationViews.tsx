import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent, PointerEvent, RefObject } from 'react';
import type { Step } from '../route';
import type { MapHeading, ReportContext } from '../types/reports';
import { watchLocationPhotos, loadLocationPhoto } from '../services/locationPhotos';
import type { LocationPhoto } from '../services/locationPhotos';
import { headingForVector, photoPositionsForStep } from './photoPositions';
import { NavigationMap } from './NavigationMap';
import { FloorTransition } from './FloorTransition';
import './NavigationViews.css';

type ViewMode = 'map' | 'split' | 'photo';
type Ratio = 25 | 35 | 50 | 65 | 75;
interface NavigationViewsProps { steps: Step[]; index: number; from: string; to: string; onAddPhoto: (context: ReportContext) => void }
export const NavigationViews = (props: NavigationViewsProps) => {
  const floor = props.steps[props.index].floor;
  const [catalog, setCatalog] = useState<{ floor: string; photos: LocationPhoto[]; error: boolean } | null>(null);
  const [preference, setPreference] = useState<ViewMode | null>(null);
  const [ratio, setRatio] = useState<Ratio>(50);
  const [retry, setRetry] = useState(0);
  // Bounded, per-navigation cache: rotating/stepping back avoids repeated downloads.
  const blobs = useRef(new Map<string, Blob>());
  useEffect(() => watchLocationPhotos(floor, (photos) => setCatalog({ floor, photos, error: false }), () => setCatalog({ floor, photos: [], error: true })), [floor, retry]);
  const step = props.steps[props.index];
  // Keyed by step so the ride replays when you come back to it.
  if (step.via) return <section className="navigation-views" aria-label="Route views"><FloorTransition key={props.index} steps={props.steps} index={props.index} /></section>;
  return <StepScene {...props} photos={catalog?.floor === floor ? catalog.photos : []} loading={catalog?.floor !== floor} error={catalog?.floor === floor && catalog.error} retry={() => { setCatalog(null); setRetry((value) => value + 1); }} preference={preference} setPreference={setPreference} ratio={ratio} setRatio={setRatio} blobs={blobs} />;
};
interface SceneProps extends NavigationViewsProps { photos: LocationPhoto[]; loading: boolean; error: boolean; retry: () => void; preference: ViewMode | null; setPreference: (mode: ViewMode) => void; ratio: Ratio; setRatio: (ratio: Ratio) => void; blobs: RefObject<Map<string, Blob>> }
const StepScene = ({ steps, index, from, to, onAddPhoto, photos, loading, error, retry, preference, setPreference, ratio, setRatio, blobs }: SceneProps) => {
  const step = steps[index];
  const positions = photoPositionsForStep(step);
  const [selection, setSelection] = useState<{ step: Step; positionIndex: number; facing: MapHeading | null }>({ step, positionIndex: 0, facing: null });
  const positionIndex = selection.step === step ? selection.positionIndex : 0;
  const position = positions[positionIndex];
  const facing = selection.step === step ? selection.facing : null;
  const heading = facing ?? position?.heading ?? headingForVector(step.pts[0], step.pts.at(-1)!);
  const photo = position ? photos.find((entry) => entry.photoStationId === position.station.id && entry.mapHeading === heading) : undefined;
  const [media, setMedia] = useState<{ path: string; url: string | null; failed: boolean } | null>(null);
  const [imageRetry, setImageRetry] = useState(0);
  const [paneHeight, setPaneHeight] = useState(0);
  const desiredMode = preference ?? (photo ? 'split' : 'map');
  const compact = paneHeight > 0 && paneHeight < 190;
  const mode = desiredMode === 'split' && compact ? 'photo' : desiredMode;
  const panes = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const node = panes.current;
    if (!node || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => {
      const height = node.getBoundingClientRect().height;
      setPaneHeight(height);
      const allowed = ([25, 35, 50, 65, 75] as const).filter((value) => height * value / 100 >= 70 && height * (100 - value) / 100 >= 92);
      if (allowed.length && !allowed.includes(ratio)) setRatio(allowed.reduce((best, value) => Math.abs(value - ratio) < Math.abs(best - ratio) ? value : best));
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [ratio, setRatio]);
  const photoPath = photo?.path;
  useEffect(() => {
    if (!photoPath || mode === 'map') return;
    let cancelled = false; let url: string | null = null;
    const cache = blobs.current;
    const load = async () => {
      try {
        const blob = cache.get(photoPath) ?? await loadLocationPhoto(photoPath);
        if (cancelled) return;
        cache.delete(photoPath); cache.set(photoPath, blob);
        if (cache.size > 8) cache.delete(cache.keys().next().value!);
        url = URL.createObjectURL(blob); setMedia({ path: photoPath, url, failed: false });
      } catch { if (!cancelled) setMedia({ path: photoPath, url: null, failed: true }); }
    };
    void load();
    return () => { cancelled = true; if (url) URL.revokeObjectURL(url); };
  }, [photoPath, mode, blobs, imageRetry]);
  const shownMedia = mode !== 'map' && media?.path === photo?.path ? media : null;
  const addPhoto = () => onAddPhoto({ floor: step.floor, point: position?.station.point ?? step.pts[0], photoStationId: position?.station.id, mapHeading: position ? heading : undefined, kind: 'photo', from, to, stepIndex: index, stepText: step.text });
  const movePosition = (direction: number) => { setPreference(mode); setSelection({ step, positionIndex: Math.max(0, Math.min(positions.length - 1, positionIndex + direction)), facing: null }); };
  const resize = (clientY: number) => {
    const box = panes.current?.getBoundingClientRect(); if (!box?.height) return;
    const percent = (clientY - box.top) / box.height * 100;
    const allowed = ([25, 35, 50, 65, 75] as const).filter((value) => box.height * value / 100 >= 70 && box.height * (100 - value) / 100 >= 92);
    const nearest = (allowed.length ? allowed : [50] as const).reduce((best, value) => Math.abs(value - percent) < Math.abs(best - percent) ? value : best, ratio);
    setRatio(nearest);
  };
  const resizeKey = (event: KeyboardEvent<HTMLButtonElement>) => {
    const allowed: Ratio[] = [25, 35, 50, 65, 75];
    const height = panes.current?.getBoundingClientRect().height ?? 0;
    const values = height ? allowed.filter((value) => height * value / 100 >= 70 && height * (100 - value) / 100 >= 92) : allowed;
    if (!values.length) return;
    const current = values.indexOf(ratio);
    if (['ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) { event.preventDefault(); setRatio(values[event.key === 'Home' ? 0 : event.key === 'End' ? values.length - 1 : Math.max(0, Math.min(values.length - 1, current + (event.key === 'ArrowUp' ? -1 : 1)))]); }
  };
  const drag = (event: PointerEvent<HTMLButtonElement>) => { if (event.currentTarget.hasPointerCapture(event.pointerId)) resize(event.clientY); };
  return <section className="navigation-views" aria-label="Route views">
    <div className="view-mode" role="group" aria-label="Navigation view">{(['map', 'split', 'photo'] as const).map((value) => <button type="button" key={value} aria-pressed={mode === value} disabled={value === 'split' && compact} title={value === 'split' && compact ? 'More height is needed for both views' : undefined} onClick={() => { if (mode !== value) setMedia(null); setPreference(value); }}>{value === 'split' ? 'Both' : value === 'map' ? 'Map' : 'Photo'}</button>)}</div>
    <div ref={panes} className="view-panes" data-mode={mode} data-ratio={ratio}>
      <div className="view-map" hidden={mode === 'photo'}><NavigationMap steps={steps} index={index} from={from} to={to} photoPoint={position?.station.point} photoHeading={heading} />
        {mode === 'map' && <div className="photo-quick-action"><span>{loading ? 'Checking photos…' : error ? 'Photos unavailable' : photo ? 'Photo available' : 'No photo for this view'}</span>{loading ? null : error ? <button type="button" onClick={retry}>Retry</button> : photo ? <button type="button" onClick={() => { setMedia(null); setPreference('photo'); }}>View photo</button> : <button type="button" onClick={addPhoto}>Add photo</button>}</div>}
      </div>
      <div className="view-divider" hidden={mode !== 'split'}><button type="button" role="separator" aria-label="Resize map and photo" aria-orientation="horizontal" aria-valuemin={25} aria-valuemax={75} aria-valuenow={ratio} aria-valuetext={`${ratio}% map, ${100 - ratio}% photo`} onKeyDown={resizeKey} onDoubleClick={() => setRatio(50)} onPointerDown={(event) => { event.currentTarget.setPointerCapture(event.pointerId); resize(event.clientY); }} onPointerMove={drag} onPointerUp={(event) => { if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); }}><span /></button></div>
      <section className="view-photo" aria-label="Location photo" hidden={mode === 'map'}>{mode !== 'map' && <>
        <div className="photo-stage">
          {photo && shownMedia?.url && !shownMedia.failed && <span className="photo-view-label">{position.station.label} · {({0:'↑ map up',90:'→ map right',180:'↓ map down',270:'← map left'})[heading]}</span>}
          {photo ? shownMedia?.failed ? <div className="photo-empty"><p>Photo could not load</p><button type="button" onClick={() => { setMedia(null); setImageRetry((value) => value + 1); }}>Retry photo</button></div> : shownMedia?.url ? <img key={photo.path} src={shownMedia.url} alt={`${position.station.label}, facing ${({ 0: 'up', 90: 'right', 180: 'down', 270: 'left' })[heading]} on the floor plan`} onError={() => { blobs.current.delete(photo.path); setMedia({ path: photo.path, url: null, failed: true }); }} /> : <div className="photo-empty" role="status"><p>Loading photo…</p></div>
            : <div className="photo-empty"><p>{!loading && !error && position && <span className="photo-empty-location">{position.station.label}</span>}{loading ? 'Checking photos…' : error ? 'Photos unavailable' : 'No photo for this view'}</p>{!loading && (error ? <button type="button" onClick={retry}>Retry</button> : <button type="button" onClick={addPhoto}>Add photo</button>)}</div>}
        </div>
        <div className="photo-view-controls"><div className="photo-facing" role="group" aria-label="Photo facing direction">{([{ value: 0, label: 'Up', arrow: '↑' }, { value: 90, label: 'Right', arrow: '→' }, { value: 180, label: 'Down', arrow: '↓' }, { value: 270, label: 'Left', arrow: '←' }] as const).map((direction) => <button key={direction.value} type="button" aria-label={`Look ${direction.label.toLowerCase()} on map`} aria-pressed={heading === direction.value} onClick={() => { setPreference(mode); setSelection({ step, positionIndex, facing: direction.value }); }}><span aria-hidden="true">{direction.arrow}</span>{position && photos.some((entry) => entry.photoStationId === position.station.id && entry.mapHeading === direction.value) && <i aria-label="photo available" />}</button>)}</div>
          {positions.length > 1 && <div className="photo-positions" role="group" aria-label="Photo position"><button type="button" aria-label="Previous photo position" disabled={positionIndex === 0} onClick={() => movePosition(-1)}>‹</button><span aria-live="polite">{positionIndex + 1}/{positions.length}</span><button type="button" aria-label="Next photo position" disabled={positionIndex === positions.length - 1} onClick={() => movePosition(1)}>›</button></div>}
        </div>
      </>} </section>
    </div>
  </section>;
};
