import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NavigationViews } from './NavigationViews';
import { watchLocationPhotos, loadLocationPhoto } from '../services/locationPhotos';
import type { LocationPhoto } from '../services/locationPhotos';
import { photoStations } from '../data/photoStations';
import type { Step } from '../route';
vi.mock('../services/locationPhotos', () => ({ watchLocationPhotos: vi.fn(), loadLocationPhoto: vi.fn() }));
const spot = photoStations.find((entry) => entry.floor === '1')!;
const steps: Step[] = [{ floor: '1', turn: 'straight', text: 'Walk ahead', pts: [spot.point, [spot.point[0] + 20, spot.point[1]]] }];
const photo: LocationPhoto = { id: 'published', photoStationId: spot.id, mapHeading: 90, path: 'report-photos/test/published/photo.jpg' };
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(watchLocationPhotos).mockImplementation((_floor, receive) => { receive([]); return () => {}; });
  vi.mocked(loadLocationPhoto).mockResolvedValue(new Blob(['photo'], { type: 'image/jpeg' }));
  URL.createObjectURL = vi.fn(() => 'blob:test-photo'); URL.revokeObjectURL = vi.fn();
});
describe('navigation map and photo views', () => {
  it('offers a prefilled photo contribution directly from a missing route view', () => {
    const add = vi.fn(); render(<NavigationViews steps={steps} index={0} from="Start" to="End" onAddPhoto={add} />);
    fireEvent.click(screen.getByRole('button', { name: 'Add photo' }));
    expect(add).toHaveBeenCalledWith(expect.objectContaining({ kind: 'photo', photoStationId: spot.id, point: spot.point, mapHeading: 90, stepIndex: 0, from: 'Start', to: 'End' }));
    fireEvent.click(screen.getByRole('button', { name: 'Both' }));
    expect(screen.getByRole('separator')).toHaveAttribute('aria-valuenow', '50');
    fireEvent.keyDown(screen.getByRole('separator'), { key: 'ArrowDown' });
    expect(screen.getByRole('separator')).toHaveAttribute('aria-valuenow', '65');
  });
  it('shows the approved photo, allows looking at a missing direction, and preserves the chosen layout', async () => {
    vi.mocked(watchLocationPhotos).mockImplementation((_floor, receive) => { receive([photo]); return () => {}; });
    render(<NavigationViews steps={steps} index={0} from="Start" to="End" onAddPhoto={vi.fn()} />);
    expect(await screen.findByRole('img', { name: /facing right/ })).toHaveAttribute('src', 'blob:test-photo');
    expect(screen.getByRole('button', { name: 'Both' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'Look left on map' }));
    expect(screen.getByText('No photo for this view')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Both' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('button', { name: /^Photo$/ }));
    expect(screen.getByRole('button', { name: 'Add photo' })).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Look right on map' }));
    expect(await screen.findByRole('img', { name: /facing right/ })).toBeVisible();
  });
  it('never substitutes a different position or facing when a requested photo is missing', () => {
    vi.mocked(watchLocationPhotos).mockImplementation((_floor, receive) => { receive([{ ...photo, photoStationId: 'somewhere-else' }, { ...photo, mapHeading: 270 }]); return () => {}; });
    render(<NavigationViews steps={steps} index={0} from="Start" to="End" onAddPhoto={vi.fn()} />);
    expect(screen.getByText('No photo for this view')).toBeInTheDocument();
    expect(loadLocationPhoto).not.toHaveBeenCalled();
  });
  it('retries failed image downloads and revokes image URLs when leaving', async () => {
    vi.mocked(watchLocationPhotos).mockImplementation((_floor, receive) => { receive([photo]); return () => {}; });
    vi.mocked(loadLocationPhoto).mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(new Blob(['image']));
    const rendered = render(<NavigationViews steps={steps} index={0} from="Start" to="End" onAddPhoto={vi.fn()} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Retry photo' }));
    expect(await screen.findByRole('img', { name: /facing right/ })).toBeInTheDocument();
    rendered.unmount(); expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:test-photo');
  });
  it('does not present a read failure as an invitation to submit duplicate photos', () => {
    vi.mocked(watchLocationPhotos).mockImplementation((_floor, _receive, fail) => { fail(); return () => {}; });
    render(<NavigationViews steps={steps} index={0} from="Start" to="End" onAddPhoto={vi.fn()} />);
    expect(screen.queryByRole('button', { name: 'Add photo' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });
});

it('preserves split preferences and the moving route marker when advancing instructions', () => {
  const frame = vi.spyOn(globalThis, 'requestAnimationFrame').mockImplementation(() => 1);
  const route: Step[] = [...steps, { ...steps[0], pts: [[spot.point[0] + 20, spot.point[1]], [spot.point[0] + 20, spot.point[1] + 20]] }];
  const rendered = render(<NavigationViews steps={route} index={0} from="Start" to="End" onAddPhoto={vi.fn()} />);
  fireEvent.click(screen.getByRole('button', { name: 'Both' }));
  fireEvent.keyDown(screen.getByRole('separator'), { key: 'ArrowDown' });
  frame.mockClear();
  rendered.rerender(<NavigationViews steps={route} index={1} from="Start" to="End" onAddPhoto={vi.fn()} />);
  expect(frame).toHaveBeenCalled();
  expect(screen.getByRole('button', { name: 'Both' })).toHaveAttribute('aria-pressed', 'true');
  expect(screen.getByRole('separator')).toHaveAttribute('aria-valuenow', '65');
  expect(screen.getByRole('button', { name: 'Look down on map' })).toHaveAttribute('aria-pressed', 'true');
  frame.mockRestore();
});
