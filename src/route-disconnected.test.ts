import { expect, it, vi } from 'vitest';
import { getSteps } from './route';

vi.mock('./map-data', () => ({
  nodes: { a: [0, 0], b: [100, 0], c: [200, 0] },
  edges: [['a', 'b']],
  places: { Start: ['a', [0, 0]], Disconnected: ['c', [200, 0]] },
}));

it('rejects disconnected locations instead of looping during path reconstruction', () => {
  expect(() => getSteps('Start', 'Disconnected')).toThrow('No connected route');
});
