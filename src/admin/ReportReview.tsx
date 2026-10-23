import { useEffect, useState } from 'react';
import type { SubmittedReport } from '../services/admin';
import { readReportPhoto, reviewReport } from '../services/admin';
import { floorName } from '../building';
import { MapPicker } from '../reports/MapPicker';
import { EntranceEditor } from './EntranceEditor';
import { Button } from '../components/ui/Button';

export const ReportReview = ({ report, onReviewed }: { report: SubmittedReport; onReviewed: () => void }) => {
  const [photo, setPhoto] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState('');
  const [error, setError] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!report.photo) return;
    let stopped = false; let url: string | null = null;
    void readReportPhoto(report.photo.path).then((value) => { url = value; if (stopped) URL.revokeObjectURL(value); else setPhoto(value); })
      .catch(() => { if (!stopped) setPhotoError('Photo could not be loaded. Reopen this report to retry.'); });
    return () => { stopped = true; if (url) URL.revokeObjectURL(url); };
  }, [report.photo]);
  const review = async (status: 'approved' | 'rejected') => {
    setBusy(true); setError('');
    try { await reviewReport(report.id, status, note); onReviewed(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not complete this review.'); }
    finally { setBusy(false); }
  };
  return <article className="admin-review"><div className="admin-detail-heading"><p className="admin-eyebrow">{floorName(report.floor)} · {report.status}</p><h2>{report.kind === 'entrance' ? report.placeName : report.kind === 'photo' ? 'Location photo' : 'Route or map issue'}</h2></div>
    {report.context.from && <p className="admin-route">{report.context.from} → {report.context.to}<br />{report.context.stepText}</p>}
    {report.description && <p className="admin-description">{report.description}</p>}
    {report.kind === 'map' && <p className="admin-eyebrow">{report.category?.replaceAll('_', ' ')}</p>}
    {report.kind === 'entrance' && report.status === 'pending' ? <EntranceEditor reportId={report.id} original={report.originalEntrance ? [report.originalEntrance.x, report.originalEntrance.y] : undefined} initial={{ name: report.placeName!, floor: report.floor, x: report.x, y: report.y, hallwayNodeId: report.hallwayNodeId!, mapVersion: 'tech-v1' }} onSaved={onReviewed} /> : <MapPicker floor={report.floor} point={[report.x, report.y]} center={[report.x, report.y]} heading={report.mapHeading} onPick={() => {}} readOnly />}
    {report.kind === 'photo' && <p className="report-help">Camera facing {({ 0: 'up', 90: 'right', 180: 'down', 270: 'left' })[report.mapHeading ?? 0]} on the map · {report.photoStationId}</p>}
    {photo && <img className="admin-evidence" src={photo} alt="Photo submitted with this report" />}
    {report.photo && !photo && !photoError && <p role="status">Loading photo…</p>}
    {photoError && <p role="alert" className="admin-error">{photoError}</p>}
    {report.status === 'pending' && <div className="admin-review-actions"><label className="report-label">{report.kind === 'entrance' ? 'Rejection reason (optional)' : 'Review note (optional)'}<textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={1500} rows={2} disabled={busy} /></label>
      {report.kind === 'map' && <p className="report-help">Mark resolved after you have addressed the issue. This action records the review; it does not change hallway geometry.</p>}
      {error && <p role="alert" className="admin-error">{error}</p>}
      <div className="admin-action-row">{report.kind !== 'entrance' && <Button variant="primary" disabled={busy || (report.kind === 'photo' && !photo)} onClick={() => void review('approved')}>{busy ? 'Saving…' : report.kind === 'photo' ? 'Approve & publish photo' : 'Mark resolved'}</Button>}<Button variant="secondary" disabled={busy} onClick={() => void review('rejected')}>Reject report</Button></div>
    </div>}
  </article>;
};
