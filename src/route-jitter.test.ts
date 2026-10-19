import { describe, expect, it, vi } from 'vitest';
import { getSteps } from './route';

vi.mock('./map-data', () => ({
  nodes: {
    a: [0, 0], b: [100, 0], jitter: [100, 1], c: [200, 1],
    corner: [100, 24], d: [200, 24],
    x: [300, 300], y: [301, 300], z: [301, 301],
  },
  edges: [['a', 'b'], ['b', 'jitter'], ['jitter', 'c'], ['b', 'corner'], ['corner', 'd'], ['x', 'y'], ['y', 'z']],
  places: {
    Start: ['a', [0, 0]], InitialJitter: ['a', [0, 1]], End: ['c', [210, 1]],
    TrailingJitter: ['jitter', [110, 1]], RealCorner: ['d', [210, 24]],
    TinyStart: ['x', [300, 300]], TinyEnd: ['z', [301, 302]],
  },
}));

describe('instruction noise', () => {
  it('keeps a one-pixel offset in a straight route without adding two turns', () => {
    const steps = getSteps('Start', 'End');
    expect(steps.map(step => step.turn)).toEqual(['straight', 'arrive']);
    expect(steps[0].pts).toEqual([[0, 0], [100, 0], [100, 1], [200, 1]]);
  });

  it('uses the first meaningful direction after initial coordinate noise', () => {
    const steps = getSteps('InitialJitter', 'End');
    expect(steps.map(step => step.turn)).toEqual(['straight', 'arrive']);
    expect(steps[0].pts[0]).toEqual([0, 1]);
    expect(steps[0].pts[1]).toEqual([0, 0]);
  });

  it('uses the last meaningful direction for arrival after trailing noise', () => {
    const steps = getSteps('Start', 'TrailingJitter');
    expect(steps.map(step => step.turn)).toEqual(['straight', 'arrive']);
    expect(steps[1].text).toBe('TrailingJitter is straight ahead. You have arrived.');
  });

  it('preserves a real 24-pixel corner and both turn instructions', () => {
    const steps = getSteps('Start', 'RealCorner');
    expect(steps.map(step => step.turn)).toEqual(['straight', 'right', 'left', 'arrive']);
    expect(steps[1].pts).toEqual([[100, 0], [100, 24]]);
  });

  it('avoids an invented five-foot instruction on a route made only of tiny segments', () => {
    const steps = getSteps('TinyStart', 'TinyEnd');
    expect(steps.map(step => step.turn)).toEqual(['straight', 'arrive']);
    expect(steps[0].text).toBe('Exit TinyStart and walk a short distance.');
    expect(steps[0].pts).toEqual([[300, 300], [301, 300], [301, 301]]);
  });
});
