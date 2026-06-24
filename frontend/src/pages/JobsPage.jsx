import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { RefreshCw, Plus } from "lucide-react";
import { useApi } from "../hooks/useApi";
import JobCard from "../components/JobCard";

export default function JobsPage() {
  const [jobs, setJobs] = useState([]);
  const { listJobs, deleteJob, retryJob, loading } = useApi();
  const navigate = useNavigate();

  const fetchJobs = useCallback(async () => {
    try {
      const data = await listJobs();
      setJobs(data || []);
    } catch {
      // silent
    }
  }, [listJobs]);

  useEffect(() => {
    fetchJobs();
    const interval = setInterval(fetchJobs, 3000);
    return () => clearInterval(interval);
  }, [fetchJobs]);

  const handleDelete = async (id) => {
    await deleteJob(id);
    setJobs((prev) => prev.filter((j) => j.id !== id));
  };

  const handleRetry = async (id) => {
    await retryJob(id);
    fetchJobs();
  };

  const processing = jobs.filter((j) => !["completed", "failed"].includes(j.status));

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">任务队列</h1>
          <span className="text-muted">
            {jobs.length} 个任务
            {processing.length > 0 && ` \u00B7 ${processing.length} 个进行中`}
          </span>
        </div>
        <div className="page-header-actions">
          <button className="btn btn-sm" onClick={fetchJobs} disabled={loading}>
            <RefreshCw size={14} className={loading ? "spin-icon" : ""} />
            刷新
          </button>
          <button className="btn btn-primary btn-sm" onClick={() => navigate("/")}>
            <Plus size={14} />
            新建
          </button>
        </div>
      </div>

      {jobs.length === 0 ? (
        <div className="empty-state">
          <span className="text-muted">暂无任务，去创建第一个视频吧</span>
          <button className="btn btn-primary" onClick={() => navigate("/")}>
            <Plus size={14} /> 新建任务
          </button>
        </div>
      ) : (
        <div className="job-list">
          {jobs.map((job) => (
            <JobCard
              key={job.id}
              job={job}
              onDelete={handleDelete}
              onRetry={handleRetry}
              onView={(id) => navigate(`/preview?job=${id}`)}
              onDownload={(id) => window.open(`http://localhost:8000/api/jobs/${id}/download`)}
            />
          ))}
        </div>
      )}

      <style>{`
        .page-header-actions {
          display: flex;
          gap: 8px;
        }
        .empty-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 16px;
          padding: 80px 20px;
        }
        .job-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        @keyframes spin-icon { to { transform: rotate(360deg); } }
        .spin-icon { animation: spin-icon 1.2s linear infinite; }
      `}</style>
    </div>
  );
}
