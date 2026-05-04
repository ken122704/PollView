import { useHealthCheck } from './hooks/useHealthCheck';
import { PollRoom } from './components/PollRoom';

export default function App() {
  const { health, error, loading } = useHealthCheck();

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-white/7 bg-[#0a0b0f]/85 backdrop-blur-md">
        <div className="max-w-4xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-[#6366f1] text-lg leading-none">◈</span>
            <span className="text-[#f1f2f5] font-semibold text-sm tracking-tight">Pollwave</span>
          </div>
          <StatusPill loading={loading} error={error} health={health} />
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 max-w-4xl mx-auto w-full px-6 py-8 pb-16">
        {loading && (
          <div className="flex flex-col items-center gap-4 py-24 text-[#8b8fa8] text-sm">
            <div className="w-7 h-7 rounded-full border-2 border-white/12 border-t-[#6366f1] animate-[spin_0.7s_linear_infinite]" />
            <p>Establishing connection…</p>
          </div>
        )}
        {error && (
          <div className="flex flex-col items-center gap-3 py-24 text-[#8b8fa8] text-sm text-center">
            <span className="text-3xl text-[#f59e0b]">⚠</span>
            <p>Cannot reach server.<br />Make sure the backend is running on port 3001.</p>
          </div>
        )}
        {health && <PollRoom />}
      </main>
    </div>
  );
}

function StatusPill({
  loading, error, health
}: {
  loading: boolean;
  error: string | null;
  health: { uptime: number } | null;
}) {
  if (loading) return (
    <div className="flex items-center gap-2 text-xs font-medium px-3 py-1.5 rounded-full border border-white/12 bg-[#111318] text-[#8b8fa8]">
      <span className="w-1.5 h-1.5 rounded-full bg-[#f59e0b] animate-[pulse-dot_1s_infinite]" />
      Connecting…
    </div>
  );
  if (error) return (
    <div className="flex items-center gap-2 text-xs font-medium px-3 py-1.5 rounded-full border border-red-500/20 bg-red-500/8 text-[#ef4444]">
      <span className="w-1.5 h-1.5 rounded-full bg-[#ef4444]" />
      Server offline
    </div>
  );
  return (
    <div className="flex items-center gap-2 text-xs font-medium px-3 py-1.5 rounded-full border border-green-500/20 bg-green-500/12 text-[#22c55e]">
      <span className="w-1.5 h-1.5 rounded-full bg-[#22c55e] shadow-[0_0_6px_#22c55e] animate-[pulse-dot_2s_infinite]" />
      Live · {Math.floor(health!.uptime)}s
    </div>
  );
}