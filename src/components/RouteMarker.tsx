import { useEffect, useRef, useState } from 'react';
import type { Point } from '../route';
import { pointAlongPath } from './routeGeometry';

// Figma's ease-in-out curve: cubic-bezier(.42, 0, .58, 1).
const ease = (progress: number) => {
  let low = 0;
  let high = 1;
  for (let i = 0; i < 16; i++) {
    const t = (low + high) / 2;
    const x = 3 * (1 - t) ** 2 * t * .42 + 3 * (1 - t) * t ** 2 * .58 + t ** 3;
    if (x < progress) low = t;
    else high = t;
  }
  const t = (low + high) / 2;
  return 3 * (1 - t) * t ** 2 + t ** 3;
};

interface RouteMarkerProps { points: Point[]; distance: number }

export const RouteMarker = ({ points, distance }: RouteMarkerProps) => {
  const circle = useRef<SVGCircleElement>(null);
  const current = useRef(distance);
  const [initial] = useState(() => pointAlongPath(points, distance));
  // A serialized path keeps an ongoing transition intact on unrelated renders.
  const path = JSON.stringify(points);
  useEffect(() => {
    const route: Point[] = JSON.parse(path);
    const start = current.current;
    const started = performance.now();
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    let frame = 0;
    const draw = (value: number) => {
      current.current = value;
      const [x, y] = pointAlongPath(route, value);
      circle.current?.setAttribute('cx', String(x));
      circle.current?.setAttribute('cy', String(y));
    };
    const tick = (now: number) => {
      const progress = Math.min(1, Math.max(0, (now - started) / 650));
      draw(progress === 1 ? distance : start + (distance - start) * ease(progress));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    const respectPreference = () => {
      if (reduced?.matches) { cancelAnimationFrame(frame); draw(distance); }
    };
    if (reduced?.matches || start === distance) draw(distance);
    else frame = requestAnimationFrame(tick);
    reduced?.addEventListener('change', respectPreference);
    return () => {
      cancelAnimationFrame(frame);
      reduced?.removeEventListener('change', respectPreference);
    };
  }, [distance, path]);
  return <circle ref={circle} cx={initial[0]} cy={initial[1]} r="18" className="you" />;
};
