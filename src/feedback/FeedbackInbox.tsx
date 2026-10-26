import { useEffect, useState } from 'react';
import { watchFeedback } from '../services/feedback';
import type { SubmittedFeedback } from '../services/feedback';
import './feedback.css';

export const FeedbackInbox = () => {
  const [items, setItems] = useState<SubmittedFeedback[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  useEffect(() => watchFeedback((values) => { setItems(values); setLoading(false); setFailed(false); }, () => { setFailed(true); setLoading(false); }), []);
  return <section className="feedback-inbox" aria-label="User feedback"><h2>User feedback</h2><p className="report-help">Latest 100 messages. Feedback is private and does not change the map.</p>{loading ? <p role="status">Loading feedback…</p> : failed ? <p role="alert">Feedback could not be loaded. Reload to try again.</p> : !items.length ? <p>No feedback yet.</p> : items.map((item) => <article className="feedback-entry" key={item.id}>
    <time dateTime={item.createdAtMillis ? new Date(item.createdAtMillis).toISOString() : undefined}>{item.createdAtMillis ? new Date(item.createdAtMillis).toLocaleString() : 'Just submitted'}</time>
    {(item.from || item.to) && <small>{item.from || '—'} → {item.to || '—'}</small>}<p>{item.message}</p>{item.email && <a href={`mailto:${encodeURIComponent(item.email)}`}>{item.email}</a>}
  </article>)}</section>;
};
