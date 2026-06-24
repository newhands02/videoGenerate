import { useState, useEffect, useRef } from "react";
import { Terminal, Search, Download, Copy, Check, Filter } from "lucide-react";
import { useApi } from "../hooks/useApi";

const LEVEL_FILTERS = ["ALL", "INFO", "SUCCESS", "WARNING", "ERROR"];
const LEVEL_COLORS = {
  INFO: "var(--accent-cyan)", SUCCESS: "var(--success)",
  WARNING: "var(--warning)", ERROR: "var(--error)",
};

export default function LogsPage() {
  const [jobs, setJobs] = useState([]);
  const [selectedJob, setSelectedJob] = useState(null);
  const [logs, setLogs] = useState([]);
  const [filter, setFilter] = useState("ALL");
  const [copied, setCopied] = useState(false);
  const { listJobs } = useApi();
  const bottomRef = useRef(null);

  useEffect(() => {
    listJobs().then(setJobs).catch(() => {});
  }, [listJobs]);

  useEffect(() => {
    if (!selectedJob) return;
    const fetchLogs = () => {
      fetch(`http://localhost:8000/api/jobs/${selectedJob}/logs`)
        .then(r => r.json())
        .then(data => setLogs(data || []))
        .catch(() => {});
    };
    fetchLogs();
    const interval = setInterval(fetchLogs, 3000);
    return () => clearInterval(interval);
  }, [selectedJob]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [logs]);

  const filteredLogs = filter === "ALL" ? logs : logs.filter(l => l.level === filter);

  const handleCopy = () => {
    const text = filteredLogs.map(l => `[${l.created_at}] [${l.level}] ${l.message}`).join("\n");
    navigator.clipboard.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  };

  const handleExport = () => {
    const text = filteredLogs.map(l => `[${l.created_at}] [${l.level}] ${l.message}`).join("\n");
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `logs_${selectedJob || "all"}.txt`; a.click();
    URL.revokeObjectURL(url);
  };

  const levelCounts = { ALL: logs.length };
  LEVEL_FILTERS.slice(1).forEach(lv => { levelCounts[lv] = logs.filter(l => l.level === lv).length; });

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">运行日志</h1>
          <span className="text-muted">{logs.length} 条记录</span>
        </div>
        <div className="page-header-actions">
          <button className="btn btn-sm" onClick={handleCopy} title="复制到剪贴板">
            {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? "已复制" : "复制"}
          </button>
          <button className="btn btn-sm" onClick={handleExport} title="导出为 TXT">
            <Download size={14} /> 导出
          </button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="card" style={{ marginBottom: 12, padding: "10px 14px" }}>
        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <Search size={14} className="text-muted" style={{ flexShrink: 0 }} />
          <select
            className="input-field"
            style={{ width: "auto", minWidth: 200, padding: "6px 10px", fontSize: 12 }}
            value={selectedJob || ""}
            onChange={e => setSelectedJob(e.target.value || null)}
          >
            <option value="">全部任务</option>
            {jobs.map(j => (
              <option key={j.id} value={j.id}>
                {j.title?.slice(0, 30) || j.id} [{j.status}]
              </option>
            ))}
          </select>
          <Filter size={14} className="text-muted" style={{ flexShrink: 0 }} />
          <div style={{ display: "flex", gap: 4 }}>
            {LEVEL_FILTERS.map(lv => (
              <button
                key={lv}
                className={`btn btn-xs ${filter === lv ? "btn-primary" : ""}`}
                onClick={() => setFilter(lv)}
                style={{ fontSize: 11 }}
              >
                {lv} <span className="mono" style={{ opacity: 0.6 }}>{levelCounts[lv] || 0}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Log content */}
      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        {filteredLogs.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center" }} className="text-muted">
            <Terminal size={24} style={{ marginBottom: 8 }} />
            <div>{selectedJob ? "该任务暂无日志" : "请选择一个任务查看日志"}</div>
          </div>
        ) : (
          <div className="log-table">
            {/* Header */}
            <div className="log-row log-header">
              <span className="log-col-time">时间</span>
              <span className="log-col-level">级别</span>
              <span className="log-col-msg">消息</span>
            </div>
            {/* Rows */}
            {filteredLogs.map((l, i) => (
              <div key={l.id || i} className={`log-row ${l.level === "ERROR" ? "log-row-error" : ""}`}>
                <span className="log-col-time mono text-muted">
                  {l.created_at?.slice(11, 19) || "--:--:--"}
                </span>
                <span className="log-col-level" style={{ color: LEVEL_COLORS[l.level] || "var(--text-muted)" }}>
                  <span className={`badge ${l.level === "ERROR" ? "badge-failed" : l.level === "SUCCESS" ? "badge-completed" : l.level === "WARNING" ? "badge-processing" : "badge-pending"}`}>
                    {l.level}
                  </span>
                </span>
                <span className="log-col-msg mono">{l.message}</span>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      <style>{`
        .log-table {
          font-size: 12px;
        }
        .log-row {
          display: flex;
          gap: 12px;
          padding: 5px 16px;
          align-items: flex-start;
          border-bottom: 1px solid var(--border);
          transition: background 0.1s;
        }
        .log-row:hover { background: var(--bg-hover); }
        .log-header {
          background: var(--bg-surface);
          font-weight: 600;
          color: var(--text-secondary);
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          border-bottom: 2px solid var(--border-active);
          position: sticky; top: 0; z-index: 2;
        }
        .log-row-error { background: rgba(255,61,90,0.04); }
        .log-row-error:hover { background: rgba(255,61,90,0.08); }
        .log-col-time { min-width: 72px; flex-shrink: 0; padding-top: 1px; }
        .log-col-level { min-width: 72px; flex-shrink: 0; }
        .log-col-msg { flex: 1; word-break: break-all; line-height: 1.6; color: var(--text-primary); }
      `}</style>
    </div>
  );
}
