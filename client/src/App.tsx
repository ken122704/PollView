import { useHealthCheck } from './hooks/useHealthCheck';
import { PollRoom } from './components/PollRoom';
import './App.css';

function App() {
  const { health, error, loading } = useHealthCheck();

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '2rem' }}>
      <h1>⚡ Real-Time Polling App</h1>

      {/* Server Status Banner */}
      <div
        style={{
          padding: '0.75rem 1rem',
          borderRadius: '8px',
          marginBottom: '2rem',
          background: loading ? '#f0f0f0' : error ? '#fee2e2' : '#dcfce7',
          color: loading ? '#666' : error ? '#dc2626' : '#16a34a',
          fontWeight: 500,
        }}
      >
        {loading && '⏳ Connecting to server...'}
        {error && `❌ Server offline: ${error}`}
        {health && `✅ Server online · Uptime: ${Math.floor(health.uptime)}s`}
      </div>

      {/* Poll Room — only mount once server is confirmed alive */}
      {health && <PollRoom />}
    </div>
  );
}

export default App;