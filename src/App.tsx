import { lazy, Suspense, useRef, useState, useSyncExternalStore } from 'react';
import { places, getSteps } from './route';
import type { Step } from './route';
import { FLOORS, floorName } from './building';
import { NavigationMap } from './components/NavigationMap';
const NavigationViews = lazy(() => import('./components/NavigationViews').then((module) => ({ default: module.NavigationViews })));
import { Button } from './components/ui/Button';
import { Combobox } from './components/ui/Combobox';
import { Message } from './components/ui/Message';
const ReportDialog = lazy(() => import('./reports/ReportDialog').then((module) => ({ default: module.ReportDialog })));

import type { ReportContext } from './types/reports';
import './App.css';
import './feedback/feedback.css';
const FeedbackDialog = lazy(() => import('./feedback/FeedbackDialog').then((module) => ({ default: module.FeedbackDialog })));

import { placeFloor, locationRevision, subscribeLocations } from './locations';

const ReportButton = ({ onClick }: { onClick: () => void }) => <button type="button" className="report-trigger" aria-label="Report an issue" onClick={onClick}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 21V3m0 1c5-4 9 4 14 0v10c-5 4-9-4-14 0" /></svg><span>Report</span></button>;

const instructionLabel = (step: Step) => {
  if (step.turn === 'left') return 'Turn left';
  if (step.turn === 'right') return 'Turn right';
  if (step.turn === 'around') return 'Turn around';
  if (step.turn !== 'straight') return step.text;
  if (step.text.startsWith('Exit ') || step.text.startsWith('Leave ')) return step.text.split(' and ')[0];
  return 'Continue straight';
};

export default function App() {
  useSyncExternalStore(subscribeLocations, locationRevision);
  const names = Object.keys(places);
  const [from, setFrom] = useState('Main Entrance');
  const [to, setTo] = useState('');
  const [steps, setSteps] = useState<Step[] | null>(null);
  const [i, setI] = useState(0);
  const [error, setError] = useState('');
  const [reportContext, setReportContext] = useState<ReportContext | null>(null);
  const [showFeedback, setShowFeedback] = useState(false);
  const [avoidStairs, setAvoidStairs] = useState(false);
  const [showOverview, setShowOverview] = useState(false);
  const overviewToggle = useRef<HTMLButtonElement>(null);

  // Match what was typed to a place, ignoring case.
  const find = (s: string) => names.find((n) => n.toLowerCase() === s.trim().toLowerCase());
  const a = find(from);
  const b = find(to);

  if (!steps) {
    return (
      <><main className="planner">
        <header className="planner-header">
          <h1>TechNav</h1>
          <ReportButton onClick={() => setReportContext({ floor: a ? placeFloor[a] : '1', point: a ? places[a][1] : undefined })} />
        </header>
        <form className="route-form" onSubmit={(event) => {
          event.preventDefault();
          if (!a || !b || a === b) return;
          try {
            const planned = getSteps(a, b, { avoidStairs });
            // Fetch this route's floor plans now so switching floors does not wait on them.
            for (const f of FLOORS) if (planned.some((s) => s.floor === f.id)) new Image().src = f.image;
            setSteps(planned);
            setI(0);
            setShowOverview(false);
            setError('');
          } catch (cause) {
            setError(cause instanceof Error ? cause.message : 'Unable to plan this route. Choose another location.');
          }
        }}>
        <h2 className="form-title">Directions</h2>
        <div className="route-fields">
          <Combobox id="from" label="From" value={from} options={names}
            placeholder="Search location" describedBy="validation" invalid={!!from.trim() && !a}
            onChange={(value) => { setFrom(value); setError(''); }} />
          <Combobox id="to" label="To" value={to} options={names}
            placeholder="Search location" describedBy="validation" invalid={(!!to.trim() && !b) || (!!a && a === b)}
            onChange={(value) => { setTo(value); setError(''); }} />
        </div>
        <label className="route-option">
          <input type="checkbox" checked={avoidStairs}
            onChange={(e) => { setAvoidStairs(e.target.checked); setError(''); }} />
          Step-free route (elevators only)
        </label>
        <Message id="validation" aria-live="polite">
          {(from.trim() && !a) || (to.trim() && !b)
            ? 'Choose a listed location for both From and To.'
            : a && a === b ? 'Choose a different destination.' : ''}
        </Message>
        {error && <Message role="alert" tone="error">{error}</Message>}
        <Button
          type="submit"
          variant="primary"
          className="route-submit"
          disabled={!a || !b || a === b}
        >
          <span>Get Directions</span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12h16m-6-6 6 6-6 6" /></svg>
        </Button>
        </form>
        <footer className="planner-footer"><button type="button" onClick={() => setShowFeedback(true)}>Feedback</button></footer>
      </main>{reportContext && <Suspense fallback={null}><ReportDialog context={reportContext} onClose={() => setReportContext(null)} /></Suspense>}{showFeedback && <Suspense fallback={null}><FeedbackDialog onClose={() => setShowFeedback(false)} /></Suspense>}</>
    );
  }

  const step = steps[i];
  const last = i === steps.length - 1;

  return (
    <><main className="navigation">
      <header className="navigation-header">
        <Button variant="text" className="route-back" aria-label="Edit route" onClick={() => setSteps(null)}>
          <img src="/icons/back.svg" width="24" height="24" alt="" />
          <span className="route-endpoints"><strong>{b}</strong></span>
        </Button>
        <div className="navigation-header-actions">
        <ReportButton onClick={() => setReportContext({ floor: step.floor, point: step.turn === 'up' || step.turn === 'down' ? step.pts.at(-1)! : step.pts[0], from: a, to: b, stepIndex: i, stepText: step.text })} />
      <button
        ref={overviewToggle}
        type="button"
        className="overview-icon"
        aria-label={showOverview ? 'Back to map' : 'View all steps'}
        title={showOverview ? 'Back to map' : 'View all steps'}
        aria-expanded={showOverview}
        aria-controls="route-content"
        onClick={() => setShowOverview(!showOverview)}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d={showOverview ? 'm3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3Zm6-3v15m6-12v15' : 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01'} /></svg>
      </button>
        </div>
      </header>
      <div className="route-progress">
        <p className="eyebrow">Step {i + 1} of {steps.length} · {floorName(step.floor)}</p>
        <progress className="bar" value={i + 1} max={steps.length} aria-label="Route progress" />
      </div>


      <div id="route-content" className="route-content">
      {showOverview && (
        <section className="overview" aria-labelledby="overview-title">
          <h2 id="overview-title">All directions</h2>
          <ol>
            {steps.map((instruction, index) => (
              <li key={index}>
                <button
                  type="button"
                  className="overview-step"
                  aria-label={`Step ${index + 1}: ${instructionLabel(instruction)}`}
                  aria-current={index === i ? 'step' : undefined}
                  onClick={() => {
                    setI(index);
                    setShowOverview(false);
                    overviewToggle.current?.focus();
                  }}
                >
                  <span className="step-number" aria-hidden="true">{index + 1}</span>
                  <span>{instructionLabel(instruction)}</span>
                  {index === i && <span className="current-step">Current</span>}
                </button>
              </li>
            ))}
          </ol>
        </section>
      )}
      <div className="active-directions" hidden={showOverview}>
      <Suspense fallback={<NavigationMap steps={steps} index={i} from={a!} to={b!} />}><NavigationViews steps={steps} index={i} from={a!} to={b!} onAddPhoto={setReportContext} /></Suspense>
      <div className="card" aria-live="polite" aria-atomic="true">
        <span className={`direction-icon direction-icon--${step.turn}`} aria-hidden="true">
          {step.turn === 'arrive' ? <svg viewBox="0 0 32 32"><path d="m7 16 6 6L25 9" /></svg>
            : step.turn === 'around' ? <svg viewBox="0 0 32 32"><path d="M23 25V13a8 8 0 0 0-16 0v9m-5-5 5 5 5-5" /></svg>
              : <img src="/icons/straight.svg" width="32" height="32" alt="" />}
        </span>
        <div className="instruction">
          <div>
            <h2>{step.turn === 'arrive' ? 'You have arrived' : instructionLabel(step)}</h2>
            {step.turn === 'arrive' && <p>{`${b} · ${step.text.split('. You')[0].replace(`${b} is `, '')}`}</p>}
          </div>
        </div>
      </div>

      <div className="nav">
        <Button disabled={i === 0} onClick={() => setI(i - 1)}>Back</Button>
        <Button variant="primary" onClick={() => (last ? setSteps(null) : setI(i + 1))}>
          {last ? 'Done' : 'Next'}
        </Button>
      </div>
      </div>
      </div>
    </main>{reportContext && <Suspense fallback={null}><ReportDialog context={reportContext} onClose={() => setReportContext(null)} /></Suspense>}</>
  );
}
