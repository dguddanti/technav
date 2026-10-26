import { beforeEach, describe, expect, it, vi } from 'vitest';
import { submitFeedback, validateFeedback } from './feedback';
import { getDatabase } from './firebaseClients';
vi.mock('./firebaseClients', () => ({ getDatabase: vi.fn() }));
const addDoc = vi.fn();
const collection = vi.fn(() => 'feedback-collection');
const serverTimestamp = vi.fn(() => 'server-time');
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getDatabase).mockResolvedValue({ db: {}, dbSdk: { addDoc, collection, serverTimestamp } } as unknown as Awaited<ReturnType<typeof getDatabase>>);
});
describe('feedback submission', () => {
  it('rejects blank, oversized messages and invalid optional emails before accessing the database', async () => {
    for (const draft of [{ message: '   ', email: '' }, { message: 'x'.repeat(2001), email: '' }, { message: 'Hello', email: 'invalid' }]) await expect(submitFeedback(draft)).rejects.toThrow();
    expect(getDatabase).not.toHaveBeenCalled();
    expect(validateFeedback({ message: 'Useful app', email: '' })).toBeNull();
  });
  it('saves a trimmed private message with optional contact and no route tracking', async () => {
    await submitFeedback({ message: '  Clearer search please.  ', email: '  person@example.com  ' });
    expect(addDoc).toHaveBeenCalledWith('feedback-collection', { type: 'other', message: 'Clearer search please.', email: 'person@example.com', from: null, to: null, createdAt: 'server-time' });
  });
  it('returns a recoverable error when a write fails', async () => {
    addDoc.mockRejectedValueOnce(new Error('offline'));
    await expect(submitFeedback({ message: 'Hello', email: '' })).rejects.toThrow('Your message is still here');
  });
});
