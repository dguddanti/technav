import { places, placeFloor } from '../locations';
import { floorOf, nodes } from '../building';
import { MAP_HEIGHT, MAP_WIDTH } from '../types/reports';
import type { ReportDraft } from '../types/reports';

export const MAX_PHOTO_BYTES = 15 * 1024 * 1024;
export const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export const validatePhoto = (photo: File): string | null => {
  if (!IMAGE_TYPES.includes(photo.type)) return 'Choose a JPG, PNG, or WebP photo.';
  if (!photo.size || photo.size > MAX_PHOTO_BYTES) return 'Choose a photo smaller than 15 MB.';
  return null;
};

export const validateReport = (draft: ReportDraft): string | null => {
  if (!draft.point) return draft.kind === 'photo' ? 'Choose a photo spot on the map.' : 'Mark a location on the map.';
  const [x, y] = draft.point;
  if (!Number.isFinite(x) || !Number.isFinite(y) || x < 0 || y < 0 || x > MAP_WIDTH || y > MAP_HEIGHT) return 'Choose a point inside the floor plan.';
  if (draft.description.trim().length > 1500) return 'Keep your description under 1,500 characters.';
  if (draft.kind === 'map' && !draft.description.trim()) return 'Describe what needs to be corrected.';
  if (draft.kind === 'entrance') {
    if (!Object.hasOwn(places, draft.placeName) || placeFloor[draft.placeName] !== draft.floor) return 'Choose a listed room on this floor.';
    if (!draft.hallwayNodeId || !Object.hasOwn(nodes, draft.hallwayNodeId) || floorOf[draft.hallwayNodeId] !== draft.floor) return 'Select the hallway connected to this door.';
  }
  if (draft.kind === 'photo') {
    if (!draft.photoStationId) return 'Choose a fixed photo spot on the map.';
    if (draft.mapHeading === null) return 'Choose the direction you were facing on the map.';
    if (!draft.photo) return 'Add a photo of this location.';
  }
  return draft.photo ? validatePhoto(draft.photo) : null;
};
