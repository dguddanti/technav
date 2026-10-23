import { photoStations } from '../data/photoStations';
import type { MapHeading, PhotoStation } from '../types/reports';
import type { Point, Step } from '../route';

export interface RoutePhotoPosition { station: PhotoStation; heading: MapHeading; distance: number }
export const headingForVector = (a: Point, b: Point): MapHeading => ((Math.round(Math.atan2(b[0] - a[0], a[1] - b[1]) / (Math.PI / 2)) + 4) % 4 * 90) as MapHeading;
export const photoPositionsForStep = (step: Step, stations = photoStations): RoutePhotoPosition[] => {
  const path = step.turn === 'up' || step.turn === 'down' ? [step.pts.at(-1)!] : step.pts;
  const matches: RoutePhotoPosition[] = [];
  for (const station of stations) {
    if (station.floor !== step.floor) continue;
    let progress = 0; let closest = Infinity; let match: RoutePhotoPosition | null = null;
    if (path.length === 1 && Math.hypot(station.point[0] - path[0][0], station.point[1] - path[0][1]) <= 1) match = { station, heading: 0, distance: 0 };
    for (let i = 1; i < path.length; i++) {
      const a = path[i - 1], b = path[i], dx = b[0] - a[0], dy = b[1] - a[1], length = Math.hypot(dx, dy);
      if (!length) continue;
      const t = Math.max(0, Math.min(1, ((station.point[0] - a[0]) * dx + (station.point[1] - a[1]) * dy) / length ** 2));
      const offset = Math.hypot(station.point[0] - a[0] - t * dx, station.point[1] - a[1] - t * dy);
      if (offset <= 1 && (offset < closest || (Math.abs(offset - closest) < .001 && t < 1))) { closest = offset; match = { station, heading: headingForVector(a, b), distance: progress + t * length }; }
      progress += length;
    }
    if (match) matches.push(match);
  }
  // Nearby parallel corridors across walls are deliberately excluded. These are
  // capture positions on this instruction's path, not live location tracking.
  const seen = new Set<string>();
  return matches.sort((a, b) => a.distance - b.distance).filter(({ station }) => {
    const key = station.point.join(','); if (seen.has(key)) return false; seen.add(key); return true;
  });
};
