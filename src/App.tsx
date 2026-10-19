import { useState } from 'react';
import { places, getSteps } from './route';
import type { Step } from './route';
import { NavigationMap } from './components/NavigationMap';
import { Button } from './components/ui/Button';
import { Combobox } from './components/ui/Combobox';
import { Message } from './components/ui/Message';
import './App.css';

const names = Object.keys(places);

export default function App() {
  const [from, setFrom] = useState('Main Entrance');
  const [to, setTo] = useState('');
  const [steps, setSteps] = useState<Step[] | null>(null);
  const [i, setI] = useState(0);
  const [error, setError] = useState('');

  // Match what was typed to a place, ignoring case.
  const find = (s: string) => names.find((n) => n.toLowerCase() === s.trim().toLowerCase());
  const a = find(from);
  const b = find(to);

  if (!steps) {
    return (
      <main className="planner">
        <header className="planner-header">
          <h1>TechNav</h1>
        </header>
        <form className="route-form" onSubmit={(event) => {
          event.preventDefault();
          if (!a || !b || a === b) return;
          try {
            setSteps(getSteps(a, b));
            setI(0);
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
          Get Directions
        </Button>
        </form>
      </main>
    );
  }

  const step = steps[i];
  const last = i === steps.length - 1;

  return (
    <main className="navigation">
      <header className="navigation-header">
        <Button variant="text" className="route-back" aria-label="Edit route" onClick={() => setSteps(null)}>
          <img src="/icons/back.svg" width="24" height="24" alt="" />
          <span className="route-endpoints"><span className="eyebrow">{a} →</span><strong>{b}</strong></span>
        </Button>
      </header>
      <div className="route-progress">
        <p className="eyebrow">Step {i + 1} of {steps.length}</p>
        <progress className="bar" value={i + 1} max={steps.length} aria-label="Route progress" />
      </div>
      <NavigationMap steps={steps} index={i} from={a!} to={b!} />
      <div className="card" aria-live="polite" aria-atomic="true">
        <span className={`direction-icon direction-icon--${step.turn}`} aria-hidden="true">
          {step.turn === 'arrive' ? <svg viewBox="0 0 32 32"><path d="m7 16 6 6L25 9" /></svg>
            : step.turn === 'around' ? <svg viewBox="0 0 32 32"><path d="M23 25V13a8 8 0 0 0-16 0v9m-5-5 5 5 5-5" /></svg>
              : <img src="/icons/straight.svg" width="32" height="32" alt="" />}
        </span>
        <div className="instruction">
          <div>
            <h2>{step.turn === 'arrive' ? 'You have arrived' : step.turn === 'left' ? 'Turn left'
              : step.turn === 'right' ? 'Turn right' : step.turn === 'around' ? 'Turn around'
                : step.text.startsWith('Exit ') ? `Exit ${a}` : step.text.startsWith('Leave ') ? step.text.split(' and ')[0] : 'Continue straight'}</h2>
            <p>{step.turn === 'arrive' ? `${b} · ${step.text.split('. You')[0].replace(`${b} is `, '')}`
              : step.text.match(/about (\d+ ft)/)?.[1] ? `About ${step.text.match(/about (\d+ ft)/)![1]}` : ''}</p>
            <p className="eyebrow">Distances are estimates.</p>
          </div>
        </div>
      </div>

      <div className="nav">
        <Button disabled={i === 0} onClick={() => setI(i - 1)}>Back</Button>
        <Button variant="primary" onClick={() => (last ? setSteps(null) : setI(i + 1))}>
          {last ? 'Done' : 'Next'}
        </Button>
      </div>
    </main>
  );
}
