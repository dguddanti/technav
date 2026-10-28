import { describe, expect, it } from 'vitest';
import { FLOORS, links, placeFloor, places } from './building';
import { getSteps, nearestRestroom } from './route';
import { restrooms } from './data/restrooms';

describe('routes between floors', () => {
  it('lists rooms on every floor', () => {
    for (const { id } of FLOORS) {
      expect(Object.values(placeFloor).filter((floor) => floor === id).length, id).toBeGreaterThan(50);
    }
  });

  it('connects every floor to the one above it', () => {
    for (let i = 1; i < FLOORS.length; i++) {
      const [below, above] = [FLOORS[i - 1].id, FLOORS[i].id];
      expect(links.some(({ a, b }) => a.startsWith(`${below}:`) && b.startsWith(`${above}:`)), above).toBe(true);
    }
  });

  it('climbs to another floor with a continuous path', () => {
    const steps = getSteps('Main Entrance', 'L361');
    const ride = steps.findIndex((step) => step.turn === 'up');
    expect(steps[ride].text).toMatch(/^Take the (stairs|elevator) up to Floor 3\.$/);
    expect(steps.slice(0, ride).every((step) => step.floor === '1')).toBe(true);
    expect(steps.slice(ride).every((step) => step.floor === '3')).toBe(true);
    for (let i = 1; i < steps.length; i++) expect(steps[i].pts[0]).toEqual(steps[i - 1].pts.at(-1));
    expect(steps.at(-1)).toMatchObject({ turn: 'arrive', pts: [expect.anything(), places.L361[1]] });
  });

  it('goes down to the basement', () => {
    const steps = getSteps('Main Entrance', 'KB34');
    expect(steps.some((step) => step.turn === 'down' && step.text.endsWith('to Basement.'))).toBe(true);
    expect(steps.at(-1)?.floor).toBe('B');
  });

  it('reaches the ground floor between the basement and Floor 1', () => {
    expect(placeFloor.NG47).toBe('G');
    const steps = getSteps('Main Entrance', 'NG47');
    expect(steps.some((step) => step.turn === 'down' && step.text.endsWith('to Ground floor.'))).toBe(true);
    expect(steps.at(-1)?.floor).toBe('G');
  });

  it('uses only elevators for a step-free route', () => {
    const steps = getSteps('A112', 'M445', { avoidStairs: true });
    const rides = steps.filter((step) => step.turn === 'up' || step.turn === 'down');
    expect(rides.length).toBeGreaterThan(0);
    expect(rides.every((step) => step.text.includes('elevator'))).toBe(true);
  });

  it('keeps a same-floor trip on that floor', () => {
    expect(getSteps('A112', 'F125').every((step) => step.floor === '1')).toBe(true);
    expect(getSteps('A263', 'F263').every((step) => step.floor === '2')).toBe(true);
  });

  it('reaches almost every listed room from the main entrance', () => {
    const unreachable = Object.keys(places).filter((name) => {
      try {
        getSteps('Main Entrance', name);
        return false;
      } catch {
        return true;
      }
    });
    expect(unreachable.length).toBeLessThanOrEqual(3);
  }, 30000);

  it('finds the nearest restroom, on another floor when needed', () => {
    for (const name of restrooms) expect(places, name).toHaveProperty(name);
    expect(['E131', 'E147']).toContain(nearestRestroom('E149'));
    const fromBasement = nearestRestroom('KB34')!;
    expect(restrooms.has(fromBasement)).toBe(true);
    expect(placeFloor[fromBasement]).not.toBe('B');
    expect(getSteps('KB34', fromBasement).at(-1)!.turn).toBe('arrive');
  });
});
