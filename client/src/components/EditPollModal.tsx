import { useState } from 'react';
import { Socket } from 'socket.io-client';
import type { Poll } from '../types/poll';

interface Props {
  poll: Poll;
  onClose: () => void;
  onUpdated: (poll: Poll) => void;
  socket: Socket;
}

export function EditPollModal({ poll, onClose, onUpdated, socket }: Props) {
  const [question, setQuestion]     = useState(poll.question);
  const [options, setOptions]       = useState(poll.options.map(o => o.label));
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
    setOptions(prev => prev.map((o, idx) => idx === i ? val : o));
  }

  function handleSubmit() {
    const trimmedQ = question.trim();
    const filled   = options.map(o => o.trim()).filter(Boolean);
    if (!trimmedQ)         return setError('Please enter a question.');
    if (filled.length < 2) return setError('Add at least 2 options.');
    const questionSame = trimmedQ === poll.question;
    const optionsSame  = filled.length === poll.options.length &&
      filled.every((o, i) => o === poll.options[i]?.label);
    if (questionSame && optionsSame) return setError('No changes detected.');
    setError('');
    setSubmitting(true);
    socket.emit('update_poll', { pollId: poll.id, question: trimmedQ, options: filled });
    socket.once('poll_updated_meta', (updated: Poll) => {
      if (updated.id !== poll.id) return;
      setSubmitting(false);
      onUpdated(updated);
    });
    setTimeout(() => { setSubmitting(false); setError('Server did not respond.'); }, 5000);
  }

  function handleBackdrop(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === e.currentTarget) onClose();
  }

  const hasVotes = poll.options.some(o => o.votes > 0);

  return (
    <div
      onClick={handleBackdrop}
      className="fixed inset-0 z-50 flex items-center justify-center p-4
        bg-black/65 backdrop-blur-sm animate-[fade-in_0.15s_ease]"
    >
      <div className="bg-[#111318] border border-white/12 rounded-2xl p-7 w-full max-w-lg
        shadow-[0_24px_64px_rgba(0,0,0,0.6)] animate-[modal-in_0.2s_cubic-bezier(0.34,1.56,0.64,1)]">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold tracking-tight text-[#f1f2f5]">Edit poll</h2>
          <button
            onClick={onClose}
            className="text-[#4b5068] hover:text-[#f1f2f5] hover:bg-[#1e2230] text-sm
              px-2 py-1 rounded-md transition-all cursor-pointer bg-transparent border-none"
          >
            ✕
          </button>
        </div>

        {/* Vote preservation notice */}
        {hasVotes && (
          <div className="text-sm text-[#f59e0b] bg-amber-500/8 border border-amber-500/20
            rounded-lg px-3 py-2.5 mb-5 leading-relaxed">
            ⚠ Existing votes are preserved for unchanged options.
            Renamed or removed options reset to 0.
          </div>
        )}

        {/* Question */}
        <div className="mb-5 relative">
          <label className="block text-[0.78rem] font-semibold tracking-widest text-[#4b5068] uppercase mb-2">
            Question
          </label>
          <input
            type="text"
            placeholder="e.g. What's your favorite framework?"
            value={question}
            onChange={e => { setQuestion(e.target.value); setError(''); }}
            maxLength={160}
            autoFocus
            className="w-full bg-[#181b22] border border-white/7 rounded-lg px-3.5 py-2.5
              text-sm text-[#f1f2f5] placeholder-[#4b5068] outline-none font-sans
              focus:border-[#6366f1] focus:shadow-[0_0_0_3px_rgba(99,102,241,0.15)]
              transition-all"
          />
          <span className="absolute right-3 -bottom-5 text-[0.7rem] text-[#4b5068] font-mono">
            {question.length}/160
          </span>
        </div>

        {/* Options */}
        <div className="mb-5 mt-7">
          <div className="flex items-center justify-between mb-2">
            <label className="text-[0.78rem] font-semibold tracking-widest text-[#4b5068] uppercase">
              Options
            </label>
            <span className="text-[0.72rem] text-[#4b5068] font-mono">{options.length}/8</span>
          </div>

          <div className="flex flex-col gap-2 mb-2">
            {options.map((opt, i) => (
              <div
                key={i}
                className="flex items-center gap-2 animate-[slide-up_0.2s_ease_both]"
                style={{ animationDelay: `${i * 0.04}s` }}
              >
                <span className="text-[0.75rem] text-[#4b5068] font-mono w-4 text-center flex-shrink-0">
                  {i + 1}
                </span>
                <input
                  type="text"
                  placeholder={`Option ${i + 1}`}
                  value={opt}
                  onChange={e => { updateOption(i, e.target.value); setError(''); }}
                  maxLength={80}
                  onKeyDown={e => { if (e.key === 'Enter') addOption(); }}
                  className="flex-1 bg-[#181b22] border border-white/7 rounded-lg px-3 py-2
                    text-sm text-[#f1f2f5] placeholder-[#4b5068] outline-none font-sans
                    focus:border-[#6366f1] focus:shadow-[0_0_0_3px_rgba(99,102,241,0.15)]
                    transition-all"
                />
                <button
                  onClick={() => removeOption(i)}
                  disabled={options.length <= 2}
                  className="text-[#4b5068] text-xs px-2 py-2 rounded-md border border-transparent
                    hover:text-[#ef4444] hover:border-red-500/30 hover:bg-red-500/8
                    disabled:opacity-20 disabled:cursor-not-allowed transition-all
                    cursor-pointer bg-transparent flex-shrink-0"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>

          {options.length < 8 && (
            <button
              onClick={addOption}
              className="w-full text-left text-sm text-[#4b5068] border border-dashed border-white/12
                rounded-lg px-3 py-2 hover:text-[#6366f1] hover:border-[#6366f1]
                hover:bg-[rgba(99,102,241,0.15)] transition-all cursor-pointer bg-transparent"
            >
              + Add option
            </button>
          )}
        </div>

        {error && (
          <p className="text-sm text-[#ef4444] bg-red-500/8 border border-red-500/20
            rounded-lg px-3 py-2.5 mb-4">
            {error}
          </p>
        )}

        {/* Footer */}
        <div className="flex justify-end gap-3 pt-5 border-t border-white/7">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-[#8b8fa8] border border-white/12
              rounded-lg hover:text-[#f1f2f5] hover:bg-[#1e2230] transition-all
              cursor-pointer bg-transparent"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium
              bg-[#6366f1] hover:bg-indigo-500 text-white rounded-lg transition-all
              disabled:opacity-70 cursor-pointer min-w-[110px] justify-center
              hover:shadow-[0_4px_16px_rgba(99,102,241,0.35)]"
          >
            {submitting ? (
              <>
                <span className="w-3.5 h-3.5 rounded-full border border-white/30 border-t-white animate-[spin_0.7s_linear_infinite]" />
                Saving…
              </>
            ) : 'Save changes'}
          </button>
        </div>
      </div>
    </div>
  );
}