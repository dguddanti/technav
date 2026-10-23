import { watchPhotoCoverage } from '../services/photoCoverage';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminApp } from './AdminApp';
import { watchAdminIdentity, watchReports } from '../services/admin';
vi.mock('../services/admin', () => ({ watchAdminIdentity: vi.fn(), watchReports: vi.fn(), signInAdmin: vi.fn(), signOutAdmin: vi.fn(), addAdministrator: vi.fn(), saveEntrance: vi.fn(), addAdminPhoto: vi.fn() }));
describe('administrator access and navigation', () => {
  it('shows sign-in without exposing review tools to guests', () => {
    vi.mocked(watchAdminIdentity).mockImplementation((receive) => { receive(null); return () => {}; });
    render(<AdminApp />);
    expect(screen.getByRole('button', { name: 'Continue with Google' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Add entrance' })).toBeNull();
  });
  it('denies signed-in Google accounts without an allowlist entry', () => {
    vi.mocked(watchAdminIdentity).mockImplementation((receive) => { receive({ email: 'other@example.com', allowed: false }); return () => {}; });
    render(<AdminApp />);
    expect(screen.getByRole('alert')).toHaveTextContent('Access has not been granted');
    expect(screen.queryByRole('button', { name: 'Add entrance' })).toBeNull();
  });
  it('offers separate direct entrance and photo entry tools after authorization', () => {
    vi.mocked(watchAdminIdentity).mockImplementation((receive) => { receive({ email: 'admin@example.com', allowed: true }); return () => {}; });
    vi.mocked(watchReports).mockImplementation((receive) => { receive([]); return () => {}; });
    render(<AdminApp />);
    fireEvent.click(screen.getByRole('button', { name: 'Add entrance' }));
    expect(screen.getByRole('combobox', { name: 'Location name' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save entrance' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Add photo' }));
    expect(screen.getByRole('button', { name: 'Publish photo' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Change report type/ })).toBeNull();
  });
});

vi.mock('../services/photoCoverage', () => ({ watchPhotoCoverage: vi.fn() }));
beforeEach(() => { vi.mocked(watchPhotoCoverage).mockImplementation((_floor, receive) => { receive({}); return () => {}; }); });
