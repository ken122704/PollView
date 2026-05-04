import { useState } from 'react';
import { Socket } from 'socket.io-client';
import type { Poll } from '../types/poll';
import './CreatePollModal.css'; // reuse exact same styles — no new CSS needed

interface Props {
  poll: Poll;
  onClose: () => void;
  onUpdated: (poll: Poll) => void;
  socket: Socket;
}

export function EditPollModal({ poll, onClose, onUpdated, socket }: Props) {
  const [question, setQuestion]     = useState(poll.question);
  const [options, setOptions]       = useState<string[]>(
    poll.options.map(o => o.label)
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]           = useState('');


  function addOption() {
    if (options.length >= 8) return;
    setOptions(prev => [...prev, '']);
  }

  function removeOption(i: number) {
    if (options.length <= 2) return;
    setOptions(prev => prev.filter((_, idx) => idx !== i));
  }

  function updateOption(i: number, val: string) {
    setOptions(prev => prev.map((o, idx) => (idx === i ? val : o)));
  }

  function handleSubmit() {
    const trimmedQ = question.trim();
    const filled   = options.map(o => o.trim()).filter(Boolean);

    if (!trimmedQ)         return setError('Please enter a question.');
    if (filled.length < 2) return setError('Add at least 2 options.');

    // Check something actually changed
    const questionSame = trimmedQ === poll.question;
    const optionsSame  =
      filled.length === poll.options.length &&
      filled.every((o, i) => o === poll.options[i]?.label);

    if (questionSame && optionsSame) {
      return setError('No changes detected.');
    }

    setError('');
    setSubmitting(true);

    socket.emit('update_poll', {
      pollId: poll.id,
      question: trimmedQ,
      options: filled,
    });

    socket.once('poll_updated_meta', (updated: Poll) => {
      if (updated.id !== poll.id) return; // ignore updates for other polls
      setSubmitting(false);
      onUpdated(updated);
    });

    setTimeout(() => {
      setSubmitting(false);
      setError('Server did not respond. Is it running?');
    }, 5000);
  }

  function handleBackdrop(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === e.currentTarget) onClose();
  }

  // Which options had votes — warn user they'll be preserved or reset
  const hasVotes = poll.options.some(o => o.votes > 0);

  return (
    <div className="modal-backdrop" onClick={handleBackdrop}>
      <div className="modal-box" role="dialog" aria-modal="true">

        {/* Header */}
        <div className="modal-header">
          <h2 className="modal-title">Edit poll</h2>
          <button className="modal-close" onClick={onClose} aria-label="Close">✕</button>
        </div>

        {/* Vote preservation notice */}
        {hasVotes && (
          <div className="modal-notice">
            ⚠ Existing votes are preserved for unchanged options.
            Renamed or removed options reset to 0.
          </div>
        )}

        {/* Question */}
        <div className="field">
          <label className="field-label">Question</label>
          <input
            className="field-input"
            type="text"
            placeholder="e.g. What's your favorite framework?"
            value={question}
            onChange={e => { setQuestion(e.target.value); setError(''); }}
            maxLength={160}
            autoFocus
          />
          <span className="char-count mono">{question.length}/160</span>
        </div>

        {/* Options */}
        <div className="field">
          <label className="field-label">
            Options
            <span className="field-meta">{options.length}/8</span>
          </label>
          <div className="options-input-list">
            {options.map((opt, i) => (
              <div
                className="option-input-row"
                key={i}
                style={{ animationDelay: `${i * 0.04}s` }}
              >
                <span className="option-index mono">{i + 1}</span>
                <input
                  className="field-input option-input"
                  type="text"
                  placeholder={`Option ${i + 1}`}
                  value={opt}
                  onChange={e => { updateOption(i, e.target.value); setError(''); }}
                  maxLength={80}
                  onKeyDown={e => { if (e.key === 'Enter') addOption(); }}
                />
                <button
                  className="remove-btn"
                  onClick={() => removeOption(i)}
                  disabled={options.length <= 2}
                  aria-label="Remove option"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
          {options.length < 8 && (
            <button className="add-option-btn" onClick={addOption}>
              + Add option
            </button>
          )}
        </div>

        {error && <p className="modal-error">{error}</p>}

        {/* Footer */}
        <div className="modal-footer">
          <button className="btn-cancel" onClick={onClose}>Cancel</button>
          <button
            className={`btn-primary btn-create ${submitting ? 'loading' : ''}`}
            onClick={handleSubmit}
            disabled={submitting}
          >
            {submitting
              ? <><span className="btn-spinner" />Saving…</>
              : <>Save changes</>}
          </button>
        </div>
      </div>
    </div>
  );
}