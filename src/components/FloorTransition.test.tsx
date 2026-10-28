import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import type { Floor } from '../building';
import type { Step } from '../route';
import { FloorTransition } from './FloorTransition';

afterEach(cleanup);

const ride = (from: Floor, to: Floor, via: 'stairs' | 'elevator', turn: 'up' | 'down'): Step[] => [
  { floor: from, turn: 'straight', text: 'Walk ahead', pts: [[900, 900], [1000, 900]] },
  { floor: to, turn, via, text: `Take the ${via} ${turn}`, pts: [[1000, 900], [1000, 900]] },
  { floor: to, turn: 'arrive', text: 'You have arrived.', pts: [[1000, 900], [1100, 900]] },
];
const labels = (container: HTMLElement) => [...container.querySelectorAll('.ride-label')].map((label) => label.textContent);

describe('FloorTransition', () => {
  it('draws every floor of the ride', () => {
    const { container } = render(<FloorTransition steps={ride('B', '2', 'elevator', 'up')} index={1} />);
    expect(screen.getByRole('region', { name: 'Elevator from Basement to Floor 2' })).toBeInTheDocument();
    expect(screen.getByText('3 floors up')).toBeInTheDocument();
    expect(labels(container)).toEqual(['Basement', 'Ground floor', 'Floor 1', 'Floor 2']);
  });

  it('highlights the destination of a downward ride', () => {
    const { container } = render(<FloorTransition steps={ride('3', '2', 'stairs', 'down')} index={1} />);
    expect(screen.getByText('1 floor down')).toBeInTheDocument();
    expect(labels(container)).toEqual(['Floor 2', 'Floor 3']);
    expect(container.querySelector('.is-destination .ride-label')).toHaveTextContent('Floor 2');
    expect(container.querySelector('.ride-shaft--stairs')).not.toBeNull();
  });
});
