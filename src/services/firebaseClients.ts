import { getApps, initializeApp } from 'firebase/app';
import { firebaseApp } from './firebase';
const emulated = import.meta.env.DEV && import.meta.env.VITE_USE_FIREBASE_EMULATORS === 'true';
const serviceApp = () => emulated ? getApps().find((app) => app.name === 'reports-emulator') ?? initializeApp({ ...firebaseApp.options, projectId: 'demo-technav', storageBucket: 'demo-technav.appspot.com' }, 'reports-emulator') : firebaseApp;
let database: ReturnType<typeof initializeDatabase> | undefined;
const initializeDatabase = async () => {
  const dbSdk = await import('firebase/firestore');
  const db = dbSdk.getFirestore(serviceApp());
  if (emulated) dbSdk.connectFirestoreEmulator(db, '127.0.0.1', 8080);
  return { dbSdk, db };
};
export const getDatabase = () => database ??= initializeDatabase().catch((error: unknown) => { database = undefined; throw error; });
let clients: ReturnType<typeof initializeClients> | undefined;
const initializeClients = async () => {
  const [authSdk, storageSdk, dbClient] = await Promise.all([import('firebase/auth'), import('firebase/storage'), getDatabase()]);
  const auth = authSdk.getAuth(serviceApp());
  const storage = storageSdk.getStorage(serviceApp());
  if (emulated) {
    authSdk.connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
    storageSdk.connectStorageEmulator(storage, '127.0.0.1', 9199);
  }
  storage.maxUploadRetryTime = 30000;
  storage.maxOperationRetryTime = 20000;
  return { authSdk, storageSdk, auth, storage, ...dbClient };
};
export const getReportClients = () => clients ??= initializeClients().catch((error: unknown) => { clients = undefined; throw error; });
