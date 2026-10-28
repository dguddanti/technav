import { afterEach, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import App from './App';

afterEach(cleanup);

const mapImage = () => screen.getByRole('img', { name: /^Route from/ }).querySelector('image')!.getAttribute('href');

it('switches the map to the floor of the current step', async () => {
  const { container } = render(<App />);
  fireEvent.change(screen.getByLabelText('To'), { target: { value: 'L361' } });
  fireEvent.click(screen.getByRole('button', { name: 'Get Directions' }));
  expect(screen.getByText(/Step 1 of \d+ · Floor 1/)).toBeInTheDocument();
  expect(mapImage()).toBe('/map.png');
  // The destination marker waits for the destination's floor.
  expect(container.querySelector('.goal')).toBeNull();

  while (!screen.queryByText(/up to Floor 3/)) fireEvent.click(screen.getByRole('button', { name: 'Next' }));
  // The ride itself shows the floors it passes, not a floor plan.
  expect(screen.getByText(/· Floor 1 → Floor 3/)).toBeInTheDocument();
  expect(await screen.findByRole('region', { name: 'Stairs from Floor 1 to Floor 3' })).toBeInTheDocument();
  expect(screen.queryByRole('img', { name: /^Route from/ })).toBeNull();

  fireEvent.click(screen.getByRole('button', { name: 'Next' }));
  expect(screen.getByText(/· Floor 3$/)).toBeInTheDocument();
  expect(mapImage()).toBe('/maps/floor-3.png');
  expect(container.querySelector('.goal')).not.toBeNull();
});

it('plans a step-free route when asked', () => {
  render(<App />);
  fireEvent.click(screen.getByLabelText('Step-free route (elevators only)'));
  fireEvent.change(screen.getByLabelText('To'), { target: { value: 'L361' } });
  fireEvent.click(screen.getByRole('button', { name: 'Get Directions' }));
  while (!screen.queryByText(/Take the/)) fireEvent.click(screen.getByRole('button', { name: 'Next' }));
  expect(screen.getByText('Take the elevator up to Floor 3.')).toBeInTheDocument();
});
