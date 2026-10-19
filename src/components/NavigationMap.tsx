import type { MouseEvent } from 'react';
import type { Point, Step } from '../route';
import { RouteMarker } from './RouteMarker';
import { pathLength } from './routeGeometry';

const W = 1948;
const H = 1904;
const dev = new URLSearchParams(location.search).has('dev');

interface NavigationMapProps { steps: Step[]; index: number; from: string; to: string }

export const NavigationMap = ({ steps, index, from, to }: NavigationMapProps) => {
  const route: Point[] = [steps[0].pts[0], ...steps.flatMap((step) => step.pts.slice(1))];
  const distance = steps.slice(0, index).reduce((total, step) => total + pathLength(step.pts), 0)
    + (steps[index].turn === 'arrive' ? pathLength(steps[index].pts) : 0);
  const xs = route.map((p) => p[0]);
  const ys = route.map((p) => p[1]);
  const w = Math.max(Math.max(...xs) - Math.min(...xs) + 400, 700);
  const h = Math.max(Math.max(...ys) - Math.min(...ys) + 400, 500);
  const cx = (Math.max(...xs) + Math.min(...xs)) / 2;
  const cy = (Math.max(...ys) + Math.min(...ys)) / 2;
  const viewBox = dev ? `0 0 ${W} ${H}` : `${cx - w / 2} ${cy - h / 2} ${w} ${h}`;
  const dest = route.at(-1)!;
  const logPoint = (event: MouseEvent<SVGSVGElement>) => {
    if (!dev) return;
    const svg = event.currentTarget;
    const ctm = svg.getScreenCTM();
    if (!ctm) return;
    const p = svg.createSVGPoint();
    p.x = event.clientX;
    p.y = event.clientY;
    const { x, y } = p.matrixTransform(ctm.inverse());
    console.log(Math.round(x), Math.round(y));
  };
  return (
    <svg className="map" viewBox={viewBox} onClick={logPoint} role="img" aria-labelledby="map-title">
      <title id="map-title">Route from {from} to {to}</title>
      <image href="/map.png" width={W} height={H} />
      <polyline points={route.map((p) => p.join(',')).join(' ')} className="route" />
      <circle cx={dest[0]} cy={dest[1]} r="22" className="goal" />
      <RouteMarker points={route} distance={distance} />
    </svg>
  );
};
