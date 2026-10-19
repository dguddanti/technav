import { expect, it, vi } from 'vitest';
import { getSteps } from './route';

vi.mock('./building', () => ({
  nodes: { a: [0, 0], b: [100, 0], c: [200, 0], d: [200, 0] },
  edges: [['a', 'b']],
  links: [{ a: 'c', b: 'd', kind: 'stairs', name: 'ST1' }],
  floorOf: { a: '1', b: '1', c: '1', d: '2' },
  places: { Start: ['a', [0, 0]], Disconnected: ['c', [200, 0]], Upstairs: ['d', [200, 0]] },
  placeFloor: { Start: '1', Disconnected: '1', Upstairs: '2' },
  floorName: (floor: string) => `Floor ${floor}`,
  floorLevel: (floor: string) => Number(floor),
  STAIRS_COST: 150,
  ELEVATOR_COST: 250,
}));

it('rejects disconnected locations instead of looping during path reconstruction', () => {
  expect(() => getSteps('Start', 'Disconnected')).toThrow('No connected route');
});

it('explains when only stairs would connect two locations', () => {
  expect(() => getSteps('Disconnected', 'Upstairs', { avoidStairs: true })).toThrow('No step-free route');
  expect(getSteps('Disconnected', 'Upstairs').map((step) => step.turn)).toContain('up');
});
