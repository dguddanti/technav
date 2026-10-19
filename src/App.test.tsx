import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import App from './App';
import * as routing from './route';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('route planning', () => {
  it('swaps endpoints without submitting and plans the reversed route', () => {
    render(<App />);
    fireEvent.change(screen.getByLabelText('To'), { target: { value: 'F125' } });
    fireEvent.click(screen.getByRole('button', { name: 'Swap start and destination' }));
    expect(screen.getByLabelText('From')).toHaveValue('F125');
    expect(screen.getByLabelText('To')).toHaveValue('Main Entrance');
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Get Directions' }));
    expect(screen.getByRole('img', { name: 'First-floor route from F125 to Main Entrance' })).toBeInTheDocument();
  });

  it('swaps blank and unsupported input exactly and can swap back', () => {
    render(<App />);
    const swap = screen.getByRole('button', { name: 'Swap start and destination' });
    fireEvent.click(swap);
    expect(screen.getByLabelText('From')).toHaveValue('');
    expect(screen.getByLabelText('To')).toHaveValue('Main Entrance');
    expect(screen.getByRole('button', { name: 'Get Directions' })).toBeDisabled();
    fireEvent.change(screen.getByLabelText('From'), { target: { value: ' unsupported ' } });
    fireEvent.click(swap);
    expect(screen.getByLabelText('To')).toHaveValue(' unsupported ');
    expect(screen.getByRole('button', { name: 'Get Directions' })).toBeDisabled();
    fireEvent.click(swap);
    expect(screen.getByLabelText('From')).toHaveValue(' unsupported ');
    expect(screen.getByLabelText('To')).toHaveValue('Main Entrance');
  });

  it('clears the previous route error when swapping endpoints', () => {
    vi.spyOn(routing, 'getSteps').mockImplementation(() => { throw new Error('Route unavailable'); });
    render(<App />);
    fireEvent.change(screen.getByLabelText('To'), { target: { value: 'F125' } });
    fireEvent.click(screen.getByRole('button', { name: 'Get Directions' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Route unavailable');
    fireEvent.click(screen.getByRole('button', { name: 'Swap start and destination' }));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByLabelText('From')).toHaveValue('F125');
  });

  it('labels both inputs and explains the prototype scope', () => {
    render(<App />);
    expect(screen.getByLabelText('From')).toHaveValue('Main Entrance');
    expect(screen.getByLabelText('To')).toHaveValue('');
    expect(screen.getByText('First-floor prototype. Distances are estimates.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Get Directions' })).toBeDisabled();
  });

  it('plans a route with case-insensitive input through the form', () => {
    render(<App />);
    fireEvent.change(screen.getByLabelText('From'), { target: { value: ' a112 ' } });
    fireEvent.change(screen.getByLabelText('To'), { target: { value: 'f125' } });
    fireEvent.submit(screen.getByRole('button', { name: 'Get Directions' }).closest('form')!);
    expect(screen.getByRole('img', { name: 'First-floor route from A112 to F125' })).toBeInTheDocument();
    expect(screen.getByText('Exit A112 and walk about 15 ft.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Back' })).toBeDisabled();
  });

  it('explains unsupported locations and identical endpoints', () => {
    render(<App />);
    fireEvent.change(screen.getByLabelText('To'), { target: { value: 'F225' } });
    expect(screen.getByText('Choose a listed first-floor location for both From and To.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Get Directions' })).toBeDisabled();
    fireEvent.change(screen.getByLabelText('To'), { target: { value: 'Main Entrance' } });
    expect(screen.getByText('Choose a different destination.')).toBeInTheDocument();
  });

  it('allows stepping back, arriving, and planning again with preserved inputs', () => {
    render(<App />);
    fireEvent.change(screen.getByLabelText('To'), { target: { value: 'A112' } });
    fireEvent.click(screen.getByRole('button', { name: 'Get Directions' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(screen.getByRole('progressbar')).toHaveAttribute('value', '1');
    for (let i = 0; i < 20 && screen.queryByRole('button', { name: 'Next' }); i++) {
      fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    }
    expect(screen.getByText(/A112.*You have arrived/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(screen.getByLabelText('To')).toHaveValue('A112');
    expect(screen.getByRole('button', { name: 'Get Directions' })).toBeEnabled();
  });

  it('shows a route failure without losing input and clears it on editing', () => {
    vi.spyOn(routing, 'getSteps').mockImplementation(() => {
      throw new Error('No connected route is available between these locations. Choose another location.');
    });
    render(<App />);
    fireEvent.change(screen.getByLabelText('To'), { target: { value: 'A112' } });
    fireEvent.click(screen.getByRole('button', { name: 'Get Directions' }));
    expect(screen.getByRole('alert')).toHaveTextContent('No connected route');
    expect(screen.getByLabelText('To')).toHaveValue('A112');
    fireEvent.change(screen.getByLabelText('To'), { target: { value: 'F125' } });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
