import * as first from './map-data';
import { floor as basement } from './floors/floor-B';
import { floor as ground } from './floors/floor-G';
import { floor as firstExtras } from './floors/floor-1';
import { floor as second } from './floors/floor-2';
import { floor as third } from './floors/floor-3';
import { floor as fourth } from './floors/floor-4';
import { extraRooms } from './floors/extra-rooms';
import type { FloorData, Shaft } from './floors/types';
import type { Point } from './route';

export type Floor = 'B' | 'G' | '1' | '2' | '3' | '4';

// Bottom to top. Every plan shares the first floor's 1948 x 1904 coordinate space.
export const FLOORS: { id: Floor; name: string; image: string }[] = [
  { id: 'B', name: 'Basement', image: '/maps/floor-B.png' },
  { id: 'G', name: 'Ground floor', image: '/maps/floor-G.png' },
  { id: '1', name: 'Floor 1', image: '/map.png' },
  { id: '2', name: 'Floor 2', image: '/maps/floor-2.png' },
  { id: '3', name: 'Floor 3', image: '/maps/floor-3.png' },
  { id: '4', name: 'Floor 4', image: '/maps/floor-4.png' },
];

const data: Record<Floor, FloorData> = {
  B: basement,
  G: ground,
  // The first floor is hand drawn; the generated file only adds its stairs and elevators.
  1: {
    nodes: { ...first.nodes, ...firstExtras.nodes },
    edges: [...first.edges, ...firstExtras.edges],
    places: first.places,
    shafts: firstExtras.shafts,
  },
  2: second,
  3: third,
  4: fourth,
};

// Walking-distance equivalents, in map pixels, for moving one floor.
export const STAIRS_COST = 150;
export const ELEVATOR_COST = 250;

export const nodes: Record<string, Point> = {};
export const floorOf: Record<string, Floor> = {};
export const edges: [string, string][] = [];
export const places: Record<string, [string, Point]> = {};
export const placeFloor: Record<string, Floor> = {};
// Stairs and elevators between neighbouring floors.
export const links: { a: string; b: string; kind: Shaft['kind']; name: string }[] = [];

const id = (floor: Floor, node: string) => `${floor}:${node}`;

FLOORS.forEach(({ id: floor }, i) => {
  const d = data[floor];
  const extra = extraRooms[floor];
  for (const [n, p] of Object.entries({ ...d.nodes, ...extra.nodes })) {
    nodes[id(floor, n)] = p;
    floorOf[id(floor, n)] = floor;
  }
  for (const [a, b] of [...d.edges, ...extra.edges]) edges.push([id(floor, a), id(floor, b)]);
  for (const [name, [n, door]] of Object.entries({ ...d.places, ...extra.places })) {
    places[name] = [id(floor, n), door];
    placeFloor[name] = floor;
  }
  const below = FLOORS[i - 1]?.id;
  if (!below) return;
  for (const [name, shaft] of Object.entries(d.shafts)) {
    const under = data[below].shafts[name];
    if (under?.kind === shaft.kind) {
      links.push({ a: id(below, under.node), b: id(floor, shaft.node), kind: shaft.kind, name });
    }
  }
});

export const floorName = (floor: Floor) => FLOORS.find((f) => f.id === floor)!.name;
export const floorLevel = (floor: Floor) => FLOORS.findIndex((f) => f.id === floor);
