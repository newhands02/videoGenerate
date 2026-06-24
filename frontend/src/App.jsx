import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import CreatePage from './pages/CreatePage';
import JobsPage from './pages/JobsPage';
import PreviewPage from './pages/PreviewPage';
import DownloadsPage from './pages/DownloadsPage';
import LogsPage from './pages/LogsPage';

export default function App() {
  return (
    <BrowserRouter>
      <div style={{ display: 'flex', minHeight: '100vh' }}>
        <Sidebar />
        <main style={mainStyle}>
          <Routes>
            <Route path="/" element={<CreatePage />} />
            <Route path="/jobs" element={<JobsPage />} />
            <Route path="/preview" element={<PreviewPage />} />
            <Route path="/downloads" element={<DownloadsPage />} />
            <Route path="/logs" element={<LogsPage />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

const mainStyle = {
  flex: 1,
  overflow: 'auto',
  position: 'relative',
  zIndex: 1,
};

/* Page layout shared styles (injected via App since they're not in index.css) */
const pageStyle = document.createElement('style');
pageStyle.textContent = `
  .page {
    padding: 28px 32px;
    max-width: 1200px;
  }
  .page-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    margin-bottom: 24px;
    gap: 16px;
  }
  .page-title {
    font-size: 20px;
    font-weight: 700;
    color: var(--text-primary);
    letter-spacing: -0.3px;
  }
  .page-header-actions {
    display: flex;
    gap: 8px;
    flex-shrink: 0;
  }
  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    padding: 60px 20px;
  }
  @media (max-width: 768px) {
    .page { padding: 16px; }
    .page-header { flex-direction: column; }
  }
`;
document.head.appendChild(pageStyle);
