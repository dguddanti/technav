import { useEffect, useRef, useState } from 'react';
import { FLOORS, edges, floorLevel, floorOf, nodes } from '../building';
import type { Floor } from '../building';
import { floorOutlines } from '../data/floorOutlines';
import type { Point, Step } from '../route';
import './FloorTransition.css';

// The product page's axonometric projection, so the ride matches its building model.
const project = ([x, y]: Point, height = 0): Point => [(x - y) * .22, (x + y) * .083 - height];
const xy = (p: Point) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`;
const line = (pts: Point[], height = 0) => pts.map((p, i) => `${i ? 'L' : 'M'}${xy(project(p, height))}`).join('');
const SIDE = 10;
// Plan-space extent once projected: x spans -419..429, y spans 0..320; floor labels sit to the right.
const LEFT = -425;
const WIDTH = 1150;
const SLAB = 340;

// Drawn once per floor at height 0; each slab is lifted with a transform.
const slabs = new Map<Floor, { faces: [string, string]; top: string; corridors: string }>();
const slab = (floor: Floor) => {
  if (!slabs.has(floor)) {
    const faces: [string[], string[]] = [[], []];
    for (const loop of floorOutlines[floor]) loop.forEach((a, i) => {
      const b = loop[(i + 1) % loop.length];
      const pa = project(a);
      const pb = project(b);
      faces[b[0] - a[0] > b[1] - a[1] ? 0 : 1].push(`M${[pa, pb, [pb[0], pb[1] + SIDE], [pa[0], pa[1] + SIDE]].map((p) => xy(p as Point)).join('L')}Z`);
    });
    const corridors = edges.filter(([a]) => floorOf[a] === floor).map(([a, b]) => line([nodes[a], nodes[b]])).join('');
    slabs.set(floor, { faces: [faces[0].join(''), faces[1].join('')], top: floorOutlines[floor].map((loop) => `${line(loop)}Z`).join(''), corridors });
  }
  return slabs.get(floor)!;
};

const easeOut = (t: number) => 1 - (1 - t) ** 3;
const easeInOut = (t: number) => t * t * (3 - 2 * t);
const EXPAND = 550;
const RIDE_START = 450;
const RIDE = 1400;

// The walk on the floor next to a ride, stopping at the ride before or after it.
const walkOn = (steps: Step[], from: number, direction: 1 | -1) => {
  const floor = steps[from].floor;
  const pts: Point[] = [];
  for (let i = from; steps[i] && steps[i].floor === floor && !steps[i].via; i += direction) {
    pts.push(...(direction === 1 ? steps[i].pts : [...steps[i].pts].reverse()));
  }
  return direction === 1 ? pts : pts.reverse();
};

interface FloorTransitionProps { steps: Step[]; index: number }

// A stair or elevator ride, drawn as the floors it passes with a dot moving between them.
export const FloorTransition = ({ steps, index }: FloorTransitionProps) => {
  const step = steps[index];
  const via = step.via!;
  const from = steps[index - 1].floor;
  const to = step.floor;
  const up = floorLevel(to) > floorLevel(from);
  const low = Math.min(floorLevel(from), floorLevel(to));
  const floors = FLOORS.slice(low, Math.max(floorLevel(from), floorLevel(to)) + 1);
  const count = floors.length - 1;
  const before = walkOn(steps, index - 1, -1);
  const after = index + 1 < steps.length ? walkOn(steps, index + 1, 1) : [];

  const stage = useRef<HTMLDivElement>(null);
  const [aspect, setAspect] = useState(1.3);
  const [time, setTime] = useState(0);
  useEffect(() => {
    const node = stage.current;
    if (!node || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => {
      const { width, height } = node.getBoundingClientRect();
      if (width && height) setAspect(height / width);
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    const end = RIDE_START + RIDE;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) { setTime(end); return; }
    const started = performance.now();
    let frame = requestAnimationFrame(function tick(now) {
      const elapsed = Math.min(now - started, end);
      setTime(elapsed);
      if (elapsed < end) frame = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  // Space the floors to fill the stage: tall on a phone, tighter on short screens.
  const gap = Math.min(440, Math.max(80, (WIDTH * aspect - SLAB - 60) / count));
  const spread = .35 + .65 * easeOut(Math.min(time / EXPAND, 1));
  const height = (floor: Floor) => (floorLevel(floor) - low) * gap * spread;
  const ride = easeInOut(Math.min(Math.max((time - RIDE_START) / RIDE, 0), 1));
  const start = project(step.pts[0], height(from));
  const end = project(step.pts.at(-1)!, height(to));
  const dot: Point = [start[0] + (end[0] - start[0]) * ride, start[1] + (end[1] - start[1]) * ride];
  const top = -count * gap - 40;
  const label = project([1948, 0]);
  const name = (floor: Floor) => FLOORS[floorLevel(floor)].name;

  return (
    <section className="floor-transition" aria-label={`${via === 'stairs' ? 'Stairs' : 'Elevator'} from ${name(from)} to ${name(to)}`}>
      <p className="floor-transition-summary">{via === 'stairs' ? 'Stairs' : 'Elevator'}<span>{count} {count === 1 ? 'floor' : 'floors'} {up ? 'up' : 'down'}</span></p>
      <div ref={stage} className="floor-transition-stage">
        <svg viewBox={`${LEFT} ${top} ${WIDTH} ${SLAB - top + 20}`} aria-hidden="true">
          {floors.map(({ id }) => {
            const { faces, top: outline, corridors } = slab(id);
            const role = id === to ? 'is-destination' : id === from ? 'is-origin' : 'is-passed';
            return (
              <g key={id} className={`ride-floor ${role}`} transform={`translate(0 ${-height(id)})`}>
                <path d={faces[0]} className="ride-side" />
                <path d={faces[1]} className="ride-side ride-side--shade" />
                <path d={outline} className="ride-top" fillRule="evenodd" />
                <path d={corridors} className="ride-corridors" />
                {id === from && before.length > 1 && <path d={line(before)} className="ride-route" />}
                {id === to && after.length > 1 && <path d={line(after)} className="ride-route ride-route--next" />}
                <path d={`M${xy(label)}h30`} className="ride-leader" />
                <text x={label[0] + 40} y={label[1] + 12} className="ride-label">{name(id)}</text>
              </g>
            );
          })}
          <path d={`M${xy(start)}L${xy(end)}`} className={`ride-shaft ride-shaft--${via}`} />
          <path d={`M${xy(start)}L${xy(dot)}`} className="ride-travelled" />
          <circle cx={start[0]} cy={start[1]} r="13" className="ride-endpoint" />
          <circle cx={end[0]} cy={end[1]} r="13" className="ride-endpoint" />
          <circle cx={dot[0]} cy={dot[1]} r="24" className="ride-dot" />
        </svg>
      </div>
    </section>
  );
};
