import { Select } from '../components/ui/Select';
import { useEffect, useState } from 'react';
import { watchAdminIdentity, signInAdmin, signOutAdmin, watchReports, addAdministrator } from '../services/admin';
import type { AdminIdentity, SubmittedReport } from '../services/admin';
import { Button } from '../components/ui/Button';
import { EntranceEditor } from './EntranceEditor';
import { ReportReview } from './ReportReview';
import { ReportDialog } from '../reports/ReportDialog';
import { floorName } from '../building';
import type { ReportKind } from '../types/reports';
import './admin.css';
import '../reports/reports.css';
import '../App.css';

export const AdminApp = () => {
  const [identity, setIdentity] = useState<AdminIdentity | null>(null);
  const [checking, setChecking] = useState(true);
  const [signingIn, setSigningIn] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => watchAdminIdentity((value) => { setIdentity(value); setChecking(false); }, () => { setError('Could not verify access. Check your connection and reload.'); setChecking(false); }), []);
  if (!identity?.allowed) return <main className="admin-login"><a className="admin-brand" href="/">TechNav</a><p className="admin-eyebrow">Administration</p><h1>Manage the map.</h1><p>Review reports, correct entrances, and add location photos.</p>{checking ? <p role="status">Checking access…</p> : identity ? <><p role="alert">Access has not been granted to {identity.email}.</p><Button onClick={() => { void signOutAdmin().catch(() => setError('Could not sign out. Try again.')); }}>Use another account</Button></> : <Button variant="primary" disabled={signingIn} onClick={async () => {
    setSigningIn(true); setError('');
    try { await signInAdmin(); } catch { setError('Could not sign in. Allow the Google sign-in window and try again.'); } finally { setSigningIn(false); }
  }}>{signingIn ? 'Signing in…' : 'Continue with Google'}</Button>}{error && <p role="alert" className="admin-error">{error}</p>}<a href="/" className="admin-return">Back to directions</a></main>;
  return <AdminWorkspace email={identity.email} />;
};

const AdminWorkspace = ({ email }: { email: string }) => {
  const [reports, setReports] = useState<SubmittedReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const [status, setStatus] = useState<'pending' | 'approved' | 'rejected'>('pending');
  const [kind, setKind] = useState<ReportKind | 'all'>('all');
  const [mode, setMode] = useState<'reports' | 'entrance' | 'team'>('reports');
  const [photo, setPhoto] = useState(false);
  const [notice, setNotice] = useState('');
  const [member, setMember] = useState('');
  const [addingMember, setAddingMember] = useState(false);
  useEffect(() => watchReports((values) => { setReports(values); setLoading(false); setError(''); }, () => { setError('Reports could not be loaded. Reload to try again.'); setLoading(false); }), []);
  const filtered = reports.filter((r) => r.status === status && (kind === 'all' || r.kind === kind));
  const active = filtered.find((r) => r.id === selected);
  const reviewed = () => { setNotice('Review saved.'); setSelected(null); };
  return <main className="admin-workspace"><header className="admin-topbar"><a className="admin-brand" href="/">TechNav <span>Admin</span></a><div><span className="admin-account">{email}</span><button type="button" onClick={() => void signOutAdmin().catch(() => setError('Could not sign out. Try again.'))}>Sign out</button></div></header>
    <div className="admin-page-heading"><div><p className="admin-eyebrow">Map contributions</p><h1>{mode === 'entrance' ? 'Add or edit an entrance' : mode === 'team' ? 'Administrator access' : 'Reports'}</h1></div><div className="admin-top-actions"><Button onClick={() => { setMode('reports'); setSelected(null); }}>Reports</Button><Button onClick={() => { setMode('team'); setNotice(''); }}>Access</Button><Button onClick={() => setPhoto(true)}>Add photo</Button><Button variant="primary" onClick={() => { setMode('entrance'); setNotice(''); }}>Add entrance</Button></div></div>
    {notice && <p role="status" className="admin-notice">{notice}</p>}{error && <p role="alert" className="admin-error">{error}</p>}
    {mode === 'entrance' ? <section className="admin-direct"><EntranceEditor onSaved={() => { setNotice('Entrance saved. Location search and routes now use this entrance.'); setMode('reports'); }} /></section> : mode === 'team' ? <form className="admin-direct admin-access" onSubmit={async (event) => { event.preventDefault(); setAddingMember(true); setError(''); try { await addAdministrator(member); setNotice(`Access granted to ${member.trim().toLowerCase()}.`); setMember(''); } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not add this administrator.'); } finally { setAddingMember(false); } }}><h2>Add an administrator</h2><p>They can sign in with this Google account to review reports, publish map changes, and grant administrator access.</p><label className="report-label">Google account email<input type="email" required value={member} onChange={(e) => setMember(e.target.value)} placeholder="name@example.com" /></label><Button type="submit" variant="primary" disabled={addingMember}>{addingMember ? 'Adding…' : 'Grant access'}</Button></form> : <>
      <div className="admin-filters"><div className="report-map-target" role="group" aria-label="Report status">{(['pending', 'approved', 'rejected'] as const).map((value) => <button type="button" key={value} aria-pressed={status === value} onClick={() => { setStatus(value); setSelected(null); }}>{value === 'pending' ? `Pending (${reports.filter((r) => r.status === 'pending').length})` : value === 'approved' ? 'Reviewed' : 'Rejected'}</button>)}</div><Select label="Report type filter" value={kind} options={[{ value: 'all', label: 'All types' }, { value: 'map', label: 'Route / map' }, { value: 'entrance', label: 'Entrances' }, { value: 'photo', label: 'Photos' }]} onChange={(value) => { setKind(value as typeof kind); setSelected(null); }} /></div>
      <div className={`admin-columns ${active ? 'has-selection' : ''}`}><aside className="admin-list" aria-label="Reports">{loading ? <p role="status">Loading reports…</p> : !filtered.length ? <div className="admin-empty"><h2>No {status} reports</h2><p>Reports will appear here when someone submits one.</p></div> : filtered.map((report) => <button type="button" key={report.id} aria-pressed={selected === report.id} className="admin-report-row" onClick={() => { setSelected(report.id); setNotice(''); }}><span className="admin-report-type">{report.kind === 'entrance' ? 'Entrance' : report.kind === 'photo' ? 'Photo' : 'Map issue'}<span>{floorName(report.floor)}</span></span><strong>{report.placeName ?? (report.kind === 'photo' ? 'Hallway photo' : report.category?.replaceAll('_', ' '))}</strong><span className="admin-report-excerpt">{report.description || 'Location marked on map'}</span></button>)}</aside><section className="admin-detail" aria-label="Report review">{active ? <><button type="button" className="admin-back" onClick={() => setSelected(null)}>← All reports</button><ReportReview key={active.id} report={active} onReviewed={reviewed} /></> : <div className="admin-empty"><span className="admin-empty-mark" aria-hidden="true">⌖</span><h2>Select a report</h2><p>Compare its location and evidence before publishing changes.</p></div>}</section></div>
    </>}{photo && <ReportDialog adminPhoto context={{ floor: '1' }} onClose={() => setPhoto(false)} />}
  </main>;
};
