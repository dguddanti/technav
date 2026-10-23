import { assertPhotoSlotAvailable } from './photoCoverage';
import { getReportClients } from './firebaseClients';
import { photoStations } from '../data/photoStations';
import { MAP_VERSION } from '../types/reports';
import type { ReportDraft } from '../types/reports';
import { validateReport } from '../reports/validation';
import { places } from '../locations';

// Re-encode camera images to limit upload size and discard file metadata.
export const prepareReportPhoto = async (file: File) => {
  const image = await createImageBitmap(file, { imageOrientation: 'from-image' });
  try {
    const scale = Math.min(1, 1600 / Math.max(image.width, image.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.width * scale));
    canvas.height = Math.max(1, Math.round(image.height * scale));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Your browser could not prepare this photo. Try another browser.');
    context.fillStyle = '#fff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((result) => result ? resolve(result) : reject(new Error('This photo could not be read. Try a JPG or PNG.')), 'image/jpeg', .8);
    });
    if (blob.size > 2 * 1024 * 1024) throw new Error('This photo is too large. Choose a smaller image.');
    return { blob, width: canvas.width, height: canvas.height };
  } finally { image.close(); }
};

const reportErrorMessage = (error: unknown): string => {
  const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : '';
  if (code === 'auth/operation-not-allowed' || code === 'auth/configuration-not-found') return 'Reporting is not available yet. Please try again later.';
  if (code === 'auth/network-request-failed' || code.includes('unavailable') || code === 'storage/retry-limit-exceeded') return 'Could not connect. Check your connection and try again. Your report is still here.';
  if (code.includes('permission-denied') || code === 'storage/unauthorized') return 'Your report could not be saved. Please try again later.';
  return error instanceof Error ? error.message : 'Your report could not be sent. Please try again.';
};

const sendReport = async (draft: ReportDraft): Promise<string> => {
  const validation = validateReport(draft);
  if (validation) throw new Error(validation);
  if (draft.kind === 'photo') {
    const station = photoStations.find((candidate) => candidate.id === draft.photoStationId);
    if (!station || station.floor !== draft.floor || station.point[0] !== draft.point![0] || station.point[1] !== draft.point![1]) throw new Error('Choose a photo spot on this floor.');
    await assertPhotoSlotAvailable(station.id, draft.mapHeading!);
  }
  const image = draft.photo ? await prepareReportPhoto(draft.photo) : null;
  const c = await getReportClients();
  await c.auth.authStateReady();
  const user = c.auth.currentUser ?? (await c.authSdk.signInAnonymously(c.auth)).user;
  const ref = c.dbSdk.doc(c.dbSdk.collection(c.db, 'reports'));
  const photoRef = c.storageSdk.ref(c.storage, `report-photos/${user.uid}/${ref.id}/photo.jpg`);
  let created = false;
  try {
    const originalDoor = draft.kind === 'entrance' ? places[draft.placeName][1] : null;
    await c.dbSdk.setDoc(ref, {
      schemaVersion: 1, mapVersion: MAP_VERSION, authorId: user.uid,
      kind: draft.kind, category: draft.kind === 'map' ? draft.category : null,
      floor: draft.floor, x: draft.point![0], y: draft.point![1],
      placeName: draft.kind === 'entrance' ? draft.placeName : null,
      hallwayNodeId: draft.kind === 'entrance' ? draft.hallwayNodeId : null,
      originalEntrance: originalDoor ? { x: originalDoor[0], y: originalDoor[1] } : null,
      photoStationId: draft.kind === 'photo' ? draft.photoStationId : null,
      mapHeading: draft.kind === 'photo' ? draft.mapHeading : null,
      description: draft.description.trim(),
      context: {
        floor: draft.context.floor, from: draft.context.from ?? null, to: draft.context.to ?? null,
        stepIndex: draft.context.stepIndex ?? null, stepText: draft.context.stepText ?? null,
      },
      status: 'uploading', photo: null, createdAt: c.dbSdk.serverTimestamp(), submittedAt: null,
    });
    created = true;
    if (image) await c.storageSdk.uploadBytes(photoRef, image.blob, { contentType: 'image/jpeg' });
    if (draft.kind === 'photo') await assertPhotoSlotAvailable(draft.photoStationId!, draft.mapHeading!);
    await c.dbSdk.updateDoc(ref, {
      status: 'pending', submittedAt: c.dbSdk.serverTimestamp(),
      photo: image ? { path: photoRef.fullPath, width: image.width, height: image.height } : null,
    });
    return ref.id;
  } catch (error) {
    if (created) {
      // An unfinished upload never appears in the pending review queue.
      if (image) {
        try { await c.storageSdk.deleteObject(photoRef); }
        catch (cleanupError) {
          if (!(cleanupError && typeof cleanupError === 'object' && 'code' in cleanupError && cleanupError.code === 'storage/object-not-found')) console.warn('Unfinished report photo could not be removed.', cleanupError);
        }
      }
      try { await c.dbSdk.deleteDoc(ref); }
      catch (cleanupError) { console.warn('Unfinished report could not be removed.', cleanupError); }
    }
    throw error;
  }
};

export const submitReport = async (draft: ReportDraft): Promise<string> => {
  try { return await sendReport(draft); }
  catch (error) { throw new Error(reportErrorMessage(error), { cause: error }); }
};
