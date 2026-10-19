import { nodes, edges, places } from './map-data';

export { places };
export type Point = [number, number];
export type Turn = 'straight' | 'left' | 'right' | 'around' | 'arrive';
export interface Step {
  turn: Turn;
  text: string;
  pts: Point[];
}

// Placeholder scale. Calibrate: measure one real hallway in feet, divide by its pixel length.
export const FEET_PER_PX = 0.3;
// Do not give sub-three-pixel directional runs their own walking instruction.
const MIN_DIRECTION_PX = 3;

const adj: Record<string, [string, number][]> = {};
for (const [a, b] of edges) {
  const w = Math.hypot(nodes[a][0] - nodes[b][0], nodes[a][1] - nodes[b][1]);
  (adj[a] ??= []).push([b, w]);
  (adj[b] ??= []).push([a, w]);
}

// Shortest path by walking distance (Dijkstra).
function findPath(from: string, to: string): string[] {
  const best: Record<string, number> = { [from]: 0 };
  const prev: Record<string, string> = {};
  const todo = new Set([from]);
  while (todo.size) {
    let n = '';
    for (const c of todo) if (n === '' || best[c] < best[n]) n = c;
    todo.delete(n);
    if (n === to) break;
    for (const [m, w] of adj[n] ?? []) {
      if (best[m] === undefined || best[n] + w < best[m]) {
        best[m] = best[n] + w;
        prev[m] = n;
        todo.add(m);
      }
    }
  }
  if (best[to] === undefined) {
    throw new Error('No connected route is available between these locations. Choose another location.');
  }
  const path = [to];
  while (path[0] !== from) path.unshift(prev[path[0]]);
  return path;
}

const sub = (a: Point, b: Point): Point => [a[0] - b[0], a[1] - b[1]];
const dist = (a: Point, b: Point) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const pathLength = (pts: Point[]) => pts.slice(1).reduce(
  (sum, point, i) => sum + dist(pts[i], point), 0,
);
const distanceText = (pts: Point[]) => {
  const ft = Math.round((pathLength(pts) * FEET_PER_PX) / 5) * 5;
  return ft === 0 ? 'a short distance' : `about ${ft} ft`;
};
// Snap a direction to 0 east, 1 south, 2 west, 3 north. Going up the index is a right turn.
const compass = (v: Point) => (Math.round(Math.atan2(v[1], v[0]) / (Math.PI / 2)) + 4) % 4;
const rel = (from: number, to: number) => (to - from + 4) % 4; // 0 ahead, 1 right, 2 behind, 3 left

export function getSteps(from: string, to: string): Step[] {
  if (!Object.hasOwn(places, from) || !Object.hasOwn(places, to)) {
    throw new Error('Choose a listed first-floor location for both From and To.');
  }
  const [startNode, startDoor] = places[from];
  const [endNode, endDoor] = places[to];
  if (from === to) {
    return [{ turn: 'arrive', text: `You are already at ${to}.`, pts: [startDoor, startDoor] }];
  }

  // Start at the door, walk the hallway nodes, skip repeated points.
  const pts: Point[] = [startDoor];
  for (const n of findPath(startNode, endNode)) {
    const p = nodes[n];
    const last = pts[pts.length - 1];
    if (p[0] !== last[0] || p[1] !== last[1]) pts.push(p);
  }
  if (pts.length < 2) pts.push(endDoor);

  // Group directions without discarding hallway points or merging across corners.
  const legs: { d: number; pts: Point[] }[] = [];
  for (let i = 1; i < pts.length; i++) {
    const v = sub(pts[i], pts[i - 1]);
    const d = compass(v);
    const last = legs[legs.length - 1];
    if (last && d === last.d) {
      last.pts.push(pts[i]);
    } else {
      legs.push({ d, pts: [pts[i - 1], pts[i]] });
    }
  }

  // Keep every map point, but fold tiny directional runs into the walking instruction.
  // Initial noise adopts the next meaningful heading; trailing noise never replaces one.
  const directions: { d: number; pts: Point[]; hasDirection: boolean }[] = [];
  for (const leg of legs) {
    const hasDirection = pathLength(leg.pts) >= MIN_DIRECTION_PX;
    const last = directions[directions.length - 1];
    if (last && (!hasDirection || !last.hasDirection || last.d === leg.d)) {
      last.pts.push(...leg.pts.slice(1));
      if (hasDirection && !last.hasDirection) {
        last.d = leg.d;
        last.hasDirection = true;
      }
    } else {
      directions.push({ d: leg.d, pts: [...leg.pts], hasDirection });
    }
  }

  const steps: Step[] = directions.map((leg, i) => {
    const distance = distanceText(leg.pts);
    if (i === 0) {
      const text = from === 'Main Entrance' ? `Walk straight ahead for ${distance}.` : `Exit ${from} and walk ${distance}.`;
      return { turn: 'straight', text, pts: leg.pts };
    }
    const r = rel(directions[i - 1].d, leg.d);
    if (r === 1) return { turn: 'right', text: `Turn right. Walk ${distance}.`, pts: leg.pts };
    if (r === 3) return { turn: 'left', text: `Turn left. Walk ${distance}.`, pts: leg.pts };
    return { turn: 'around', text: `Turn around. Walk ${distance}.`, pts: leg.pts };
  });

  const lastLeg = directions[directions.length - 1];
  const end = lastLeg.pts[lastLeg.pts.length - 1];
  const toDoor = sub(endDoor, end);
  const r = dist(endDoor, end) === 0 ? 0 : rel(lastLeg.d, compass(toDoor));
  const where = ['straight ahead', 'on your right', 'behind you', 'on your left'][r];
  steps.push({ turn: 'arrive', text: `${to} is ${where}. You have arrived.`, pts: [end, endDoor] });

  return steps;
}
