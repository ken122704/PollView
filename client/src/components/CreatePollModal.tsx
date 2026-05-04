import { useState } from 'react';
import { Socket } from 'socket.io-client';
import type { Poll } from '../types/poll';
import './CreatePollModal.css';

interface Props {
  onClose: () => void;
  onCreated: (poll: Poll) => void;
  socket: Socket;
}

export function CreatePollModal({ onClose, onCreated, socket }: Props) {
  const [question, setQuestion]   = useState('');
  const [options, setOptions]     = useState(['', '']);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]         = useState('');

  function addOption() {
    if (options.length >= 8) return;
    setOptions(prev => [...prev, '']);
  }

  function removeOption(i: number) {
    if (options.length <= 2) return;
    setOptions(prev => prev.filter((_, idx) => idx !== i));
  }

  function updateOption(i: number, val: string) {
    setOptions(prev => prev.map((o, idx) => idx === i ? val : o));
  }

  function handleSubmit() {
    const trimmedQ = question.trim();
    const filled   = options.map(o => o.trim()).filter(Boolean);

    if (!trimmedQ)        return setError('Please enter a question.');
    if (filled.length < 2) return setError('Add at least 2 options.');

    setError('');
    setSubmitting(true);

    socket.emit('create_poll', { question: trimmedQ, options: filled });

    // Listen for the server's response
    socket.once('poll_created', (poll: Poll) => {
      setSubmitting(false);
      onCreated(poll);
    });

    // Timeout fallback
    setTimeout(() => {
      setSubmitting(false);
      setError('Server did not respond. Is it running?');
    }, 5000);
  }

  // Close on backdrop click
  function handleBackdrop(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === e.currentTarget) onClose();
  }

  return (
    <div className="modal-backdrop" onClick={handleBackdrop}>
      <div className="modal-box" role="dialog" aria-modal="true">
        {/* Header */}
        <div className="modal-header">
          <h2 className="modal-title">Create a poll</h2>
          <button className="modal-close" onClick={onClose} aria-label="Close">✕</button>
        </div>

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
              <div className="option-input-row" key={i}
                style={{ animationDelay: `${i * 0.04}s` }}>
                <span className="option-index mono">{i + 1}</span>
                <input
                  className="field-input option-input"
                  type="text"
                  placeholder={`Option ${i + 1}`}
                  value={opt}
                  onChange={e => { updateOption(i, e.target.value); setError(''); }}
                  maxLength={80}
                  onKeyDown={e => {
                    if (e.key === 'Enter') addOption();
                  }}
                />
                <button
                  className="remove-btn"
                  onClick={() => removeOption(i)}
                  disabled={options.length <= 2}
                  aria-label="Remove option"
                >✕</button>
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
              ? <><span className="btn-spinner"/>Creating…</>
              : <>Create Poll</>}
          </button>
        </div>
      </div>
    </div>
  );
}