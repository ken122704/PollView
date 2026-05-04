import { useEffect, useState, useCallback } from 'react';
import { socket } from '../socket';
import { CreatePollModal } from './CreatePollModal';
import { EditPollModal } from './EditPollModal';
import type { Poll, AnalysisSummary } from '../types/poll';

export function PollRoom() {
  const [polls, setPolls]                     = useState<Poll[]>([]);
  const [activePoll, setActivePoll]           = useState<Poll | null>(null);
  const [analysis, setAnalysis]               = useState<AnalysisSummary | null>(null);
  const [analysisStatus, setAnalysisStatus]   = useState('');
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [connected, setConnected]             = useState(false);
  const [votedOption, setVotedOption]         = useState<string | null>(null);
  const [showCreate, setShowCreate]           = useState(false);
  const [justVoted, setJustVoted]             = useState(false);
  const [editingPoll, setEditingPoll]         = useState<Poll | null>(null);

  const joinPoll = useCallback((pollId: string) => {
    socket.emit('join_poll', pollId);
    setVotedOption(null);
    setAnalysis(null);
    setAnalysisStatus('');
    setAnalysisLoading(false);
    setJustVoted(false);
  }, []);

  useEffect(() => {
    socket.connect();
    socket.on('connect', () => { setConnected(true); socket.emit('get_polls'); });
    socket.on('disconnect', () => setConnected(false));
    socket.on('polls_list', (data: Poll[]) => {
      setPolls(data);
      if (data.length > 0) joinPoll(data[0].id);
    });
    socket.on('poll_created', (poll: Poll) => {
      setPolls(prev => prev.find(p => p.id === poll.id) ? prev : [...prev, poll]);
    });
    socket.on('poll_state',  (poll: Poll) => setActivePoll(poll));
    socket.on('poll_update', (poll: Poll) => setActivePoll(poll));
    socket.on('analysis_queued', ({ message }: { message: string }) => {
      setAnalysisStatus(message); setAnalysisLoading(true); setAnalysis(null);
    });
    socket.on('analysis_complete', (summary: AnalysisSummary) => {
      setAnalysis(summary); setAnalysisStatus(''); setAnalysisLoading(false);
    });
    socket.on('error_message', (msg: string) => console.error('Socket error:', msg));
    socket.on('poll_updated_meta', (updated: Poll) => {
      setPolls(prev => prev.map(p => p.id === updated.id ? updated : p));
      setActivePoll(prev => prev?.id === updated.id ? updated : prev);
    });

    return () => {
      ['connect','disconnect','polls_list','poll_created','poll_state','poll_update',
       'analysis_queued','analysis_complete','error_message','poll_updated_meta']
        .forEach(e => socket.off(e));
      socket.disconnect();
    };
  }, [joinPoll]);

  function vote(optionId: string) {
    if (!activePoll || votedOption) return;
    socket.emit('cast_vote', { pollId: activePoll.id, optionId });
    setVotedOption(optionId);
    setJustVoted(true);
    setTimeout(() => setJustVoted(false), 600);
  }

  function requestAnalysis() {
    if (!activePoll || analysisLoading) return;
    socket.emit('analyze_poll', activePoll.id);
  }

  function handlePollCreated(poll: Poll) {
    setPolls(prev => prev.find(p => p.id === poll.id) ? prev : [...prev, poll]);
    joinPoll(poll.id);
    setShowCreate(false);
  }

  function handlePollUpdated(updated: Poll) {
    setPolls(prev => prev.map(p => p.id === updated.id ? updated : p));
    setActivePoll(prev => prev?.id === updated.id ? updated : prev);
    setEditingPoll(null);
  }

  return (
    <div className="flex flex-col gap-5">

      {/* Page header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-[#f1f2f5]">Live Polls</h1>
          <p className="text-sm text-[#4b5068] mt-1">Votes update in real-time across all connected clients</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-1.5 px-4 py-2 bg-[#6366f1] hover:bg-indigo-500 text-white text-sm font-medium rounded-lg transition-all hover:-translate-y-px hover:shadow-[0_4px_16px_rgba(99,102,241,0.35)] active:translate-y-0 whitespace-nowrap cursor-pointer"
        >
          <span>+</span> New Poll
        </button>
      </div>

      {/* WS badge */}
      <div className={`inline-flex items-center gap-1.5 text-xs font-medium ${connected ? 'text-[#22c55e]' : 'text-[#ef4444]'}`}>
        <span className={`w-1.5 h-1.5 rounded-full ${connected
          ? 'bg-[#22c55e] shadow-[0_0_5px_#22c55e] animate-[pulse-dot_2s_infinite]'
          : 'bg-[#ef4444]'}`}
        />
        {connected ? 'WebSocket connected' : 'Disconnected'}
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-[240px_1fr] gap-4 items-start max-[680px]:grid-cols-1">

        {/* Sidebar */}
        <aside className="bg-[#111318] border border-white/7 rounded-2xl p-3 flex flex-col gap-2">
          <p className="text-[0.68rem] font-semibold tracking-widest text-[#4b5068] px-1 flex items-center gap-2">
            POLLS
            <span className="bg-[#181b22] text-[#8b8fa8] rounded-full text-[0.68rem] px-2 py-0.5 font-medium tracking-normal">
              {polls.length}
            </span>
          </p>

          <div className="flex flex-col gap-1 max-h-[400px] overflow-y-auto">
            {polls.length === 0 && (
              <p className="text-xs text-[#4b5068] text-center py-6 px-2 leading-relaxed">
                No polls yet.<br />Create one to get started.
              </p>
            )}
            {polls.map(poll => (
              <div
                key={poll.id}
                className={`group relative flex rounded-lg overflow-hidden border transition-all
                  ${activePoll?.id === poll.id
                    ? 'bg-[rgba(99,102,241,0.15)] border-[rgba(99,102,241,0.3)]'
                    : 'border-transparent hover:bg-[#1e2230] hover:border-white/7'}`}
              >
                <button
                  className="flex-1 text-left px-3 py-2.5 flex flex-col gap-0.5 cursor-pointer bg-transparent border-none"
                  onClick={() => joinPoll(poll.id)}
                >
                  <span className={`text-[0.83rem] font-medium leading-snug line-clamp-2
                    ${activePoll?.id === poll.id ? 'text-indigo-300' : 'text-[#f1f2f5]'}`}>
                    {poll.question}
                  </span>
                  <span className="text-[0.72rem] text-[#4b5068] font-mono">
                    {poll.totalVotes} votes
                  </span>
                </button>

                {/* Edit button — hidden until hover or active */}
                <button
                  onClick={e => { e.stopPropagation(); setEditingPoll(poll); }}
                  aria-label="Edit poll"
                  title="Edit poll"
                  className={`flex-shrink-0 flex items-center justify-center text-sm
                    text-[#4b5068] hover:text-[#6366f1] hover:bg-[rgba(99,102,241,0.15)]
                    border-l border-white/7 transition-all cursor-pointer bg-transparent
                    w-0 overflow-hidden opacity-0
                    group-hover:w-8 group-hover:opacity-100
                    ${activePoll?.id === poll.id ? 'w-8 opacity-100' : ''}`}
                >
                  ✎
                </button>
              </div>
            ))}
          </div>

          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center justify-center gap-1.5 px-3 py-2 w-full
              text-[#4b5068] text-[0.82rem] font-medium border border-dashed border-white/12
              rounded-lg hover:text-[#6366f1] hover:border-[#6366f1] hover:bg-[rgba(99,102,241,0.15)]
              transition-all cursor-pointer bg-transparent mt-0.5"
          >
            + Create poll
          </button>
        </aside>

        {/* Main panel */}
        <section>
          {!activePoll && (
            <div className="flex flex-col items-center justify-center gap-4 py-20 text-[#4b5068] text-sm text-center">
              <span className="text-4xl opacity-40">◈</span>
              <p>Select a poll from the left or create a new one</p>
            </div>
          )}

          {activePoll && (
            <div className={`bg-[#111318] border rounded-2xl p-7 transition-all duration-300
              ${justVoted
                ? 'border-[#6366f1] shadow-[0_0_0_1px_#6366f1,0_0_24px_rgba(99,102,241,0.35)]'
                : 'border-white/7'}`}
            >
              {/* Card header */}
              <div className="flex items-center justify-between mb-4">
                <span className="inline-flex items-center gap-1.5 text-[0.68rem] font-semibold tracking-widest text-[#22c55e] bg-[rgba(34,197,94,0.12)] border border-[rgba(34,197,94,0.2)] rounded-full px-2.5 py-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#22c55e] animate-[pulse-dot_1.5s_infinite]" />
                  LIVE
                </span>
                <div className="flex items-center gap-3">
                  <span className="text-[0.82rem] text-[#4b5068] font-mono">
                    {activePoll.totalVotes} votes
                  </span>
                  <button
                    onClick={() => setEditingPoll(activePoll)}
                    className="flex items-center gap-1.5 px-2.5 py-1 text-xs text-[#4b5068]
                      border border-white/12 rounded-md hover:text-[#6366f1]
                      hover:border-[rgba(99,102,241,0.4)] hover:bg-[rgba(99,102,241,0.15)]
                      transition-all cursor-pointer bg-transparent font-medium"
                  >
                    ✎ Edit
                  </button>
                </div>
              </div>

              <h2 className="text-xl font-semibold tracking-tight text-[#f1f2f5] leading-snug mb-6">
                {activePoll.question}
              </h2>

              {/* Options */}
              <div className="flex flex-col gap-2.5 mb-4">
                {activePoll.options.map((opt, i) => {
                  const pct = activePoll.totalVotes > 0
                    ? (opt.votes / activePoll.totalVotes) * 100 : 0;
                  const isVoted   = votedOption === opt.id;
                  const isWinning = activePoll.totalVotes > 0 &&
                    opt.votes === Math.max(...activePoll.options.map(o => o.votes));

                  return (
                    <button
                      key={opt.id}
                      onClick={() => vote(opt.id)}
                      disabled={!!votedOption}
                      style={{ animationDelay: `${i * 0.05}s` }}
                      className={[
                        'relative w-full text-left rounded-lg border overflow-hidden transition-all',
                        'animate-[slide-up_0.3s_cubic-bezier(0.4,0,0.2,1)_both]',
                        isVoted
                          ? 'border-[#6366f1] bg-[rgba(99,102,241,0.15)] cursor-default'
                          : votedOption
                          ? 'border-white/7 bg-[#181b22] opacity-55 cursor-default'
                          : isWinning
                          ? 'border-[rgba(99,102,241,0.25)] bg-[#181b22] hover:border-[#6366f1] hover:bg-[#1e2230] hover:-translate-y-px cursor-pointer'
                          : 'border-white/7 bg-[#181b22] hover:border-[#6366f1] hover:bg-[#1e2230] hover:-translate-y-px cursor-pointer',
                      ].join(' ')}
                    >
                      {/* Progress bar */}
                      <div
                        className={`absolute inset-0 transition-[width] duration-500 ease-[cubic-bezier(0.4,0,0.2,1)] pointer-events-none
                          ${isVoted
                            ? 'bg-gradient-to-r from-[rgba(99,102,241,0.2)] to-transparent'
                            : 'bg-gradient-to-r from-[rgba(99,102,241,0.1)] to-transparent'}`}
                        style={{ width: `${pct}%` }}
                      />
                      <div className="relative flex items-center justify-between px-4 py-3.5 gap-2">
                        <span className="text-sm font-medium text-[#f1f2f5] flex items-center gap-1.5">
                          {isVoted && <span className="text-[#6366f1] text-xs">✓</span>}
                          {opt.label}
                        </span>
                        <span className="flex items-center gap-3 font-mono flex-shrink-0">
                          <span className="text-[0.82rem] text-[#8b8fa8] min-w-[42px] text-right">
                            {pct.toFixed(1)}%
                          </span>
                          <span className="text-[0.78rem] text-[#4b5068] min-w-[24px] text-right">
                            {opt.votes}
                          </span>
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>

              {votedOption && (
                <p className="text-xs text-[#6366f1] opacity-85 mb-4">
                  ✓ Vote recorded — results update live
                </p>
              )}

              {/* Footer */}
              <div className="flex items-center gap-4 pt-5 border-t border-white/7 flex-wrap">
                <button
                  onClick={requestAnalysis}
                  disabled={analysisLoading}
                  className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg
                    border transition-all cursor-pointer
                    ${analysisLoading
                      ? 'text-[#6366f1] border-[rgba(99,102,241,0.3)] bg-transparent opacity-80 cursor-default'
                      : 'text-[#8b8fa8] border-white/12 bg-[#181b22] hover:text-[#f1f2f5] hover:border-[#6366f1] hover:bg-[rgba(99,102,241,0.15)]'}`}
                >
                  {analysisLoading ? (
                    <>
                      <span className="w-3.5 h-3.5 rounded-full border border-[rgba(99,102,241,0.3)] border-t-[#6366f1] animate-[spin_0.7s_linear_infinite]" />
                      Analyzing…
                    </>
                  ) : (
                    <><span>⬡</span> Analyze Results</>
                  )}
                </button>
                {analysisStatus && !analysis && (
                  <span className="text-xs text-[#4b5068] italic">{analysisStatus}</span>
                )}
              </div>

              {/* Analysis result */}
              {analysis && (
                <div className="mt-5 bg-[#181b22] border border-white/12 rounded-xl p-5 animate-[slide-up_0.3s_ease_both]">
                  <div className="flex justify-between items-center mb-4">
                    <span className="text-[0.78rem] font-semibold tracking-widest text-[#4b5068] uppercase">
                      Analysis complete
                    </span>
                    <span className="text-[0.75rem] text-[#4b5068] font-mono">
                      {new Date(analysis.generatedAt).toLocaleTimeString()}
                    </span>
                  </div>

                  <div className="flex items-center gap-3 mb-5 px-4 py-3 bg-[rgba(99,102,241,0.15)] border border-[rgba(99,102,241,0.2)] rounded-lg">
                    <span className="text-[0.72rem] font-semibold tracking-widest text-[#6366f1] uppercase flex-shrink-0">
                      Winner
                    </span>
                    <span className="text-sm font-semibold text-[#f1f2f5] flex-1">
                      {analysis.winner}
                    </span>
                    <span className="text-base font-medium text-[#6366f1] font-mono">
                      {analysis.winnerPercentage}%
                    </span>
                  </div>

                  <div className="flex flex-col gap-2.5">
                    {analysis.breakdown.map(b => (
                      <div key={b.label} className="grid grid-cols-[1fr_120px_40px] items-center gap-3">
                        <span className="text-[0.82rem] text-[#8b8fa8] truncate">{b.label}</span>
                        <div className="h-1 bg-[#1e2230] rounded-full overflow-hidden">
                          <div
                            className="h-full bg-[#6366f1] rounded-full opacity-70 transition-[width] duration-500"
                            style={{ width: `${b.percentage}%` }}
                          />
                        </div>
                        <span className="text-[0.78rem] text-[#4b5068] font-mono text-right">
                          {b.percentage}%
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </section>
      </div>

      {showCreate && (
        <CreatePollModal
          onClose={() => setShowCreate(false)}
          onCreated={handlePollCreated}
          socket={socket}
        />
      )}

      {editingPoll && (
        <EditPollModal
          poll={editingPoll}
          onClose={() => setEditingPoll(null)}
          onUpdated={handlePollUpdated}
          socket={socket}
        />
      )}
    </div>
  );
}