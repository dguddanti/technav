import { describe, expect, it } from 'vitest';
import { validateReport } from './validation';
import { photoStations } from '../data/photoStations';
import { floorOf, nodes, edges } from '../building';
import type { ReportDraft } from '../types/reports';
const draft = (patch: Partial<ReportDraft> = {}): ReportDraft => ({ kind: 'map', category: 'wrong_route', floor: '1', point: [100, 100], placeName: '', hallwayNodeId: null, photoStationId: null, mapHeading: null, description: 'The indicated hallway is blocked.', photo: null, context: { floor: '1' }, ...patch });
describe('report validation', () => {
  it('requires an explanation and a valid map location for map issues', () => {
    expect(validateReport(draft())).toBeNull();
    expect(validateReport(draft({ point: [NaN, 10] }))).toMatch(/inside/);
    expect(validateReport(draft({ description: '  ' }))).toMatch(/Describe/);
  });
  it('requires a real room and a hallway on its floor for entrance corrections', () => {
    expect(validateReport(draft({ kind: 'entrance', placeName: 'Not a room' }))).toMatch(/listed room/);
    expect(validateReport(draft({ kind: 'entrance', placeName: 'Main Entrance', hallwayNodeId: Object.keys(nodes).find((id) => floorOf[id] === '2')! }))).toMatch(/connected/);
  });
  it('requires a fixed photo spot, map direction, and supported photo', () => {
    const spot = photoStations.find((s) => s.floor === '1')!;
    const photo = draft({ kind: 'photo', point: spot.point, photoStationId: spot.id, description: '', photo: new File(['photo'], 'hall.jpg', { type: 'image/jpeg' }) });
    expect(validateReport(photo)).toMatch(/direction/);
    expect(validateReport({ ...photo, mapHeading: 0 })).toBeNull();
    expect(validateReport({ ...photo, mapHeading: 90, photo: null })).toMatch(/Add a photo/);
  });
  it('keeps stable photo stations anchored to existing hallway nodes', () => {
    expect(new Set(photoStations.map((s) => s.id)).size).toBe(photoStations.length);
    for (const spot of photoStations) {
      expect(floorOf[spot.hallwayNodeId]).toBe(spot.floor);
      if (!spot.segment) expect(nodes[spot.hallwayNodeId]).toEqual(spot.point);
      else {
        const [a, b] = spot.segment;
        expect(edges.some(([x, y]) => (x === a && y === b) || (x === b && y === a))).toBe(true);
        const length = Math.hypot(nodes[a][0] - nodes[b][0], nodes[a][1] - nodes[b][1]);
        const through = Math.hypot(nodes[a][0] - spot.point[0], nodes[a][1] - spot.point[1]) + Math.hypot(nodes[b][0] - spot.point[0], nodes[b][1] - spot.point[1]);
        expect(Math.abs(length - through)).toBeLessThan(.01);
      }
    }
  });
});
