import { describe, expect, it } from 'vitest';
import { edges, nodes, places } from './map-data';
import { getSteps } from './route';
import type { Point } from './route';

const length = (points: Point[]) => points.slice(1).reduce((sum, point, i) =>
  sum + Math.hypot(point[0] - points[i][0], point[1] - points[i][1]), 0);

describe('walking directions', () => {
  it('preserves the hallway corner immediately outside A112', () => {
    const steps = getSteps('A112', 'F125');
    expect(steps[0].pts).toEqual([[580, 1406], [522, 1406]]);
    expect(steps[1]).toMatchObject({ turn: 'right' });
    expect(steps[1].pts[0]).toEqual([522, 1406]);
  });

  it('keeps short hallway points on the route instead of cutting diagonally', () => {
    const points = getSteps('K132', 'K134').flatMap(step => step.pts);
    expect(points).toContainEqual([1216, 45]);
    expect(points).toContainEqual([1216, 44]);
  });

  it('reports distances as estimates', () => {
    const walking = getSteps('Main Entrance', 'F125').slice(0, -1);
    expect(walking.every(step => step.text.includes('about'))).toBe(true);
  });

  it('returns only arrival when already at the destination', () => {
    expect(getSteps('A170A', 'A170A')).toEqual([
      { turn: 'arrive', text: 'You are already at A170A.', pts: [places.A170A[1], places.A170A[1]] },
    ]);
  });

  it.each([['Unknown', 'A112'], ['A112', 'Unknown'], ['__proto__', 'A112']])(
    'rejects an unknown endpoint: %s to %s', (from, to) => {
      expect(() => getSteps(from, to)).toThrow('Choose a listed location');
    },
  );

  it('preserves connected shortest hallway geometry to every listed destination', () => {
    // An independent distance oracle over the supplied map, before adding room doors.
    const best: Record<string, number> = { [places['Main Entrance'][0]]: 0 };
    const pending = new Set(Object.keys(nodes));
    while (pending.size) {
      const current = [...pending].reduce((a, b) =>
        (best[a] ?? Infinity) < (best[b] ?? Infinity) ? a : b);
      pending.delete(current);
      for (const [a, b] of edges) {
        const next = a === current ? b : b === current ? a : null;
        if (!next || !pending.has(next)) continue;
        const candidate = best[current] + length([nodes[current], nodes[next]]);
        if (candidate < (best[next] ?? Infinity)) best[next] = candidate;
      }
    }

    for (const [name, [node, door]] of Object.entries(places)) {
      if (name === 'Main Entrance') continue;
      const steps = getSteps('Main Entrance', name);
      const expected = best[node] + length([places['Main Entrance'][1], nodes[places['Main Entrance'][0]]])
        + length([nodes[node], door]);
      expect(steps.reduce((sum, step) => sum + length(step.pts), 0), name).toBeCloseTo(expected, 6);
      expect(steps.at(-1)?.pts.at(-1), name).toEqual(door);
      for (let i = 1; i < steps.length; i++) {
        expect(steps[i].pts[0], name).toEqual(steps[i - 1].pts.at(-1));
      }
    }
  });
});
