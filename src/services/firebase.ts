import { getApps, initializeApp } from 'firebase/app';

const firebaseConfig = {
  apiKey: 'AIzaSyD9SUKfrA2fV0WMwfPzQpSo8aLq43carZQ',
  authDomain: 'technav-db7a8.firebaseapp.com',
  projectId: 'technav-db7a8',
  storageBucket: 'technav-db7a8.firebasestorage.app',
  messagingSenderId: '174572491167',
  appId: '1:174572491167:web:99a4ee0bf799a667782daa',
  measurementId: 'G-V35FLZGGQ8',
};

export const firebaseApp = getApps().find((app) => app.name === '[DEFAULT]')
  ?? initializeApp(firebaseConfig);

let analyticsInitialization: Promise<void> | undefined;

const initializeAnalytics = async (): Promise<void> => {
  try {
    const { getAnalytics, isSupported } = await import('firebase/analytics');
    if (await isSupported()) getAnalytics(firebaseApp);
  } catch (error) {
    // Analytics is optional; a blocked or unavailable SDK must not prevent navigation.
    console.warn('Firebase Analytics could not be initialized.', error);
  }
};

export const startAnalytics = (): Promise<void> => {
  // Keep development sessions and tests out of the production Analytics property.
  if (!import.meta.env.PROD || typeof window === 'undefined') return Promise.resolve();
  analyticsInitialization ??= initializeAnalytics();
  return analyticsInitialization;
};
