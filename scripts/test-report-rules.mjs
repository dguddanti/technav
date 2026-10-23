// Runs only against disposable local emulators. Never uses production credentials.
import assert from 'node:assert/strict';
import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, connectAuthEmulator, signInAnonymously, signInWithCredential, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator, doc, setDoc, updateDoc, getDoc, serverTimestamp, runTransaction, collection, getDocs } from 'firebase/firestore';
import { getStorage, connectStorageEmulator, ref, uploadBytes, getBytes } from 'firebase/storage';
const apps = [];
const client = (name) => {
  const app = initializeApp({ apiKey: 'fake-api-key', projectId: 'demo-technav', storageBucket: 'demo-technav.appspot.com' }, name); apps.push(app);
  const auth = getAuth(app); connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  const db = getFirestore(app); connectFirestoreEmulator(db, '127.0.0.1', 8080);
  const storage = getStorage(app); connectStorageEmulator(storage, '127.0.0.1', 9199);
  return { auth, db, storage };
};
const google = async (c, email) => {
  const body = Buffer.from(JSON.stringify({ sub: email, email, email_verified: true })).toString('base64url');
  await signInWithCredential(c.auth, GoogleAuthProvider.credential(`e30.${body}.`));
};
const denied = async (promise, label) => { await assert.rejects(promise, (error) => /permission|unauthorized/i.test(error.code ?? error.message), label); };
try {
  const owner = client('rule-test-owner'); await signInAnonymously(owner.auth);
  const other = client('rule-test-other'); await signInAnonymously(other.auth);
  const admin = client('rule-test-admin'); await google(admin, 'hongjunho5400@gmail.com');
  const outsider = client('rule-test-outsider'); await google(outsider, 'not-an-admin@example.com');
  const id = `rules-${Date.now()}`;
  const data = { schemaVersion: 1, mapVersion: 'tech-v1', authorId: owner.auth.currentUser.uid, kind: 'map', category: 'blocked_path', floor: '1', x: 100, y: 100, placeName: null, hallwayNodeId: null, originalEntrance: null, photoStationId: null, mapHeading: null, description: 'Test-only blocked path', context: { floor: '1', from: null, to: null, stepIndex: null, stepText: null }, status: 'uploading', photo: null, createdAt: serverTimestamp(), submittedAt: null };
  await denied(setDoc(doc(other.db, 'reports', `${id}-spoof`), data), 'Cannot impersonate another reporter');
  await setDoc(doc(owner.db, 'reports', id), data);
  await denied(getDoc(doc(other.db, 'reports', id)), 'Reports are private');
  await denied(getDocs(collection(other.db, 'reports')), 'Anonymous users cannot list reports');
  const photoPath = `report-photos/${owner.auth.currentUser.uid}/${id}/photo.jpg`;
  await denied(uploadBytes(ref(other.storage, photoPath), new Uint8Array([1, 2]), { contentType: 'image/jpeg' }), 'Cannot upload to someone else\'s report');
  await denied(uploadBytes(ref(owner.storage, photoPath), new Uint8Array([1, 2]), { contentType: 'text/html' }), 'Only photos are accepted');
  await uploadBytes(ref(owner.storage, photoPath), new Uint8Array([0xff, 0xd8, 0xff, 0xd9]), { contentType: 'image/jpeg' });
  await denied(getBytes(ref(other.storage, photoPath)), 'Evidence stays private');
  await updateDoc(doc(owner.db, 'reports', id), { status: 'pending', submittedAt: serverTimestamp(), photo: { path: photoPath, width: 1, height: 1 } });
  await denied(updateDoc(doc(owner.db, 'reports', id), { description: 'Changed after submission' }), 'Submitted evidence is immutable');
  await denied(updateDoc(doc(owner.db, 'reports', id), { status: 'approved', reviewedBy: owner.auth.currentUser.uid, reviewedAt: serverTimestamp(), reviewNote: '' }), 'Reporter cannot approve');
  await denied(setDoc(doc(outsider.db, 'adminEmails', 'not-an-admin@example.com'), { email: 'not-an-admin@example.com', addedBy: outsider.auth.currentUser.uid, addedAt: serverTimestamp() }), 'Cannot self-grant administrator access');
  await denied(getDoc(doc(outsider.db, 'reports', id)), 'Google login alone grants no access');
  assert.equal((await getDoc(doc(admin.db, 'reports', id))).exists(), true);
  assert.equal((await getBytes(ref(admin.storage, photoPath))).byteLength, 4);
  await updateDoc(doc(admin.db, 'reports', id), { status: 'approved', reviewedBy: admin.auth.currentUser.uid, reviewedAt: serverTimestamp(), reviewNote: 'Verified test only' });
  await denied(updateDoc(doc(admin.db, 'reports', id), { status: 'rejected', reviewedBy: admin.auth.currentUser.uid, reviewedAt: serverTimestamp(), reviewNote: '' }), 'Cannot review twice');
  await denied(setDoc(doc(owner.db, 'publishedEntrances', 'test-only'), { name: 'Test-only', floor: '1', hallwayNodeId: '1:n40', x: 20, y: 20, mapVersion: 'tech-v1', updatedBy: owner.auth.currentUser.uid, updatedAt: serverTimestamp(), sourceReportId: null }), 'Anonymous users cannot publish map changes');
  const hallwayList = await getDocs(collection(admin.db, 'hallwayNodes'));
  const hallway = hallwayList.docs.find((entry) => entry.data().floor === '1');
  await setDoc(doc(admin.db, 'publishedEntrances', 'test-only'), { name: 'Test-only', floor: '1', hallwayNodeId: hallway.id, x: 20, y: 20, mapVersion: 'tech-v1', updatedBy: admin.auth.currentUser.uid, updatedAt: serverTimestamp(), sourceReportId: null });
  assert.equal((await getDoc(doc(other.db, 'publishedEntrances', 'test-only'))).data().x, 20);
  await denied(setDoc(doc(admin.db, 'publishedEntrances', 'invalid'), { name: 'Invalid', floor: '2', hallwayNodeId: hallway.id, x: 20, y: 20, mapVersion: 'tech-v1', updatedBy: admin.auth.currentUser.uid, updatedAt: serverTimestamp(), sourceReportId: null }), 'Cross-floor links cannot be published');
  const spots = await getDocs(collection(admin.db, 'photoStations'));
  const spot = spots.docs.find((entry) => entry.data().floor === '1');
  const spotData = spot.data(); const photoId = `${id}-photo`;
  const specific = { ...data, kind: 'photo', category: null, description: '', x: spotData.x, y: spotData.y, photoStationId: spot.id, mapHeading: 90 };
  await denied(setDoc(doc(owner.db, 'reports', `${photoId}-invalid`), { ...specific, x: 0 }), 'Photo stations cannot be spoofed');
  await setDoc(doc(owner.db, 'reports', photoId), specific);
  const approvedPath = `report-photos/${owner.auth.currentUser.uid}/${photoId}/photo.jpg`;
  await uploadBytes(ref(owner.storage, approvedPath), new Uint8Array([0xff, 0xd8, 0xff, 0xd9]), { contentType: 'image/jpeg' });
  const photo = { path: approvedPath, width: 1, height: 1 };
  await updateDoc(doc(owner.db, 'reports', photoId), { status: 'pending', submittedAt: serverTimestamp(), photo });
  await runTransaction(admin.db, async (transaction) => {
    await transaction.get(doc(admin.db, 'reports', photoId));
    transaction.set(doc(admin.db, 'publishedPhotos', photoId), { floor: '1', x: spotData.x, y: spotData.y, photoStationId: spot.id, mapHeading: 90, photo, mapVersion: 'tech-v1', updatedBy: admin.auth.currentUser.uid, updatedAt: serverTimestamp() });
    transaction.update(doc(admin.db, 'reports', photoId), { status: 'approved', reviewedBy: admin.auth.currentUser.uid, reviewedAt: serverTimestamp(), reviewNote: '' });
  });
  assert.equal((await getBytes(ref(other.storage, approvedPath))).byteLength, 4);
  console.log('PASS: anonymous submission, private evidence, admin allowlist, approval, published photos, and route entrance rules.');
} finally { await Promise.all(apps.map(deleteApp)); }
