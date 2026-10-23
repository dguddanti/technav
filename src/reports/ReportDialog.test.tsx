import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
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
