import { afterEach, describe, expect, it } from 'vitest';
import { applyPublishedEntrances, places, placeFloor } from './locations';
import { places as bundled, placeFloor as bundledFloors } from './building';
import { getSteps } from './route';
afterEach(() => applyPublishedEntrances([]));
describe('published entrance routing', () => {
  it('applies approved entrance coordinates to the actual route endpoint and resets removed overrides', () => {
    const name = 'Main Entrance';
    const [hallwayNodeId] = bundled[name];
    applyPublishedEntrances([{ name, floor: bundledFloors[name], hallwayNodeId, x: 123, y: 456, mapVersion: 'tech-v1' }]);
    expect(places[name][1]).toEqual([123, 456]);
    const destination = Object.keys(bundled).find((entry) => entry !== name && bundledFloors[entry] === bundledFloors[name])!;
    const steps = getSteps(destination, name);
    expect(steps.at(-1)!.pts.at(-1)).toEqual([123, 456]);
    applyPublishedEntrances([]);
    expect(places[name]).toEqual(bundled[name]);
  });
  it('adds searchable locations but ignores invalid cross-floor links and corrupt coordinates', () => {
    const [hallwayNodeId] = bundled['Main Entrance'];
    const floor = bundledFloors['Main Entrance'];
    applyPublishedEntrances([{ name: 'New location', floor, hallwayNodeId, x: 100, y: 200, mapVersion: 'tech-v1' }, { name: 'Invalid', floor: floor === '2' ? '1' : '2', hallwayNodeId, x: 100, y: 200, mapVersion: 'tech-v1' }]);
    expect(places['New location']).toEqual([hallwayNodeId, [100, 200]]);
    expect(placeFloor['New location']).toBe(floor);
    expect(places.Invalid).toBeUndefined();
  });
});
