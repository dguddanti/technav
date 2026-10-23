import { photoSlotId } from './photoCoverage';
import { getReportClients } from './firebaseClients';
import { submitReport } from './reports';
import { validEntrance } from '../locations';
import type { PublishedEntrance } from '../locations';
import type { ReportDraft, ReportKind, MapHeading } from '../types/reports';
import type { Floor } from '../building';

export interface AdminIdentity { email: string; allowed: boolean }
export interface SubmittedReport {
  id: string; createdAtMillis: number; kind: ReportKind; floor: Floor; x: number; y: number;
  placeName: string | null; hallwayNodeId: string | null; description: string;
  category: string | null; photoStationId: string | null; mapHeading: MapHeading | null;
  status: 'pending' | 'approved' | 'rejected';
  originalEntrance: { x: number; y: number } | null;
  photo: { path: string; width: number; height: number } | null;
  context: { from: string | null; to: string | null; stepText: string | null };
}
const emailKey = (email: string) => email.trim().toLowerCase();
export const watchAdminIdentity = (receive: (identity: AdminIdentity | null) => void, fail: (error: Error) => void) => {
  let stopped = false;
  let unsubscribe = () => {};
  void getReportClients().then((c) => {
    if (stopped) return;
    unsubscribe = c.authSdk.onAuthStateChanged(c.auth, async (user) => {
      if (!user || user.isAnonymous || !user.email) { receive(null); return; }
      try {
        const member = await c.dbSdk.getDoc(c.dbSdk.doc(c.db, 'adminEmails', emailKey(user.email)));
        if (!stopped && c.auth.currentUser?.uid === user.uid) receive({ email: user.email, allowed: member.exists() });
      } catch (error) { if (!stopped) fail(error instanceof Error ? error : new Error('Could not verify administrator access.')); }
    }, fail);
  }).catch(fail);
  return () => { stopped = true; unsubscribe(); };
};
export const signInAdmin = async () => {
  const c = await getReportClients();
  const provider = new c.authSdk.GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  await c.authSdk.signInWithPopup(c.auth, provider);
};
export const signOutAdmin = async () => { const c = await getReportClients(); await c.authSdk.signOut(c.auth); };
export const watchReports = (receive: (reports: SubmittedReport[]) => void, fail: (error: Error) => void) => {
  let stopped = false; let unsubscribe = () => {};
  void getReportClients().then((c) => {
    if (stopped) return;
    unsubscribe = c.dbSdk.onSnapshot(c.dbSdk.query(c.dbSdk.collection(c.db, 'reports'), c.dbSdk.where('status', 'in', ['pending', 'approved', 'rejected'])),
      (snapshot) => receive(snapshot.docs.map((entry) => ({ ...entry.data(), id: entry.id, createdAtMillis: entry.data().createdAt?.toMillis?.() ?? 0 }) as SubmittedReport).sort((a, b) => b.createdAtMillis - a.createdAtMillis)), fail);
  }).catch(fail);
  return () => { stopped = true; unsubscribe(); };
};
export const readReportPhoto = async (path: string) => {
  const c = await getReportClients();
  // Authenticated byte reads keep pending evidence private (no public download token).
  const bytes = await c.storageSdk.getBytes(c.storageSdk.ref(c.storage, path), 2 * 1024 * 1024);
  return URL.createObjectURL(new Blob([bytes], { type: 'image/jpeg' }));
};
export const saveEntrance = async (entrance: PublishedEntrance, reportId?: string, note = '') => {
  if (!validEntrance(entrance)) throw new Error('Choose a name, door location, and connected hallway on the same floor.');
  const c = await getReportClients();
  const target = c.dbSdk.doc(c.db, 'publishedEntrances', encodeURIComponent(entrance.name));
  await c.dbSdk.runTransaction(c.db, async (transaction) => {
    const reportRef = reportId ? c.dbSdk.doc(c.db, 'reports', reportId) : null;
    if (reportRef) {
      const report = await transaction.get(reportRef);
      if (!report.exists() || report.data().status !== 'pending' || report.data().kind !== 'entrance') throw new Error('This report has already been reviewed. Refresh the list.');
      if (report.data().placeName !== entrance.name || report.data().floor !== entrance.floor) throw new Error('The approved location must match the reported room and floor.');
    }
    transaction.set(target, { ...entrance, sourceReportId: reportId ?? null, updatedBy: c.auth.currentUser!.uid, updatedAt: c.dbSdk.serverTimestamp() });
    if (reportRef) transaction.update(reportRef, { status: 'approved', reviewedAt: c.dbSdk.serverTimestamp(), reviewNote: note.trim(), reviewedBy: c.auth.currentUser!.uid });
  });
};
export const reviewReport = async (reportId: string, status: 'approved' | 'rejected', note: string) => {
  const c = await getReportClients();
  const reportRef = c.dbSdk.doc(c.db, 'reports', reportId);
  await c.dbSdk.runTransaction(c.db, async (transaction) => {
    const snapshot = await transaction.get(reportRef);
    if (!snapshot.exists() || snapshot.data().status !== 'pending') throw new Error('This report has already been reviewed. Refresh the list.');
    const report = snapshot.data() as SubmittedReport;
    if (status === 'approved' && report.kind === 'entrance') throw new Error('Use Save entrance to publish an entrance correction.');
    if (status === 'approved' && report.kind === 'photo') {
      if (!report.photo) throw new Error('This photo is missing.');
      const slotRef = c.dbSdk.doc(c.db, 'photoCoverage', photoSlotId(report.photoStationId!, report.mapHeading!));
      const slot = await transaction.get(slotRef);
      if (slot.exists()) throw new Error('This direction already has an approved photo. Reject this duplicate report instead.');
      transaction.set(slotRef, { photoStationId: report.photoStationId, mapHeading: report.mapHeading, floor: report.floor, reportId, mapVersion: 'tech-v1' });
      // The report remains immutable; publication is an atomic, separate record.
      transaction.set(c.dbSdk.doc(c.db, 'publishedPhotos', reportId), { floor: report.floor, x: report.x, y: report.y, photoStationId: report.photoStationId, mapHeading: report.mapHeading, photo: report.photo, mapVersion: 'tech-v1', updatedBy: c.auth.currentUser!.uid, updatedAt: c.dbSdk.serverTimestamp() });
    }
    transaction.update(reportRef, { status, reviewedAt: c.dbSdk.serverTimestamp(), reviewNote: note.trim(), reviewedBy: c.auth.currentUser!.uid });
  });
};
export const addAdminPhoto = async (draft: ReportDraft) => {
  const id = await submitReport(draft);
  await reviewReport(id, 'approved', 'Added by administrator');
};
export const addAdministrator = async (email: string) => {
  const normalized = emailKey(email);
  if (!/^[^\s/@]+@[^\s/@]+\.[^\s/@]+$/.test(normalized)) throw new Error('Enter a valid Google account email.');
  const c = await getReportClients();
  const target = c.dbSdk.doc(c.db, 'adminEmails', normalized);
  if ((await c.dbSdk.getDoc(target)).exists()) return;
  await c.dbSdk.setDoc(target, { email: normalized, addedAt: c.dbSdk.serverTimestamp(), addedBy: c.auth.currentUser!.uid });
};
