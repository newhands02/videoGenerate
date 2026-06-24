import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Play, Download, FileVideo, RefreshCw, Terminal } from "lucide-react";
import { useApi } from "../hooks/useApi";
import PipelineVisualizer from "../components/PipelineVisualizer";

export default function PreviewPage() {
  const [searchParams] = useSearchParams();
  const jobId = searchParams.get("job");
  const [job, setJob] = useState(null);
  const [logs, setLogs] = useState([]);
  const [logsOpen, setLogsOpen] = useState(false);
  const { getJob, BASE } = useApi();

  useEffect(() => {
    if (!jobId) return;
    const fetch = async () => {
      try {
        const data = await getJob(jobId);
        setJob(data);
        fetch(`http://localhost:8000/api/jobs/${jobId}/logs`)
          .then(r => r.json()).then(l => setLogs(l || [])).catch(() => {});
      } catch { /* silent */ }
    };
    fetch();
    const interval = setInterval(fetch, 2000);
    return () => clearInterval(interval);
  }, [jobId, getJob]);

  if (!jobId) {
    return (
      <div className="page">
        <div className="page-header">
          <h1 className="page-title">Video preview</h1>
        </div>
        <div className="empty-state">
          <FileVideo size={32} className="text-muted" />
          <span className="text-muted">Pick a job from the task list to preview</span>
        </div>
      </div>
    );
  }

  if (!job) {
    return (
      <div className="page">
        <div className="page-header"><h1 className="page-title">Loading...</h1></div>
        <div style={{ display: "flex", justifyContent: "center", padding: 60 }}><div className="spinner" /></div>
      </div>
    );
  }

  const segments = job.segments || [];
  const outputUrl = job.output_path ? `${BASE}/outputs/${job.output_path.split(/[/\\\\]/).pop()}` : null;
  const LEVEL_COLORS = { INFO: "var(--accent-cyan)", SUCCESS: "var(--success)", WARNING: "var(--warning)", ERROR: "var(--error)" };

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Preview: {job.title}</h1>
        <div className="page-header-actions">
          {job.status === "completed" && outputUrl && (
            <a className="btn btn-primary btn-sm" href={outputUrl} download>
              <Download size={14} /> Download video
            </a>
          )}
          <button className="btn btn-sm" onClick={() => setLogsOpen(!logsOpen)} title="View logs">
            <Terminal size={14} /> {logsOpen ? "Hide logs" : "View logs"}
          </button>
          <button className="btn btn-sm" onClick={() => window.location.reload()}>
            <RefreshCw size={14} /> Refresh
          </button>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <PipelineVisualizer status={job.status} progress={job.progress || 0} />
      </div>

      {logsOpen && logs.length > 0 && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-header">
            <span className="card-title"><Terminal size={14} /> Pipeline logs ({logs.length})</span>
          </div>
          <div className="log-viewer mono">
            {logs.map((l, i) => (
              <div key={i} className="log-line">
                <span className="log-time">{l.created_at?.slice(11, 19) || "--:--:--"}</span>
                <span className="log-level" style={{ color: LEVEL_COLORS[l.level] || "var(--text-muted)" }}>
                  {l.level}
                </span>
                <span className="log-msg">{l.message}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {outputUrl && (
        <div className="card" style={{ marginBottom: 20 }}>
          <video
            controls
            style={{ width: "100%", maxHeight: "70vh", borderRadius: "var(--radius-md)", background: "#000" }}
            src={outputUrl}
            poster={segments[0]?.image_path ? `${BASE}/outputs/${segments[0].image_path.split(/[/\\\\]/).pop()}` : ""}
          >
            Your browser does not support the video tag.
          </video>
        </div>
      )}

      {segments.length > 0 && (
        <div className="card">
          <div className="card-header">
            <span className="card-title">Segments ({segments.length})</span>
          </div>
          <div className="segment-grid">
            {segments.map((seg) => (
              <div key={seg.index_num} className="segment-item fade-in">
                <div className="segment-num mono">#{seg.index_num + 1}</div>
                {seg.image_path && (
                  <img
                    src={`${BASE}/outputs/${seg.image_path.split(/[/\\\\]/).pop()}`}
                    alt={`Segment ${seg.index_num}`}
                    className="segment-img"
                  />
                )}
                <div className="segment-text mono">{seg.text}</div>
                <div className="segment-status">
                  <span className={`badge ${seg.status === "audio_done" ? "badge-completed" : "badge-pending"}`}>
                    {seg.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {job.error && (
        <div className="card" style={{ marginTop: 20, borderColor: "rgba(255,61,90,0.3)" }}>
          <div className="card-header">
            <span className="card-title" style={{ color: "var(--error)" }}>Error info</span>
          </div>
          <pre className="error-block mono">{job.error}</pre>
        </div>
      )}

      <style>{`
        .segment-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
          gap: 12px;
        }
        .segment-item {
          background: var(--bg-surface);
          border: 1px solid var(--border);
          border-radius: var(--radius-md);
          overflow: hidden;
        }
        .segment-num {
          padding: 6px 10px;
          font-size: 11px;
          color: var(--accent-cyan);
          background: var(--accent-cyan-dim);
          border-bottom: 1px solid var(--border);
        }
        .segment-img {
          width: 100%;
          aspect-ratio: 9/16;
          object-fit: cover;
          display: block;
          background: var(--bg-deep);
        }
        .segment-text {
          padding: 8px 10px;
          font-size: 11px;
          color: var(--text-secondary);
          line-height: 1.5;
          max-height: 60px;
          overflow: hidden;
        }
        .segment-status {
          padding: 4px 10px 8px;
        }
        .error-block {
          padding: 12px;
          font-size: 11px;
          color: var(--error);
          background: rgba(255, 61, 90, 0.05);
          border-radius: var(--radius-md);
          white-space: pre-wrap;
          word-break: break-all;
        }
        .log-viewer {
          max-height: 400px;
          overflow-y: auto;
          background: var(--bg-deep);
          border: 1px solid var(--border);
          border-radius: var(--radius-md);
          padding: 10px 0;
        }
        .log-line {
          display: flex;
          gap: 12px;
          padding: 3px 16px;
          font-size: 11px;
          line-height: 1.8;
          transition: background 0.1s;
        }
        .log-line:hover {
          background: var(--bg-hover);
        }
        .log-time {
          color: var(--text-muted);
          white-space: nowrap;
          min-width: 70px;
        }
        .log-level {
          font-weight: 600;
          min-width: 62px;
          white-space: nowrap;
        }
        .log-msg {
          color: var(--text-secondary);
          word-break: break-all;
        }
      `}</style>
    </div>
  );
}
