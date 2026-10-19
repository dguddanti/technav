import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import App from './App';
import * as routing from './route';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('route planning', () => {
  it('labels both inputs and disables directions until a destination is selected', () => {
    render(<App />);
    expect(screen.getByLabelText('From')).toHaveValue('Main Entrance');
    expect(screen.getByLabelText('To')).toHaveValue('');
    expect(screen.getByRole('button', { name: 'Get Directions' })).toBeDisabled();
  });

  it('plans a route with case-insensitive input through the form', () => {
    render(<App />);
    fireEvent.change(screen.getByLabelText('From'), { target: { value: ' a112 ' } });
    fireEvent.change(screen.getByLabelText('To'), { target: { value: 'f125' } });
    fireEvent.submit(screen.getByRole('button', { name: 'Get Directions' }).closest('form')!);
    expect(screen.getByRole('img', { name: 'Route from A112 to F125' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Exit A112' })).toBeInTheDocument();
    expect(screen.getByText('About 15 ft')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Back' })).toBeDisabled();
  });

  it('explains unsupported locations and identical endpoints', () => {
    render(<App />);
    fireEvent.change(screen.getByLabelText('To'), { target: { value: 'F925' } });
    expect(screen.getByText('Choose a listed location for both From and To.')).toBeInTheDocument();
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
    expect(screen.getByRole('heading', { name: 'You have arrived' })).toBeInTheDocument();
    expect(screen.getByText(/^A112 · /)).toBeInTheDocument();
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
