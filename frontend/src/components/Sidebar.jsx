import { FilePlus, ListVideo, Eye, Download, Zap, Terminal } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";

const NAV_ITEMS = [
  { id: "create", label: "新建任务", icon: FilePlus, path: "/" },
  { id: "jobs", label: "任务队列", icon: ListVideo, path: "/jobs" },
  { id: "preview", label: "视频预览", icon: Eye, path: "/preview" },
  { id: "downloads", label: "下载管理", icon: Download, path: "/downloads" },
  { id: "logs", label: "运行日志", icon: Terminal, path: "/logs" },
];

export default function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <aside className="sidebar">
      <div className="sidebar-brand" onClick={() => navigate("/")}>
        <Zap size={22} className="text-cyan" />
        <div>
          <span className="brand-name">AIVideo</span>
          <span className="brand-sub">图文混剪平台</span>
        </div>
      </div>

      <nav className="sidebar-nav">
        {NAV_ITEMS.map((item) => {
          const isActive = location.pathname === item.path;
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              className={`sidebar-link ${isActive ? "active" : ""}`}
              onClick={() => navigate(item.path)}
            >
              <Icon size={18} />
              <span>{item.label}</span>
              {isActive && <div className="sidebar-active-indicator" />}
            </button>
          );
        })}
      </nav>

      <div className="sidebar-footer">
        <span className="text-muted text-xs">v1.0.0</span>
      </div>

      <style>{`
        .sidebar {
          width: 220px;
          min-width: 220px;
          height: 100vh;
          background: var(--bg-surface);
          border-right: 1px solid var(--border);
          display: flex;
          flex-direction: column;
          position: sticky;
          top: 0;
          z-index: 10;
        }
        .sidebar-brand {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 20px 18px;
          border-bottom: 1px solid var(--border);
          cursor: pointer;
          user-select: none;
        }
        .brand-name {
          display: block;
          font-size: 16px;
          font-weight: 700;
          font-family: var(--font-mono);
          color: var(--text-primary);
          letter-spacing: 0.5px;
        }
        .brand-sub {
          display: block;
          font-size: 11px;
          color: var(--text-muted);
          margin-top: -2px;
        }
        .sidebar-nav {
          flex: 1;
          padding: 12px 10px;
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        .sidebar-link {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px 12px;
          border: none;
          border-radius: var(--radius-md);
          background: transparent;
          color: var(--text-secondary);
          font-family: var(--font-sans);
          font-size: 13px;
          cursor: pointer;
          transition: all var(--transition);
          position: relative;
          text-align: left;
        }
        .sidebar-link:hover {
          background: var(--bg-hover);
          color: var(--text-primary);
        }
        .sidebar-link.active {
          background: var(--accent-cyan-dim);
          color: var(--accent-cyan);
        }
        .sidebar-active-indicator {
          position: absolute;
          right: 0;
          top: 50%;
          transform: translateY(-50%);
          width: 3px;
          height: 20px;
          background: var(--accent-cyan);
          border-radius: 2px;
        }
        .sidebar-footer {
          padding: 16px 18px;
          border-top: 1px solid var(--border);
        }
        .text-xs { font-size: 11px; }
      `}</style>
    </aside>
  );
}
