import { Clock, CheckCircle, XCircle, Loader, Trash2, Eye, Download, RotateCcw } from "lucide-react";
import { useState } from "react";

const STATUS_ICON = {
  pending: Clock,
  parsing: Loader,
  generating_images: Loader,
  synthesizing_audio: Loader,
  composing: Loader,
  completed: CheckCircle,
  failed: XCircle,
};

const STATUS_CLASS = {
  pending: "badge-pending",
  parsing: "badge-processing",
  generating_images: "badge-processing",
  synthesizing_audio: "badge-processing",
  composing: "badge-processing",
  completed: "badge-completed",
  failed: "badge-failed",
};

export default function JobCard({ job, onDelete, onView, onDownload, onRetry }) {
  const [confirming, setConfirming] = useState(false);
  const Icon = STATUS_ICON[job.status] || Clock;

  const handleDelete = () => {
    if (confirming) {
      onDelete?.(job.id);
      setConfirming(false);
    } else {
      setConfirming(true);
      setTimeout(() => setConfirming(false), 3000);
    }
  };

  return (
    <div className="card job-card fade-in">
      <div className="job-card-row">
        <div className="job-card-info">
          <span className="job-title mono">{job.title}</span>
          <span className={`badge ${STATUS_CLASS[job.status] || "badge-pending"}`}>
            <Icon size={12} className={!["completed", "failed", "pending"].includes(job.status) ? "spin-icon" : ""} />
            {job.status}
          </span>
        </div>

        <div className="job-card-meta">
          {job.progress > 0 && job.progress < 100 && (
            <span className="mono text-cyan">{job.progress}%</span>
          )}
          <span className="text-muted text-xs">
            {job.created_at?.slice(0, 16) || "\u2014"}
          </span>
        </div>

        <div className="job-card-actions">
          {job.status === "failed" && (
            <button className="btn btn-sm btn-amber" onClick={() => onRetry?.(job.id)} title="重试任务">
              <RotateCcw size={14} />
            </button>
          )}
          {job.status === "completed" && (
            <>
              <button className="btn btn-sm" onClick={() => onView?.(job.id)} title="预览">
                <Eye size={14} />
              </button>
              <button className="btn btn-sm" onClick={() => onDownload?.(job.id)} title="下载">
                <Download size={14} />
              </button>
            </>
          )}
          <button
            className={`btn btn-sm ${confirming ? "btn-amber" : ""}`}
            onClick={handleDelete}
            title={confirming ? "确认删除" : "删除任务"}
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {job.error && (
        <div className="job-error mono">{job.error}</div>
      )}

      <style>{`
        .job-card {
          margin-bottom: 0;
          padding: 14px 18px;
        }
        .job-card-row {
          display: flex;
          align-items: center;
          gap: 16px;
        }
        .job-card-info {
          flex: 1;
          display: flex;
          align-items: center;
          gap: 12px;
          min-width: 0;
        }
        .job-title {
          font-size: 13px;
          font-weight: 500;
          color: var(--text-primary);
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .job-card-meta {
          display: flex;
          align-items: center;
          gap: 14px;
          font-size: 12px;
        }
        .job-card-actions {
          display: flex;
          gap: 6px;
        }
        .text-xs { font-size: 11px; }
        .job-error {
          margin-top: 10px;
          padding: 8px 12px;
          background: rgba(255, 61, 90, 0.08);
          border: 1px solid rgba(255, 61, 90, 0.2);
          border-radius: var(--radius-md);
          font-size: 11px;
          color: var(--error);
        }
        @keyframes spin-icon { to { transform: rotate(360deg); } }
        .spin-icon { animation: spin-icon 1.2s linear infinite; }
      `}</style>
    </div>
  );
}
