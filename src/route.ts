import { nodes, edges, places, links, floorOf, placeFloor, floorName, floorLevel, STAIRS_COST, ELEVATOR_COST } from './building';
import type { Floor } from './building';

export { places };
export type Point = [number, number];
export type Turn = 'straight' | 'left' | 'right' | 'around' | 'arrive' | 'up' | 'down';
export interface Step {
  turn: Turn;
  text: string;
  pts: Point[];
  floor: Floor;
}
export interface RouteOptions {
  // Use elevators only, for step-free routes.
  avoidStairs?: boolean;
}

// Placeholder scale. Calibrate: measure one real hallway in feet, divide by its pixel length.
export const FEET_PER_PX = 0.3;

type Hop = [string, number, 'stairs' | 'elevator' | null];
const adj: Record<string, Hop[]> = {};
for (const [a, b] of edges) {
  const w = Math.hypot(nodes[a][0] - nodes[b][0], nodes[a][1] - nodes[b][1]);
  (adj[a] ??= []).push([b, w, null]);
  (adj[b] ??= []).push([a, w, null]);
}
for (const { a, b, kind } of links) {
  const w = kind === 'stairs' ? STAIRS_COST : ELEVATOR_COST;
  (adj[a] ??= []).push([b, w, kind]);
  (adj[b] ??= []).push([a, w, kind]);
}

// Shortest path by walking distance (Dijkstra). Returns the nodes and how each was reached.
function findPath(from: string, to: string, options: RouteOptions): { node: string; via: Hop[2] }[] {
  const best: Record<string, number> = { [from]: 0 };
  const prev: Record<string, [string, Hop[2]]> = {};
  const todo = new Set([from]);
  while (todo.size) {
    let n = '';
    for (const c of todo) if (n === '' || best[c] < best[n]) n = c;
    todo.delete(n);
    if (n === to) break;
    for (const [m, w, via] of adj[n] ?? []) {
      if (via === 'stairs' && options.avoidStairs) continue;
      if (best[m] === undefined || best[n] + w < best[m]) {
        best[m] = best[n] + w;
        prev[m] = [n, via];
        todo.add(m);
      }
    }
  }
  if (best[to] === undefined) {
    throw new Error(options.avoidStairs
      ? 'No step-free route is available between these locations. Try allowing stairs.'
      : 'No connected route is available between these locations. Choose another location.');
  }
  const path: { node: string; via: Hop[2] }[] = [{ node: to, via: null }];
  while (path[0].node !== from) {
    const [p, via] = prev[path[0].node];
    path[0].via = via;
    path.unshift({ node: p, via: null });
  }
  return path;
}

const sub = (a: Point, b: Point): Point => [a[0] - b[0], a[1] - b[1]];
const dist = (a: Point, b: Point) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const feet = (pts: Point[]) => Math.max(5, Math.round((pts.slice(1).reduce(
  (sum, point, i) => sum + dist(pts[i], point), 0,
) * FEET_PER_PX) / 5) * 5);
// Snap a direction to 0 east, 1 south, 2 west, 3 north. Going up the index is a right turn.
const compass = (v: Point) => (Math.round(Math.atan2(v[1], v[0]) / (Math.PI / 2)) + 4) % 4;
const rel = (from: number, to: number) => (to - from + 4) % 4; // 0 ahead, 1 right, 2 behind, 3 left

// Walking directions along one floor's points. `start` is the first instruction's opening.
function walk(pts: Point[], floor: Floor, start: string): { steps: Step[]; d: number } {
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

  const steps: Step[] = legs.map((leg, i) => {
    const ft = feet(leg.pts);
    if (i === 0) return { turn: 'straight', text: `${start} about ${ft} ft.`, pts: leg.pts, floor };
    const r = rel(legs[i - 1].d, leg.d);
    if (r === 1) return { turn: 'right', text: `Turn right. Walk about ${ft} ft.`, pts: leg.pts, floor };
    if (r === 3) return { turn: 'left', text: `Turn left. Walk about ${ft} ft.`, pts: leg.pts, floor };
    return { turn: 'around', text: `Turn around. Walk about ${ft} ft.`, pts: leg.pts, floor };
  });
  return { steps, d: legs.length ? legs[legs.length - 1].d : 0 };
}

export function getSteps(from: string, to: string, options: RouteOptions = {}): Step[] {
  if (!Object.hasOwn(places, from) || !Object.hasOwn(places, to)) {
    throw new Error('Choose a listed location for both From and To.');
  }
  const [startNode, startDoor] = places[from];
  const [endNode, endDoor] = places[to];
  if (from === to) {
    return [{ turn: 'arrive', text: `You are already at ${to}.`, pts: [startDoor, startDoor], floor: placeFloor[to] }];
  }

  // Split the path into walks on one floor, joined by stairs or elevator rides.
  const path = findPath(startNode, endNode, options);
  const runs: { floor: Floor; pts: Point[]; via: 'stairs' | 'elevator' | null }[] = [];
  for (const { node, via } of path) {
    const p = nodes[node];
    const run = runs[runs.length - 1];
    if (!run || via) {
      // A ride that passes through a floor without walking on it is one ride.
      if (run && run.via && run.pts.length === 1 && via === run.via) runs.pop();
      runs.push({ floor: floorOf[node], pts: run ? [p] : [startDoor, p], via });
      continue;
    }
    const last = run.pts[run.pts.length - 1];
    if (p[0] !== last[0] || p[1] !== last[1]) run.pts.push(p);
  }

  const lastRun = runs[runs.length - 1];
  if (lastRun.pts.length < 2) lastRun.pts.push(endDoor);

  const steps: Step[] = [];
  let heading = 0;
  runs.forEach((run, i) => {
    if (run.via) {
      const prev = steps.length ? steps[steps.length - 1].pts.at(-1)! : startDoor;
      const up = floorLevel(run.floor) > floorLevel(runs[i - 1].floor);
      const kind = run.via === 'stairs' ? 'stairs' : 'elevator';
      steps.push({
        turn: up ? 'up' : 'down',
        text: `Take the ${kind} ${up ? 'up' : 'down'} to ${floorName(run.floor)}.`,
        pts: [prev, run.pts[0]],
        floor: run.floor,
      });
    }
    const opening = i > 0 ? `Leave the ${run.via} and walk`
      : from === 'Main Entrance' ? 'Walk straight ahead for' : `Exit ${from} and walk`;
    const walked = walk(run.pts, run.floor, opening);
    steps.push(...walked.steps);
    if (walked.steps.length) heading = walked.d;
  });

  const end = steps.length ? steps[steps.length - 1].pts.at(-1)! : startDoor;
  const toDoor = sub(endDoor, end);
  const r = dist(endDoor, end) === 0 ? 0 : rel(heading, compass(toDoor));
  const where = ['straight ahead', 'on your right', 'behind you', 'on your left'][r];
  steps.push({ turn: 'arrive', text: `${to} is ${where}. You have arrived.`, pts: [end, endDoor], floor: placeFloor[to] });

  return steps;
}
