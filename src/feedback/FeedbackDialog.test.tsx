import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { FeedbackDialog } from './FeedbackDialog';
import { submitFeedback } from '../services/feedback';
vi.mock('../services/feedback', async (original) => ({ ...await original<typeof import('../services/feedback')>(), submitFeedback: vi.fn() }));

describe('private app feedback', () => {
  it('keeps the message after a failed send and confirms only when saved', async () => {
    vi.mocked(submitFeedback).mockRejectedValueOnce(new Error('Could not connect.')).mockResolvedValueOnce();
    render(<FeedbackDialog onClose={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Send feedback' })).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Your feedback'), { target: { value: 'Room search was hard to understand.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send feedback' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not connect.');
    expect(screen.getByLabelText('Your feedback')).toHaveValue('Room search was hard to understand.');
    expect(screen.queryByText('Feedback sent.')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Send feedback' }));
    expect(await screen.findByRole('status')).toHaveTextContent('Feedback sent.');
    expect(submitFeedback).toHaveBeenLastCalledWith({ message: 'Room search was hard to understand.', email: '' });
  });
  it('prevents duplicate submissions while waiting and preserves the draft', async () => {
    let finish!: () => void;
    vi.mocked(submitFeedback).mockImplementationOnce(() => new Promise<void>((resolve) => { finish = resolve; }));
    render(<FeedbackDialog onClose={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('Your feedback'), { target: { value: 'A useful feature would be saved destinations.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send feedback' }));
    expect(screen.getByRole('button', { name: 'Sending…' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Close feedback' })).toBeDisabled();
    finish();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Done' })).toBeEnabled());
  });
});
