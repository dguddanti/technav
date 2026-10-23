import { getDatabase } from './firebaseClients';
import { applyPublishedEntrances } from '../locations';
import type { PublishedEntrance } from '../locations';

export const watchPublishedEntrances = () => {
  let stopped = false; let unsubscribe = () => {};
  void getDatabase().then((c) => {
    if (stopped) return;
    unsubscribe = c.dbSdk.onSnapshot(c.dbSdk.collection(c.db, 'publishedEntrances'), (snapshot) => {
      applyPublishedEntrances(snapshot.docs.map((entry) => entry.data() as PublishedEntrance));
    }, (error) => console.warn('Published map updates could not be loaded. The bundled map remains available.', error.code));
  }).catch((error: unknown) => console.warn('Map updates are unavailable.', error));
  return () => { stopped = true; unsubscribe(); };
};
