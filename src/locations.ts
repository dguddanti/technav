import { places as originalPlaces, placeFloor as originalFloors, nodes, floorOf, FLOORS } from './building';
import type { Floor } from './building';
import type { Point } from './route';

export interface PublishedEntrance { name: string; floor: Floor; hallwayNodeId: string; x: number; y: number; mapVersion: string }
export const places = { ...originalPlaces };
export const placeFloor = { ...originalFloors };
let revision = 0;
const listeners = new Set<() => void>();
export const subscribeLocations = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
export const locationRevision = () => revision;
export const validEntrance = (entry: PublishedEntrance) => typeof entry.name === 'string' && entry.name.trim().length > 0 && entry.name.length <= 100 && !['__proto__', 'constructor', 'prototype'].includes(entry.name)
  && entry.mapVersion === 'tech-v1' && FLOORS.some((floor) => floor.id === entry.floor)
  && Object.hasOwn(nodes, entry.hallwayNodeId) && floorOf[entry.hallwayNodeId] === entry.floor
  && Number.isFinite(entry.x) && Number.isFinite(entry.y) && entry.x >= 0 && entry.x <= 1948 && entry.y >= 0 && entry.y <= 1904;

// Keep references stable for the routing engine while notifying mounted search forms.
export const applyPublishedEntrances = (entries: PublishedEntrance[]) => {
  for (const name of Object.keys(places)) { delete places[name]; delete placeFloor[name]; }
  Object.assign(places, originalPlaces); Object.assign(placeFloor, originalFloors);
  for (const entry of entries) if (validEntrance(entry)) {
    places[entry.name] = [entry.hallwayNodeId, [entry.x, entry.y] as Point];
    placeFloor[entry.name] = entry.floor;
  }
  revision += 1;
  listeners.forEach((listener) => listener());
};
