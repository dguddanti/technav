import { Select } from '../components/ui/Select';
import { useState } from 'react';
import { FLOORS, floorOf, nodes } from '../building';
import type { Floor } from '../building';
import type { Point } from '../route';
import { places, placeFloor, validEntrance } from '../locations';
import type { PublishedEntrance } from '../locations';
import { MapPicker } from '../reports/MapPicker';
import { Combobox } from '../components/ui/Combobox';
import { Button } from '../components/ui/Button';
import { saveEntrance } from '../services/admin';

interface EntranceEditorProps { initial?: PublishedEntrance; reportId?: string; original?: Point; onSaved: () => void }
export const EntranceEditor = ({ initial, reportId, original, onSaved }: EntranceEditorProps) => {
  const [entry, setEntry] = useState<PublishedEntrance>(initial ?? { name: '', floor: '1', x: -1, y: -1, hallwayNodeId: '', mapVersion: 'tech-v1' });
  const [target, setTarget] = useState<'door' | 'hallway'>('door');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [reset, setReset] = useState(0);
  const floorNodes = Object.keys(nodes).filter((id) => floorOf[id] === entry.floor);
  const point: Point | null = entry.x < 0 ? null : [entry.x, entry.y];
  const pick = (selected: Point) => {
    if (target === 'door') setEntry({ ...entry, x: selected[0], y: selected[1] });
    else {
      const nearest = floorNodes.reduce((best, id) => Math.hypot(nodes[id][0] - selected[0], nodes[id][1] - selected[1]) < Math.hypot(nodes[best][0] - selected[0], nodes[best][1] - selected[1]) ? id : best, floorNodes[0]);
      setEntry({ ...entry, hallwayNodeId: nearest });
    }
    setError('');
  };
  return <form className="admin-editor" onSubmit={async (event) => {
    event.preventDefault(); setBusy(true); setError('');
    try { await saveEntrance(entry, reportId, note); onSaved(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not save this entrance.'); }
    finally { setBusy(false); }
  }}><fieldset disabled={busy}>
    {!reportId && <><Select label="Floor" value={entry.floor} options={FLOORS.map((floor) => ({ value: floor.id, label: floor.name }))} onChange={(floor) => { setEntry({ ...entry, floor: floor as Floor, x: -1, y: -1, hallwayNodeId: '', name: '' }); setReset(reset + 1); }} />
    <Combobox id="admin-location" label="Location name" placeholder="Search or enter a new location" options={Object.keys(places).filter((name) => placeFloor[name] === entry.floor)} value={entry.name} onChange={(name) => {
      const existing = Object.hasOwn(places, name) && placeFloor[name] === entry.floor ? places[name] : null;
      setEntry(existing ? { ...entry, name, x: existing[1][0], y: existing[1][1], hallwayNodeId: existing[0] } : { ...entry, name });
      if (existing) setReset(reset + 1);
    }} /></>}
    <div className="report-map-target" role="group" aria-label="Edit marker"><button type="button" aria-pressed={target === 'door'} onClick={() => setTarget('door')}>1. Door location</button><button type="button" aria-pressed={target === 'hallway'} onClick={() => setTarget('hallway')}>2. Connected hallway</button></div>
    <p className="report-help">{target === 'door' ? 'Tap the doorway. Drag to move around the floor plan.' : 'Tap the hallway the door opens onto. Blue dots are connected route points.'}</p>
    <MapPicker key={`${entry.floor}-${reset}`} floor={entry.floor} point={point} original={original} center={point ?? undefined} connection={nodes[entry.hallwayNodeId]} hallwayPoints={target === 'hallway' ? floorNodes.map((id) => nodes[id]) : undefined} onPick={pick} />
    <div className="admin-checks"><span data-complete={!!point}>{point ? '✓' : '○'} Door selected</span><span data-complete={!!entry.hallwayNodeId}>{entry.hallwayNodeId ? '✓' : '○'} Hallway connected</span></div>
    <label className="report-label">Review note (optional)<textarea value={note} maxLength={1500} rows={2} onChange={(e) => setNote(e.target.value)} /></label>
    {error && <p role="alert" className="admin-error">{error}</p>}
    <Button type="submit" variant="primary" disabled={busy || !validEntrance(entry)}>{busy ? 'Saving…' : reportId ? 'Approve & publish entrance' : 'Save entrance'}</Button>
    <p className="report-help">Published entrances update location search and route endpoints immediately. Existing room data is replaced when the name matches.</p>
  </fieldset></form>;
};
