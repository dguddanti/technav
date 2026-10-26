vi.mock('./services/locationPhotos', () => ({ watchLocationPhotos: (_floor: string, receive: (photos: never[]) => void) => { receive([]); return () => {}; }, loadLocationPhoto: vi.fn() }));
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
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
    expect(screen.queryByText(/\d+ ft/)).toBeNull();
    expect(screen.queryByText('Distances are estimates.')).toBeNull();
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

describe('route overview', () => {
  const planRoute = () => {
    fireEvent.change(screen.getByLabelText('To'), { target: { value: 'A112' } });
    fireEvent.click(screen.getByRole('button', { name: 'Get Directions' }));
  };

  it('shows an ordered overview with the current step marked', () => {
    render(<App />);
    expect(screen.queryByRole('button', { name: 'View all steps' })).not.toBeInTheDocument();
    planRoute();
    fireEvent.click(screen.getByRole('button', { name: 'View all steps' }));
    const overview = screen.getByRole('region', { name: 'All directions' });
    expect(within(overview).getAllByRole('listitem')).toHaveLength(4);
    expect(within(overview).queryByText(/\d+ ft/)).toBeNull();
    expect(within(overview).getByRole('button', { name: /^Step 1:/ })).toHaveAttribute('aria-current', 'step');
    expect(within(overview).getByRole('button', { name: /^Step 4:.*You have arrived/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Back to map' })).toHaveAttribute('aria-expanded', 'true');
  });

  it('jumps to a selected step and continues normal Back/Next navigation', () => {
    render(<App />);
    planRoute();
    fireEvent.click(screen.getByRole('button', { name: 'View all steps' }));
    fireEvent.click(screen.getByRole('button', { name: /^Step 2:/ }));
    expect(screen.queryByRole('region', { name: 'All directions' })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Turn left' })).toBeInTheDocument();
    expect(screen.queryByText(/\d+ ft/)).toBeNull();
    expect(screen.getByRole('progressbar')).toHaveAttribute('value', '2');
    expect(screen.getByRole('button', { name: 'View all steps' })).toHaveFocus();
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByRole('progressbar')).toHaveAttribute('value', '3');
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(screen.getByRole('progressbar')).toHaveAttribute('value', '2');
    fireEvent.click(screen.getByRole('button', { name: 'View all steps' }));
    expect(screen.getByRole('button', { name: /^Step 2:/ })).toHaveAttribute('aria-current', 'step');
  });

  it('returns to the same map step when the overview is dismissed', () => {
    render(<App />);
    planRoute();
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'View all steps' }));
    fireEvent.click(screen.getByRole('button', { name: 'Back to map' }));
    expect(screen.getByRole('progressbar')).toHaveAttribute('value', '2');
    expect(screen.getByRole('img')).toBeInTheDocument();
  });

  it('can jump to arrival and finish the route', () => {
    render(<App />);
    planRoute();
    fireEvent.click(screen.getByRole('button', { name: 'View all steps' }));
    fireEvent.click(screen.getByRole('button', { name: /^Step 4:/ }));
    expect(screen.getByRole('progressbar')).toHaveAttribute('value', '4');
    expect(screen.getByRole('heading', { name: 'You have arrived' })).toBeInTheDocument();
    expect(screen.getByText('A112 · on your left')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(screen.getByLabelText('To')).toHaveValue('A112');
  });

  it('opens a new route on the map after leaving an overview', () => {
    render(<App />);
    planRoute();
    fireEvent.click(screen.getByRole('button', { name: 'View all steps' }));
    fireEvent.click(screen.getByRole('button', { name: 'Edit route' }));
    fireEvent.change(screen.getByLabelText('To'), { target: { value: 'F125' } });
    fireEvent.click(screen.getByRole('button', { name: 'Get Directions' }));
    expect(screen.getByRole('img', { name: 'Route from Main Entrance to F125' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'View all steps' })).toHaveAttribute('aria-expanded', 'false');
  });

});
