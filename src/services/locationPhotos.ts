import { getDatabase, getReportClients } from './firebaseClients';
import type { Floor } from '../building';
import type { MapHeading } from '../types/reports';

export interface LocationPhoto { id: string; photoStationId: string; mapHeading: MapHeading; path: string }
export const watchLocationPhotos = (floor: Floor, receive: (photos: LocationPhoto[]) => void, fail: () => void) => {
  let stopped = false; let unsubscribe = () => {};
  void getDatabase().then((c) => {
    if (stopped) return;
    unsubscribe = c.dbSdk.onSnapshot(c.dbSdk.query(c.dbSdk.collection(c.db, 'publishedPhotos'), c.dbSdk.where('floor', '==', floor)), { includeMetadataChanges: true }, (snapshot) => {
      if (snapshot.metadata.fromCache || stopped) return;
      const photos: LocationPhoto[] = [];
      for (const entry of snapshot.docs) {
        const data = entry.data();
        if (data.mapVersion !== 'tech-v1' || typeof data.photoStationId !== 'string' || ![0, 90, 180, 270].includes(data.mapHeading) || typeof data.photo?.path !== 'string') continue;
        photos.push({ id: entry.id, photoStationId: data.photoStationId, mapHeading: data.mapHeading, path: data.photo.path });
      }
      receive(photos);
    }, () => { if (!stopped) fail(); });
  }).catch(() => { if (!stopped) fail(); });
  return () => { stopped = true; unsubscribe(); };
};
export const loadLocationPhoto = async (path: string): Promise<Blob> => {
  const c = await getReportClients();
  const bytes = await c.storageSdk.getBytes(c.storageSdk.ref(c.storage, path), 2 * 1024 * 1024);
  return new Blob([bytes], { type: 'image/jpeg' });
};
