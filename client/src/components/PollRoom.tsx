import { useEffect, useState, useCallback } from 'react';
import { socket } from '../socket';

interface PollOption {
  id: string;
  label: string;
  votes: number;
}

interface Poll {
  id: string;
  question: string;
  options: PollOption[];
  totalVotes: number;
}

interface AnalysisSummary {
  winner: string;
  winnerPercentage: string;
  totalVotes: number;
  breakdown: { label: string; votes: number; percentage: string }[];
}

export function PollRoom() {
  const [polls, setPolls] = useState<Poll[]>([]);
  const [activePoll, setActivePoll] = useState<Poll | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisSummary | null>(null);
  const [analysisStatus, setAnalysisStatus] = useState<string>('');
  const [connected, setConnected] = useState(false);
  const [votedOption, setVotedOption] = useState<string | null>(null);

  // ✅ FIX: Define joinPoll with useCallback BEFORE useEffect.
  // useCallback ensures the function reference is stable across renders.
  // Without it, every render creates a new function instance, which would
  // cause useEffect's dependency array to trigger on every render.
  const joinPoll = useCallback((pollId: string) => {
    socket.emit('join_poll', pollId);
    setVotedOption(null);
    setAnalysis(null);
    setAnalysisStatus('');
  }, []); // Empty array = this function reference never changes

  useEffect(() => {
    socket.connect();

    socket.on('connect', () => {
      setConnected(true);
      socket.emit('get_polls');
    });

    socket.on('disconnect', () => setConnected(false));

    socket.on('polls_list', (data: Poll[]) => {
      setPolls(data); // ✅ FIX: polls is now rendered in the JSX below
      // ✅ FIX: joinPoll is guaranteed to be defined here because
      // useCallback ran before useEffect during component initialization
      if (data.length > 0) {
        joinPoll(data[0].id);
      }
    });

    socket.on('poll_state', (poll: Poll) => {
      setActivePoll(poll);
    });

    socket.on('poll_update', (poll: Poll) => {
      setActivePoll(poll);
    });

    socket.on('analysis_queued', ({ message }: { message: string }) => {
      setAnalysisStatus(message);
      setAnalysis(null);
    });

    socket.on('analysis_complete', (summary: AnalysisSummary) => {
      setAnalysis(summary);
      setAnalysisStatus('');
    });

    socket.on('error_message', (msg: string) => {
      console.error('Socket error:', msg);
    });

    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.off('polls_list');
      socket.off('poll_state');
      socket.off('poll_update');
      socket.off('analysis_queued');
      socket.off('analysis_complete');
      socket.off('error_message');
      socket.disconnect();
    };
  }, [joinPoll]); // ✅ joinPoll is a stable ref, so this only runs once

  function vote(optionId: string) {
    if (!activePoll) return;
    socket.emit('cast_vote', { pollId: activePoll.id, optionId });
    setVotedOption(optionId);
  }

  function requestAnalysis() {
    if (!activePoll) return;
    socket.emit('analyze_poll', activePoll.id);
  }

  return (
    <div>
      {/* Connection Badge */}
      <div style={{ marginBottom: '1.5rem' }}>
        <span
          style={{
            display: 'inline-block',
            padding: '0.25rem 0.75rem',
            borderRadius: '999px',
            fontSize: '0.85rem',
            background: connected ? '#dcfce7' : '#fee2e2',
            color: connected ? '#15803d' : '#dc2626',
          }}
        >
          {connected ? '🟢 WebSocket Connected' : '🔴 Disconnected'}
        </span>
      </div>

      {/* ✅ FIX: Actually render the polls list so `polls` state is used */}
      {polls.length > 1 && (
        <div style={{ marginBottom: '1.5rem' }}>
          <h3 style={{ marginBottom: '0.5rem' }}>Available Polls</h3>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {polls.map((poll) => (
              <button
                key={poll.id}
                onClick={() => joinPoll(poll.id)}
                style={{
                  padding: '0.4rem 0.9rem',
                  borderRadius: '6px',
                  border: activePoll?.id === poll.id
                    ? '2px solid #6366f1'
                    : '2px solid #e2e8f0',
                  background: activePoll?.id === poll.id ? '#e0e7ff' : 'white',
                  cursor: 'pointer',
                  fontWeight: activePoll?.id === poll.id ? 600 : 400,
                }}
              >
                {poll.question}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Active Poll */}
      {activePoll && (
        <div
          style={{
            border: '1px solid #e2e8f0',
            borderRadius: '12px',
            padding: '1.5rem',
            marginBottom: '1.5rem',
          }}
        >
          <h2 style={{ marginTop: 0 }}>{activePoll.question}</h2>
          <p style={{ color: '#64748b' }}>
            Total votes: <strong>{activePoll.totalVotes}</strong>
          </p>

          {/* Vote Options */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {activePoll.options.map((opt) => {
              const pct =
                activePoll.totalVotes > 0
                  ? ((opt.votes / activePoll.totalVotes) * 100).toFixed(1)
                  : '0';
              const isVoted = votedOption === opt.id;

              return (
                <button
                  key={opt.id}
                  onClick={() => vote(opt.id)}
                  style={{
                    position: 'relative',
                    padding: '0.75rem 1rem',
                    border: isVoted ? '2px solid #6366f1' : '2px solid #e2e8f0',
                    borderRadius: '8px',
                    background: 'white',
                    cursor: 'pointer',
                    textAlign: 'left',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      position: 'absolute',
                      left: 0,
                      top: 0,
                      height: '100%',
                      width: `${pct}%`,
                      background: isVoted ? '#e0e7ff' : '#f1f5f9',
                      transition: 'width 0.4s ease',
                      zIndex: 0,
                    }}
                  />
                  <span style={{ position: 'relative', zIndex: 1, fontWeight: 500 }}>
                    {isVoted ? '✓ ' : ''}{opt.label}
                  </span>
                  <span
                    style={{
                      position: 'absolute',
                      right: '1rem',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      zIndex: 1,
                      color: '#64748b',
                      fontSize: '0.9rem',
                    }}
                  >
                    {opt.votes} ({pct}%)
                  </span>
                </button>
              );
            })}
          </div>

          {/* Analyze Button */}
          <button
            onClick={requestAnalysis}
            style={{
              marginTop: '1.25rem',
              padding: '0.6rem 1.25rem',
              background: '#6366f1',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: 600,
            }}
          >
            🔍 Analyze Results
          </button>

          {analysisStatus && (
            <p style={{ color: '#6366f1', marginTop: '0.75rem' }}>
              ⏳ {analysisStatus}
            </p>
          )}

          {analysis && (
            <div
              style={{
                marginTop: '1rem',
                padding: '1rem',
                background: '#f0fdf4',
                borderRadius: '8px',
                border: '1px solid #86efac',
              }}
            >
              <h3 style={{ margin: '0 0 0.5rem' }}>📊 Analysis Complete</h3>
              <p>
                🏆 Winner: <strong>{analysis.winner}</strong> with{' '}
                {analysis.winnerPercentage}% of {analysis.totalVotes} votes
              </p>
              <ul>
                {analysis.breakdown.map((b) => (
                  <li key={b.label}>
                    {b.label}: {b.votes} votes ({b.percentage}%)
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}