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
// Segments shorter than this (in map pixels) never create a turn of their own.
const MIN_LEG = 35;

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
  const path = [to];
  while (path[0] !== from) path.unshift(prev[path[0]]);
  return path;
}

const sub = (a: Point, b: Point): Point => [a[0] - b[0], a[1] - b[1]];
const dist = (a: Point, b: Point) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const feet = (a: Point, b: Point) => Math.max(5, Math.round((dist(a, b) * FEET_PER_PX) / 5) * 5);
// Snap a direction to 0 east, 1 south, 2 west, 3 north. Going up the index is a right turn.
const compass = (v: Point) => (Math.round(Math.atan2(v[1], v[0]) / (Math.PI / 2)) + 4) % 4;
const rel = (from: number, to: number) => (to - from + 4) % 4; // 0 ahead, 1 right, 2 behind, 3 left

export function getSteps(from: string, to: string): Step[] {
  const [startNode, startDoor] = places[from];
  const [endNode, endDoor] = places[to];

  // Start at the door, walk the hallway nodes, skip repeated points.
  const pts: Point[] = [startDoor];
  for (const n of findPath(startNode, endNode)) {
    const p = nodes[n];
    const last = pts[pts.length - 1];
    if (p[0] !== last[0] || p[1] !== last[1]) pts.push(p);
  }
  if (pts.length < 2) pts.push(endDoor);

  // Merge segments into legs. A very short leg adopts the direction of what follows it.
  const legs: { d: number; tiny: boolean; pts: Point[] }[] = [];
  for (let i = 1; i < pts.length; i++) {
    const v = sub(pts[i], pts[i - 1]);
    const d = compass(v);
    const tiny = dist(pts[i], pts[i - 1]) < MIN_LEG;
    const last = legs[legs.length - 1];
    if (last && last.tiny) {
      last.d = d;
      last.tiny = tiny;
      last.pts[1] = pts[i];
    } else if (last && (d === last.d || tiny)) {
      last.pts[1] = pts[i];
    } else {
      legs.push({ d, tiny, pts: [pts[i - 1], pts[i]] });
    }
  }

  const steps: Step[] = legs.map((leg, i) => {
    const ft = feet(leg.pts[0], leg.pts[1]);
    if (i === 0) {
      const text = from === 'Main Entrance' ? `Walk straight ahead for ${ft} ft.` : `Exit ${from} and walk ${ft} ft.`;
      return { turn: 'straight', text, pts: leg.pts };
    }
    const r = rel(legs[i - 1].d, leg.d);
    if (r === 1) return { turn: 'right', text: `Turn right. Walk ${ft} ft.`, pts: leg.pts };
    if (r === 3) return { turn: 'left', text: `Turn left. Walk ${ft} ft.`, pts: leg.pts };
    return { turn: 'around', text: `Turn around. Walk ${ft} ft.`, pts: leg.pts };
  });

  const lastLeg = legs[legs.length - 1];
  const end = lastLeg.pts[1];
  const toDoor = sub(endDoor, end);
  const r = dist(endDoor, end) < MIN_LEG ? 0 : rel(lastLeg.d, compass(toDoor));
  const where = ['straight ahead', 'on your right', 'behind you', 'on your left'][r];
  steps.push({ turn: 'arrive', text: `${to} is ${where}. You have arrived.`, pts: [end, endDoor] });

  return steps;
}
