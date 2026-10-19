import type { Point } from '../route';

export interface Shaft {
  kind: 'stairs' | 'elevator';
  node: string;
}

// One floor's hallway graph. Node ids are local to the floor.
export interface FloorData {
  nodes: Record<string, Point>;
  edges: [string, string][];
  // place: [hallway node it opens onto, door position]
  places: Record<string, [string, Point]>;
  // Shafts with the same id on neighbouring floors connect.
  shafts: Record<string, Shaft>;
}
