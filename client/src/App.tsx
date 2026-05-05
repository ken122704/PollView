import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Home } from './screens/Home';
import { HostView } from './screens/HostView';
import { ParticipantView } from './screens/ParticipantView';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/host/:pollId" element={<HostView />} />
        <Route path="/join/:shortCode" element={<ParticipantView />} />
      </Routes>
    </BrowserRouter>
  );
}