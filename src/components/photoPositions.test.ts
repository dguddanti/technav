import { describe, expect, it } from 'vitest';
import { photoPositionsForStep, headingForVector } from './photoPositions';
import type { PhotoStation } from '../types/reports';
const station = (id: string, point: [number, number], floor: PhotoStation['floor'] = '1'): PhotoStation => ({ id, point, floor, hallwayNodeId: '1:n0', label: id });
describe('route capture positions', () => {
  it('orders positions along the path and excludes parallel corridors and other floors', () => {
    const result = photoPositionsForStep({ floor: '1', pts: [[0, 0], [100, 0], [100, 100]], turn: 'straight', text: '' }, [station('end', [100, 90]), station('start', [20, 0]), station('wrong corridor', [50, 20]), station('thin wall', [50, 4]), station('other floor', [40, 0], '2')]);
    expect(result.map((entry) => entry.station.id)).toEqual(['start', 'end']);
    expect(result.map((entry) => entry.heading)).toEqual([90, 180]);
  });
  it('faces out of a corner rather than back along the incoming segment', () => {
    const result = photoPositionsForStep({ floor: '1', pts: [[0, 0], [100, 0], [100, 100]], turn: 'straight', text: '' }, [station('corner', [100, 0])]);
    expect(result[0].heading).toBe(180);
  });
  it('uses only the destination floor exit for floor transfers', () => {
    const result = photoPositionsForStep({ floor: '2', pts: [[0, 0], [100, 100]], turn: 'up', text: '' }, [station('lower floor', [0, 0]), station('exit', [100, 100], '2')]);
    expect(result.map((entry) => entry.station.id)).toEqual(['exit']);
  });
  it('expresses headings relative to the floor plan', () => {
    expect(headingForVector([0, 0], [0, -20])).toBe(0);
    expect(headingForVector([0, 0], [-20, 0])).toBe(270);
  });
});
