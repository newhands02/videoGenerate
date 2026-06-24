import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Upload, FileText, Send, Paperclip } from "lucide-react";
import { useApi } from "../hooks/useApi";

export default function CreatePage() {
  const [text, setText] = useState("");
  const [title, setTitle] = useState("");
  const [file, setFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState("");
  const fileRef = useRef(null);
  const { createJob } = useApi();
  const navigate = useNavigate();

  const handleSubmit = async () => {
    if (!text.trim() && !file) {
      setMsg("请上传文稿或输入文本内容");
      return;
    }
    setSubmitting(true);
    setMsg("");
    try {
      const jobTitle = title.trim() || (file?.name?.replace(/\.[^.]+$/, "") || "Untitled");
      const result = await createJob(text, jobTitle, file);
      setMsg(`任务已创建: ${result.job_id}`);
      setTimeout(() => navigate("/jobs"), 600);
    } catch (e) {
      setMsg(`创建失败: ${e.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleFileDrop = (e) => {
    e.preventDefault();
    const f = e.dataTransfer?.files?.[0];
    if (f) setFile(f);
  };

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">新建视频任务</h1>
        <span className="text-muted">上传文稿或输入文本，AI 将自动生成短视频</span>
      </div>

      <div className="create-grid">
        <div className="card create-text-card">
          <div className="card-header">
            <span className="card-title"><FileText size={16} /> 文稿内容</span>
            <span className="mono text-muted" style={{ fontSize: 11 }}>{text.length} 字</span>
          </div>

          <input
            className="input-field"
            style={{ marginBottom: 12 }}
            placeholder="视频标题（可选）"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />

          <textarea
            className="input-field"
            placeholder={"在此粘贴或输入文稿内容...\n\n支持中文、英文文稿，系统会自动：\n  1. 智能分段并提取关键词\n  2. 为每段生成 AI 配图\n  3. 合成语音旁白\n  4. 嵌入字幕和 BGM\n  5. 输出完整短视频"}
            value={text}
            onChange={(e) => setText(e.target.value)}
            style={{ minHeight: 280 }}
          />

          <div
            className={`drop-zone ${file ? "has-file" : ""}`}
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleFileDrop}
            onClick={() => fileRef.current?.click()}
          >
            <input
              ref={fileRef}
              type="file"
              accept=".txt,.md"
              style={{ display: "none" }}
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />
            {file ? (
              <div className="drop-file-info">
                <Paperclip size={14} />
                <span className="mono">{file.name}</span>
                <span className="text-muted">({(file.size / 1024).toFixed(1)} KB)</span>
                <button className="btn btn-xs" onClick={(e) => { e.stopPropagation(); setFile(null); }}>移除</button>
              </div>
            ) : (
              <div className="drop-placeholder">
                <Upload size={20} className="text-muted" />
                <span className="text-muted">拖拽 .txt 文件到此处，或点击选择</span>
              </div>
            )}
          </div>
        </div>

        <div className="card create-action-card">
          <div className="card-header">
            <span className="card-title">执行操作</span>
          </div>

          <div className="action-info">
            <div className="info-row">
              <span className="text-muted">预估段落数</span>
              <span className="mono">{text ? Math.min(Math.ceil(text.length / 40), 12) : "\u2014"}</span>
            </div>
            <div className="info-row">
              <span className="text-muted">图像生成</span>
              <span className="mono text-cyan">Pollinations.ai</span>
            </div>
            <div className="info-row">
              <span className="text-muted">语音合成</span>
              <span className="mono text-cyan">Edge TTS</span>
            </div>
            <div className="info-row">
              <span className="text-muted">视频输出</span>
              <span className="mono">1080{'\u00D7'}1920 MP4</span>
            </div>
          </div>

          <button
            className="btn btn-primary"
            style={{ width: "100%", justifyContent: "center", marginTop: 20 }}
            disabled={submitting || (!text.trim() && !file)}
            onClick={handleSubmit}
          >
            {submitting ? (
              <><div className="spinner" /> 提交中...</>
            ) : (
              <><Send size={16} /> 开始生成视频</>
            )}
          </button>

          {msg && (
            <div className={`form-msg ${msg.includes("失败") ? "msg-error" : "msg-ok"}`}>
              {msg}
            </div>
          )}
        </div>
      </div>

      <style>{`
        .create-grid {
          display: grid;
          grid-template-columns: 1fr 280px;
          gap: 20px;
          align-items: start;
        }
        @media (max-width: 900px) {
          .create-grid { grid-template-columns: 1fr; }
        }
        .drop-zone {
          border: 2px dashed var(--border);
          border-radius: var(--radius-lg);
          padding: 24px;
          text-align: center;
          cursor: pointer;
          transition: all var(--transition);
          margin-top: 16px;
        }
        .drop-zone:hover, .drop-zone.has-file {
          border-color: var(--accent-cyan);
          background: var(--accent-cyan-dim);
        }
        .drop-placeholder {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
        }
        .drop-file-info {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .action-info {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .info-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 8px 0;
          border-bottom: 1px solid var(--border);
          font-size: 12px;
        }
        .form-msg {
          margin-top: 12px;
          padding: 8px 14px;
          border-radius: var(--radius-md);
          font-size: 12px;
          font-family: var(--font-mono);
        }
        .msg-ok { background: rgba(0, 230, 118, 0.08); color: var(--success); }
        .msg-error { background: rgba(255, 61, 90, 0.08); color: var(--error); }
      `}</style>
    </div>
  );
}
