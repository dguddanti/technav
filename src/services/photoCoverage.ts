import { getDatabase } from './firebaseClients';
import type { Floor } from '../building';
import type { MapHeading } from '../types/reports';

export type PhotoCoverage = Record<string, MapHeading[]>;
export const photoSlotId = (stationId: string, heading: MapHeading) => `${stationId}_${heading}`;
export const watchPhotoCoverage = (floor: Floor, receive: (coverage: PhotoCoverage) => void, fail: () => void) => {
  let stopped = false; let unsubscribe = () => {};
  void getDatabase().then((c) => {
    if (stopped) return;
    // Read published records as well as enforcing unique slots server-side. This
    // includes photos approved before the slot registry was introduced.
    unsubscribe = c.dbSdk.onSnapshot(c.dbSdk.query(c.dbSdk.collection(c.db, 'publishedPhotos'), c.dbSdk.where('floor', '==', floor)), { includeMetadataChanges: true }, (snapshot) => {
      if (snapshot.metadata.fromCache) return;
      const coverage: PhotoCoverage = {};
      for (const entry of snapshot.docs) {
        const data = entry.data();
        if (typeof data.photoStationId !== 'string' || ![0, 90, 180, 270].includes(data.mapHeading)) continue;
        const directions = coverage[data.photoStationId] ??= [];
        if (!directions.includes(data.mapHeading)) directions.push(data.mapHeading);
      }
      if (!stopped) receive(coverage);
    }, () => { if (!stopped) fail(); });
  }).catch(() => { if (!stopped) fail(); });
  return () => { stopped = true; unsubscribe(); };
};
export const assertPhotoSlotAvailable = async (stationId: string, heading: MapHeading) => {
  const c = await getDatabase();
  const slot = await c.dbSdk.getDocFromServer(c.dbSdk.doc(c.db, 'photoCoverage', photoSlotId(stationId, heading)));
  if (slot.exists()) throw new Error('This direction already has a photo. Choose another direction or spot.');
};
