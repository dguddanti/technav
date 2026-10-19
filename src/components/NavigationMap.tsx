import type { MouseEvent } from 'react';
import type { Point, Step } from '../route';
import { FLOORS } from '../building';
import { RouteMarker } from './RouteMarker';
import { pathLength } from './routeGeometry';

const W = 1948;
const H = 1904;
const dev = new URLSearchParams(location.search).has('dev');
const vertical = (step: Step) => step.turn === 'up' || step.turn === 'down';

interface NavigationMapProps { steps: Step[]; index: number; from: string; to: string }

export const NavigationMap = ({ steps, index, from, to }: NavigationMapProps) => {
  const step = steps[index];
  let first = index;
  let end = index;
  while (first > 0 && steps[first - 1].floor === step.floor) first--;
  while (end < steps.length - 1 && steps[end + 1].floor === step.floor) end++;
  const here = steps.slice(first, end + 1);
  // A floor transfer starts at its exit; never draw a line between floors.
  const route: Point[] = [vertical(here[0]) ? here[0].pts.at(-1)! : here[0].pts[0],
    ...here.flatMap((s) => vertical(s) ? [] : s.pts.slice(1))];
  const distance = here.slice(0, index - first).reduce(
    (total, s) => total + (vertical(s) ? 0 : pathLength(s.pts)), 0,
  ) + (step.turn === 'arrive' ? pathLength(step.pts) : 0);
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
      {/* Keyed so the previous floor never shows while the next one loads. */}
      <image key={step.floor} href={FLOORS.find((f) => f.id === step.floor)!.image} width={W} height={H} />
      <polyline points={route.map((p) => p.join(',')).join(' ')} className="route" />
      {end === steps.length - 1 && <circle cx={dest[0]} cy={dest[1]} r="22" className="goal" />}
      <RouteMarker key={`${step.floor}-${first}`} points={route} distance={distance} />
    </svg>
  );
};
