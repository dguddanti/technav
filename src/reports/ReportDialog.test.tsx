import { photoStations } from '../data/photoStations';
import type { PhotoCoverage } from '../services/photoCoverage';
import { watchPhotoCoverage } from '../services/photoCoverage';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ReportDialog } from './ReportDialog';
import { submitReport } from '../services/reports';
vi.mock('../services/reports', () => ({ submitReport: vi.fn() }));
vi.mock('../services/admin', () => ({ addAdminPhoto: vi.fn() }));
describe('report flows', () => {
  it('starts with types, then shows only fields needed for the selected report', () => {
    render(<ReportDialog context={{ floor: '1' }} onClose={vi.fn()} />);
    expect(screen.queryByRole('button', { name: 'Submit report' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Correct an entrance/ }));
    expect(screen.getByRole('combobox', { name: 'Room or location' })).toBeInTheDocument();
    expect(screen.queryByLabelText('What is wrong?')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Change report type/ }));
    fireEvent.click(screen.getByRole('button', { name: /Add a location photo/ }));
    expect(screen.getByRole('group', { name: 'Photo direction' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Right' }));
    expect(screen.getByText('Facing right')).toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: 'Room or location' })).toBeNull();
  });
  it('retains the report on failure and confirms only after the server acknowledges it', async () => {
    vi.mocked(submitReport).mockRejectedValueOnce(new Error('Connection failed')).mockResolvedValueOnce('saved');
    render(<ReportDialog context={{ floor: '1', point: [100, 100] }} onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /Route or map issue/ }));
    fireEvent.change(screen.getByLabelText('Describe the issue'), { target: { value: 'Hallway is blocked' } });
    fireEvent.click(screen.getByRole('button', { name: 'Submit report' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Connection failed');
    expect(screen.getByLabelText('Describe the issue')).toHaveValue('Hallway is blocked');
    fireEvent.click(screen.getByRole('button', { name: 'Submit report' }));
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Report submitted' })).toBeInTheDocument());
  });
});

vi.mock('../services/photoCoverage', () => ({ watchPhotoCoverage: vi.fn() }));
beforeEach(() => { vi.mocked(watchPhotoCoverage).mockImplementation((_floor, receive) => { receive({}); return () => {}; }); });

it('blocks captured directions and reacts when the last available view is published', () => {
  const spot = photoStations.find((station) => station.floor === '1')!;
  let receiveCoverage: (coverage: PhotoCoverage) => void = () => {};
  vi.mocked(watchPhotoCoverage).mockImplementationOnce((_floor, receive) => {
    receiveCoverage = receive; receive({ [spot.id]: [0] }); return () => {};
  });
  render(<ReportDialog context={{ floor: '1' }} onClose={vi.fn()} />);
  fireEvent.click(screen.getByRole('button', { name: /Add a location photo/ }));
  fireEvent.click(screen.getByRole('combobox', { name: /Photo spot/ }));
  fireEvent.click(screen.getByRole('option', { name: `${spot.label} · spot 1` }));
  expect(screen.getByRole('button', { name: /Up/ })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Right' })).toBeEnabled();
  fireEvent.click(screen.getByRole('button', { name: 'Right' }));
  expect(screen.getByRole('button', { name: 'Submit report' })).toBeEnabled();
  act(() => receiveCoverage({ [spot.id]: [0, 90] }));
  expect(screen.getByRole('button', { name: 'Submit report' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Choose photo' })).toBeDisabled();
  expect(screen.getByText('This direction already has a photo. Choose another direction or spot.')).toBeInTheDocument();
  act(() => receiveCoverage({ [spot.id]: [0, 90, 180, 270] }));
  expect(screen.getByText('All four directions already have photos. Choose another spot.')).toBeInTheDocument();
});

it('blocks uploads when existing photos cannot be checked and lets the user retry', () => {
  vi.mocked(watchPhotoCoverage).mockImplementationOnce((_floor, _receive, fail) => { fail(); return () => {}; });
  render(<ReportDialog context={{ floor: '1' }} onClose={vi.fn()} />);
  fireEvent.click(screen.getByRole('button', { name: /Add a location photo/ }));
  expect(screen.getByRole('button', { name: 'Submit report' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Choose photo' })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
  expect(screen.getByRole('button', { name: 'Choose photo' })).toBeEnabled();
});
