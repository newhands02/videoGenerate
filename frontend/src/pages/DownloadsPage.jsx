import { useState, useEffect, useCallback } from "react";
import { Download, FolderOpen, FileVideo, Trash2, ExternalLink } from "lucide-react";
import { useApi } from "../hooks/useApi";

export default function DownloadsPage() {
  const [jobs, setJobs] = useState([]);
  const { listJobs, deleteJob, loading } = useApi();

  const fetchJobs = useCallback(async () => {
    try {
      const data = await listJobs();
      setJobs((data || []).filter((j) => j.status === "completed" && j.output_path));
    } catch { /* silent */ }
  }, [listJobs]);

  useEffect(() => { fetchJobs(); }, [fetchJobs]);

  const handleDelete = async (id) => {
    await deleteJob(id);
    setJobs((prev) => prev.filter((j) => j.id !== id));
  };

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">下载管理</h1>
          <span className="text-muted">{jobs.length} 个已完成视频</span>
        </div>
        {jobs.length > 0 && (
          <button className="btn btn-sm" onClick={() => window.open("http://localhost:8000")}>
            <FolderOpen size={14} /> 输出目录
          </button>
        )}
      </div>

      {jobs.length === 0 ? (
        <div className="empty-state">
          <FileVideo size={32} className="text-muted" />
          <span className="text-muted">暂无已完成的视频</span>
          <span className="text-muted">完成视频生成后，可在此管理和下载</span>
        </div>
      ) : (
        <div className="download-grid">
          {jobs.map((job) => {
            const filename = job.output_path?.split(/[/\\]/).pop() || "output.mp4";
            const downloadUrl = `http://localhost:8000/api/jobs/${job.id}/download`;
            return (
              <div key={job.id} className="card download-card fade-in">
                <div className="download-icon">
                  <FileVideo size={40} className="text-cyan" />
                </div>
                <div className="download-info">
                  <span className="download-title mono">{job.title}</span>
                  <span className="text-muted">{filename}</span>
                  <span className="text-muted">
                    {job.created_at?.slice(0, 16) || "\u2014"}
                  </span>
                </div>
                <div className="download-actions">
                  <a className="btn btn-primary btn-sm" href={downloadUrl} download>
                    <Download size={14} /> 下载
                  </a>
                  <a className="btn btn-sm" href={downloadUrl} target="_blank" rel="noreferrer">
                    <ExternalLink size={14} /> 预览
                  </a>
                  <button className="btn btn-sm" onClick={() => handleDelete(job.id)} title="删除">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <style>{`
        .download-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
          gap: 12px;
        }
        .download-card {
          display: flex;
          align-items: center;
          gap: 16px;
          padding: 18px 20px;
        }
        .download-icon {
          width: 60px; height: 60px;
          background: var(--accent-cyan-dim);
          border: 1px solid rgba(0, 229, 255, 0.15);
          border-radius: var(--radius-md);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .download-info {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 2px;
          min-width: 0;
          font-size: 12px;
        }
        .download-title {
          font-size: 13px;
          font-weight: 600;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .download-actions {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
      `}</style>
    </div>
  );
}
