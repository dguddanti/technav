import { useEffect, useRef, useState } from 'react';
import { Button } from '../components/ui/Button';
import { Message } from '../components/ui/Message';
import { submitFeedback, validateFeedback } from '../services/feedback';
import '../reports/reports.css';
import './feedback.css';

export const FeedbackDialog = ({ onClose }: { onClose: () => void }) => {
  const dialog = useRef<HTMLDialogElement>(null);
  const [message, setMessage] = useState('');
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    const node = dialog.current!;
    const opener = document.activeElement;
    if (typeof node.showModal === 'function') node.showModal(); else node.setAttribute('open', '');
    return () => { if (typeof node.close === 'function') node.close(); if (opener instanceof HTMLElement) opener.focus(); };
  }, []);
  return <dialog ref={dialog} className="report-dialog feedback-dialog" aria-labelledby="feedback-title" onCancel={(event) => { event.preventDefault(); if (!sending) onClose(); }}>
    <div className="report-shell">
      <header className="report-header"><h2 id="feedback-title">Feedback</h2><button type="button" className="report-close" aria-label="Close feedback" disabled={sending} onClick={onClose}>×</button></header>
      {sent ? <><div className="report-confirmation" role="status"><h3>Feedback sent.</h3><p>The TechNav team will read your message.</p></div><footer className="report-actions"><Button variant="primary" onClick={onClose}>Done</Button></footer></> : <form className="report-form" onSubmit={async (event) => {
        event.preventDefault();
        const invalid = validateFeedback({ message, email });
        if (invalid) { setError(invalid); return; }
        setSending(true); setError('');
        try { await submitFeedback({ message, email }); setSent(true); }
        catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not send. Please try again.'); }
        finally { setSending(false); }
      }}>
        <fieldset className="report-body" disabled={sending}>
          <p className="feedback-intro">Share an idea or tell us about your experience.</p>
          <label className="report-label">Your feedback<textarea required maxLength={2000} value={message} onChange={(event) => { setMessage(event.target.value); setError(''); }} /></label>
          <label className="report-label">Email (optional)<input type="email" maxLength={200} autoComplete="email" value={email} onChange={(event) => { setEmail(event.target.value); setError(''); }} /><span className="report-help">Only if you would like a reply.</span></label>
          <p className="report-help">Your message and email are visible only to authorized TechNav reviewers.</p>
        </fieldset>
        <footer className="report-actions">{error && <Message tone="error" role="alert">{error}</Message>}<Button type="submit" variant="primary" disabled={sending || !message.trim()}>{sending ? 'Sending…' : 'Send feedback'}</Button></footer>
      </form>}
    </div>
  </dialog>;
};
