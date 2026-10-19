import type { Point } from '../route';

export const pathLength = (points: Point[]) => points.slice(1).reduce(
  (total, point, i) => total + Math.hypot(point[0] - points[i][0], point[1] - points[i][1]), 0,
);

export const pointAlongPath = (points: Point[], distance: number): Point => {
  let remaining = Math.max(0, distance);
  for (let i = 1; i < points.length; i++) {
    const [x, y] = points[i - 1];
    const length = Math.hypot(points[i][0] - x, points[i][1] - y);
    if (length && remaining <= length) {
      const t = remaining / length;
      return [x + (points[i][0] - x) * t, y + (points[i][1] - y) * t];
    }
    remaining -= length;
  }
  return points.at(-1)!;
};

