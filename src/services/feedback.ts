import { getDatabase } from './firebaseClients';

export interface FeedbackDraft { message: string; email: string }
export interface SubmittedFeedback {
  id: string; type: string; message: string; email: string | null;
  from: string | null; to: string | null; createdAtMillis: number;
}
export const validateFeedback = ({ message, email }: FeedbackDraft): string | null => {
  if (!message.trim()) return 'Enter your feedback.';
  if (message.trim().length > 2000) return 'Keep your feedback under 2,000 characters.';
  if (email.trim() && (email.trim().length > 200 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))) return 'Enter a valid email or leave it blank.';
  return null;
};
export const submitFeedback = async (draft: FeedbackDraft): Promise<void> => {
  const invalid = validateFeedback(draft);
  if (invalid) throw new Error(invalid);
  try {
    const { db, dbSdk } = await getDatabase();
    await dbSdk.addDoc(dbSdk.collection(db, 'feedback'), {
      type: 'other', message: draft.message.trim(), email: draft.email.trim() || null,
      from: null, to: null, createdAt: dbSdk.serverTimestamp(),
    });
  } catch (cause) {
    throw new Error('Could not send. Check your connection and try again. Your message is still here.', { cause });
  }
};
export const watchFeedback = (receive: (items: SubmittedFeedback[]) => void, fail: (error: Error) => void) => {
  let stopped = false;
  let unsubscribe = () => {};
  void getDatabase().then(({ db, dbSdk }) => {
    if (stopped) return;
    unsubscribe = dbSdk.onSnapshot(dbSdk.query(dbSdk.collection(db, 'feedback'), dbSdk.orderBy('createdAt', 'desc'), dbSdk.limit(100)), (snapshot) => {
      receive(snapshot.docs.map((entry) => ({ ...entry.data(), id: entry.id, createdAtMillis: entry.data().createdAt?.toMillis?.() ?? 0 }) as SubmittedFeedback));
    }, fail);
  }).catch(fail);
  return () => { stopped = true; unsubscribe(); };
};
