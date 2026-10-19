import { useRef, useState } from 'react';
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
  const [error, setError] = useState('');
  const [showOverview, setShowOverview] = useState(false);
  const overviewToggle = useRef<HTMLButtonElement>(null);

  // Match what was typed to a place, ignoring case.
  const find = (s: string) => names.find((n) => n.toLowerCase() === s.trim().toLowerCase());
  const a = find(from);
  const b = find(to);

  if (!steps) {
    return (
      <main>
        <h1>TechNav</h1>
        <p id="scope" className="hint">First-floor prototype. Distances are estimates.</p>
        <form className="route-form" onSubmit={(event) => {
          event.preventDefault();
          if (!a || !b || a === b) return;
          try {
            setSteps(getSteps(a, b));
            setI(0);
            setShowOverview(false);
            setError('');
          } catch (cause) {
            setError(cause instanceof Error ? cause.message : 'Unable to plan this route. Choose another location.');
          }
        }}>
        <label htmlFor="from">From</label>
        <input id="from" list="places" value={from} placeholder="Room, e.g. A112" aria-describedby="scope validation" onChange={(e) => { setFrom(e.target.value); setError(''); }} />
        <label htmlFor="to">To</label>
        <input id="to" list="places" value={to} placeholder="Room, e.g. F125" aria-describedby="scope validation" onChange={(e) => { setTo(e.target.value); setError(''); }} />
        <datalist id="places">
          {names.map((n) => <option key={n} value={n} />)}
        </datalist>
        <p id="validation" className="hint" aria-live="polite">
          {(from.trim() && !a) || (to.trim() && !b)
            ? 'Choose a listed first-floor location for both From and To.'
            : a && a === b ? 'Choose a different destination.' : ''}
        </p>
        {error && <p role="alert" className="error">{error}</p>}
        <button
          type="submit"
          className="primary"
          disabled={!a || !b || a === b}
        >
          Get Directions
        </button>
        </form>
      </main>
    );
  }

  const step = steps[i];
  const last = i === steps.length - 1;

  // The whole route, so the map stays put while the steps change.
  const route = [steps[0].pts[0], ...steps.flatMap((s) => s.pts.slice(1))];
  const xs = route.map((p) => p[0]);
  const ys = route.map((p) => p[1]);
  const pad = 200;
  const w = Math.max(Math.max(...xs) - Math.min(...xs) + 2 * pad, 700);
  const h = Math.max(Math.max(...ys) - Math.min(...ys) + 2 * pad, 500);
  const cx = (Math.max(...xs) + Math.min(...xs)) / 2;
  const cy = (Math.max(...ys) + Math.min(...ys)) / 2;
  const viewBox = dev ? `0 0 ${W} ${H}` : `${cx - w / 2} ${cy - h / 2} ${w} ${h}`;
  const toPoints = (pts: Point[]) => pts.map((p) => p.join(',')).join(' ');
  const dest = route[route.length - 1];
  const you = last ? dest : step.pts[0];

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
      <progress className="bar" value={i + 1} max={steps.length} aria-label="Route progress" />
      <p className="hint">Distances are estimates. Use Next as you reach each step.</p>

      <button
        ref={overviewToggle}
        className="overview-toggle"
        aria-expanded={showOverview}
        aria-controls="route-content"
        onClick={() => setShowOverview(!showOverview)}
      >
        {showOverview ? 'Back to map' : 'View all steps'}
      </button>

      <div id="route-content" className="route-content">
      {showOverview ? (
        <section className="overview" aria-labelledby="overview-title">
          <h2 id="overview-title">All directions</h2>
          <ol>
            {steps.map((instruction, index) => (
              <li key={index}>
                <button
                  className="overview-step"
                  aria-label={`Step ${index + 1}: ${instruction.text}`}
                  aria-current={index === i ? 'step' : undefined}
                  onClick={() => {
                    setI(index);
                    setShowOverview(false);
                    overviewToggle.current?.focus();
                  }}
                >
                  <span className="step-number" aria-hidden="true">{index + 1}</span>
                  <span>{instruction.text}</span>
                  {index === i && <span className="current-step">Current</span>}
                </button>
              </li>
            ))}
          </ol>
        </section>
      ) : (
      <>
      <svg className="map" viewBox={viewBox} onClick={logPoint} role="img" aria-labelledby="map-title">
        <title id="map-title">First-floor route from {a} to {b}</title>
        <image href="/map.png" width={W} height={H} />
        <polyline points={toPoints(route)} className="route" />
        <polyline points={toPoints(step.pts)} className="path" />
        <circle cx={you[0]} cy={you[1]} r="18" className="you" />
        <circle cx={dest[0]} cy={dest[1]} r="22" className="goal" />
      </svg>

      <div className="card" aria-live="polite" aria-atomic="true">
        <div className="arrow" aria-hidden="true">{ARROWS[step.turn]}</div>
        <p>{step.text}</p>
      </div>

      <div className="nav">
        <button disabled={i === 0} onClick={() => setI(i - 1)}>Back</button>
        <button className="primary" onClick={() => (last ? setSteps(null) : setI(i + 1))}>
          {last ? 'Done' : 'Next'}
        </button>
      </div>
      </>
      )}
      </div>
    </main>
  );
}
