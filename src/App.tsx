import { useState } from 'react';
import type { MouseEvent } from 'react';
import { places, getSteps } from './route';
import type { Point, Step, Turn } from './route';
import './App.css';

const W = 1948;
const H = 1904;
const ARROWS: Record<Turn, string> = { straight: '↑', left: '←', right: '→', around: '↩', arrive: '✓' };
const dev = new URLSearchParams(location.search).has('dev');
const names = Object.keys(places);

export default function App() {
  const [from, setFrom] = useState('Main Entrance');
  const [to, setTo] = useState('');
  const [steps, setSteps] = useState<Step[] | null>(null);
  const [i, setI] = useState(0);

  // Match what was typed to a place, ignoring case.
  const find = (s: string) => names.find((n) => n.toLowerCase() === s.trim().toLowerCase());
  const a = find(from);
  const b = find(to);

  if (!steps) {
    return (
      <main>
        <h1>TechNav</h1>
        <label>From</label>
        <input list="places" value={from} placeholder="Room, e.g. A112" onChange={(e) => setFrom(e.target.value)} />
        <label>To</label>
        <input list="places" value={to} placeholder="Room, e.g. F125" onChange={(e) => setTo(e.target.value)} />
        <datalist id="places">
          {names.map((n) => <option key={n} value={n} />)}
        </datalist>
        <button
          className="primary"
          disabled={!a || !b || a === b}
          onClick={() => { setSteps(getSteps(a!, b!)); setI(0); }}
        >
          Get Directions
        </button>
      </main>
    );
  }

  const step = steps[i];
  const last = i === steps.length - 1;

  // The whole route, so the map stays put while the steps change.
  const route = [steps[0].pts[0], ...steps.map((s) => s.pts[1])];
  const xs = route.map((p) => p[0]);
  const ys = route.map((p) => p[1]);
  const pad = 200;
  const w = Math.max(Math.max(...xs) - Math.min(...xs) + 2 * pad, 700);
  const h = Math.max(Math.max(...ys) - Math.min(...ys) + 2 * pad, 500);
  const cx = (Math.max(...xs) + Math.min(...xs)) / 2;
  const cy = (Math.max(...ys) + Math.min(...ys)) / 2;
  const viewBox = dev ? `0 0 ${W} ${H}` : `${cx - w / 2} ${cy - h / 2} ${w} ${h}`;
  const toPoints = (pts: Point[]) => pts.map((p) => p.join(',')).join(' ');
  const you = step.pts[0];
  const dest = route[route.length - 1];

  // Add ?dev to the URL, then tap the map to log coordinates for new waypoints.
  const logPoint = (e: MouseEvent<SVGSVGElement>) => {
    if (!dev) return;
    const svg = e.currentTarget;
    const ctm = svg.getScreenCTM();
    if (!ctm) return;
    const p = svg.createSVGPoint();
    p.x = e.clientX;
    p.y = e.clientY;
    const { x, y } = p.matrixTransform(ctm.inverse());
    console.log(Math.round(x), Math.round(y));
  };

  return (
    <main>
      <header>
        <button onClick={() => setSteps(null)}>‹ {a} to {b}</button>
        <span>Step {i + 1} of {steps.length}</span>
      </header>
      <div className="bar"><div style={{ width: `${((i + 1) / steps.length) * 100}%` }} /></div>

      <svg className="map" viewBox={viewBox} onClick={logPoint}>
        <image href="/map.png" width={W} height={H} />
        <polyline points={toPoints(route)} className="route" />
        <polyline points={toPoints(step.pts)} className="path" />
        <circle cx={you[0]} cy={you[1]} r="18" className="you" />
        <circle cx={dest[0]} cy={dest[1]} r="22" className="goal" />
      </svg>

      <div className="card">
        <div className="arrow">{ARROWS[step.turn]}</div>
        <p>{step.text}</p>
      </div>

      <div className="nav">
        <button disabled={i === 0} onClick={() => setI(i - 1)}>Back</button>
        <button className="primary" onClick={() => (last ? setSteps(null) : setI(i + 1))}>
          {last ? 'Done' : 'Next'}
        </button>
      </div>
    </main>
  );
}
