import { useEffect, useState, useCallback } from 'react';
import { socket } from '../socket';
import { CreatePollModal } from  './CreatePollModal';
import type { Poll, AnalysisSummary } from '../types/poll';
import './PollRoom.css';


export function PollRoom() {
  const [polls, setPolls]               = useState<Poll[]>([]);
  const [activePoll, setActivePoll]     = useState<Poll | null>(null);
  const [analysis, setAnalysis]         = useState<AnalysisSummary | null>(null);
  const [analysisStatus, setAnalysisStatus] = useState('');
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [connected, setConnected]       = useState(false);
  const [votedOption, setVotedOption]   = useState<string | null>(null);
  const [showCreate, setShowCreate]     = useState(false);
  const [justVoted, setJustVoted]       = useState(false);

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

    socket.on('connect', () => {
      setConnected(true);
      socket.emit('get_polls');
    });
    socket.on('disconnect', () => setConnected(false));
    socket.on('polls_list', (data: Poll[]) => {
      setPolls(data);
      if (data.length > 0) joinPoll(data[0].id);
    });
    socket.on('poll_created', (poll: Poll) => {
      setPolls(prev => {
        if (prev.find(p => p.id === poll.id)) return prev;
        return [...prev, poll];
      });
    });
    socket.on('poll_state',  (poll: Poll) => setActivePoll(poll));
    socket.on('poll_update', (poll: Poll) => setActivePoll(poll));
    socket.on('analysis_queued', ({ message }: { message: string }) => {
      setAnalysisStatus(message);
      setAnalysisLoading(true);
      setAnalysis(null);
    });
    socket.on('analysis_complete', (summary: AnalysisSummary) => {
      setAnalysis(summary);
      setAnalysisStatus('');
      setAnalysisLoading(false);
    });
    socket.on('error_message', (msg: string) => console.error('Socket error:', msg));

    return () => {
      ['connect','disconnect','polls_list','poll_created','poll_state',
       'poll_update','analysis_queued','analysis_complete','error_message']
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
    setPolls(prev => {
      if (prev.find(p => p.id === poll.id)) return prev;
      return [...prev, poll];
    });
    joinPoll(poll.id);
    setShowCreate(false);
  }

  return (
    <div className="poll-room">
      {/* ── Page title row ── */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Live Polls</h1>
          <p className="page-sub">Votes update in real-time across all connected clients</p>
        </div>
        <button className="btn-primary" onClick={() => setShowCreate(true)}>
          <span>+</span> New Poll
        </button>
      </div>

      {/* ── Connection badge ── */}
      <div className={`ws-badge ${connected ? 'ws-on' : 'ws-off'}`}>
        <span className="ws-dot" />
        {connected ? 'WebSocket connected' : 'Disconnected'}
      </div>

      <div className="room-layout">
        {/* ── Sidebar: poll list ── */}
        <aside className="poll-sidebar">
          <p className="sidebar-label">POLLS  <span className="poll-count">{polls.length}</span></p>
          <div className="poll-list">
            {polls.length === 0 && (
              <p className="empty-hint">No polls yet.<br/>Create one to get started.</p>
            )}
            {polls.map(poll => (
              <button
                key={poll.id}
                className={`poll-tab ${activePoll?.id === poll.id ? 'active' : ''}`}
                onClick={() => joinPoll(poll.id)}
              >
                <span className="poll-tab-question">{poll.question}</span>
                <span className="poll-tab-meta mono">{poll.totalVotes} votes</span>
              </button>
            ))}
          </div>
          <button className="btn-ghost sidebar-new" onClick={() => setShowCreate(true)}>
            + Create poll
          </button>
        </aside>

        {/* ── Main: active poll ── */}
        <section className="poll-main">
          {!activePoll && (
            <div className="poll-empty">
              <div className="empty-icon">◈</div>
              <p>Select a poll from the left or create a new one</p>
            </div>
          )}

          {activePoll && (
            <div className={`poll-card ${justVoted ? 'just-voted' : ''}`}>
              {/* Card header */}
              <div className="poll-card-header">
                <span className="live-badge"><span className="live-dot"/>LIVE</span>
                <span className="vote-count mono">{activePoll.totalVotes} votes</span>
              </div>

              <h2 className="poll-question">{activePoll.question}</h2>

              {/* Options */}
              <div className="options-list">
                {activePoll.options.map((opt, i) => {
                  const pct = activePoll.totalVotes > 0
                    ? (opt.votes / activePoll.totalVotes) * 100 : 0;
                  const isVoted   = votedOption === opt.id;
                  const isWinning = activePoll.totalVotes > 0 &&
                    opt.votes === Math.max(...activePoll.options.map(o => o.votes));

                  return (
                    <button
                      key={opt.id}
                      className={`option-btn ${isVoted ? 'voted' : ''} ${isWinning && activePoll.totalVotes > 0 ? 'winning' : ''} ${votedOption && !isVoted ? 'dimmed' : ''}`}
                      onClick={() => vote(opt.id)}
                      disabled={!!votedOption}
                      style={{ '--delay': `${i * 0.05}s` } as React.CSSProperties}
                    >
                      <div className="option-bar" style={{ width: `${pct}%` }} />
                      <div className="option-content">
                        <span className="option-label">
                          {isVoted && <span className="check">✓</span>}
                          {opt.label}
                        </span>
                        <span className="option-stats mono">
                          <span className="option-pct">{pct.toFixed(1)}%</span>
                          <span className="option-votes">{opt.votes}</span>
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>

              {votedOption && (
                <p className="voted-hint">✓ Vote recorded — results update live</p>
              )}

              {/* Analyze button */}
              <div className="card-footer">
                <button
                  className={`btn-analyze ${analysisLoading ? 'loading' : ''}`}
                  onClick={requestAnalysis}
                  disabled={analysisLoading}
                >
                  {analysisLoading ? (
                    <><span className="btn-spinner"/><span>Analyzing…</span></>
                  ) : (
                    <><span>⬡</span><span>Analyze Results</span></>
                  )}
                </button>
                {analysisStatus && !analysis && (
                  <span className="analysis-hint">{analysisStatus}</span>
                )}
              </div>

              {/* Analysis result */}
              {analysis && (
                <div className="analysis-card">
                  <div className="analysis-header">
                    <span className="analysis-title">Analysis complete</span>
                    <span className="analysis-time mono">
                      {new Date(analysis.generatedAt).toLocaleTimeString()}
                    </span>
                  </div>
                  <div className="winner-row">
                    <span className="winner-label">Winner</span>
                    <span className="winner-value">{analysis.winner}</span>
                    <span className="winner-pct mono">{analysis.winnerPercentage}%</span>
                  </div>
                  <div className="analysis-breakdown">
                    {analysis.breakdown.map(b => (
                      <div key={b.label} className="breakdown-row">
                        <span className="breakdown-label">{b.label}</span>
                        <div className="breakdown-bar-wrap">
                          <div
                            className="breakdown-bar"
                            style={{ width: `${b.percentage}%` }}
                          />
                        </div>
                        <span className="breakdown-pct mono">{b.percentage}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </section>
      </div>

      {/* ── Create Poll Modal ── */}
      {showCreate && (
        <CreatePollModal
          onClose={() => setShowCreate(false)}
          onCreated={handlePollCreated}
          socket={socket}
        />
      )}
    </div>
  );
}