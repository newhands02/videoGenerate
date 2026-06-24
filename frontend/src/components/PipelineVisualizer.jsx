import { Film, Image, Mic, Clapperboard, Check } from 'lucide-react';

const STAGES = [
  { key: 'parsing', label: '解析文稿', icon: Film, desc: 'LLM 智能分段' },
  { key: 'generating_images', label: '生成图片', icon: Image, desc: 'AI 画面生成' },
  { key: 'synthesizing_audio', label: '语音合成', icon: Mic, desc: 'Edge TTS 配音' },
  { key: 'composing', label: '视频合成', icon: Clapperboard, desc: '字幕/BGM/转场' },
  { key: 'completed', label: '完成输出', icon: Check, desc: '成品就绪' },
];

const STATUS_MAP = {
  pending: -1,
  parsing: 0,
  generating_images: 1,
  synthesizing_audio: 2,
  composing: 3,
  completed: 4,
  failed: -1,
};

export default function PipelineVisualizer({ status = 'pending', progress = 0 }) {
  const currentIdx = STATUS_MAP[status] ?? -1;
  const isFailed = status === 'failed';

  return (
    <div className="pipeline">
      <div className="pipeline-track">
        {/* Progress bar background */}
        <div className="pipeline-progress-bg" />
        {/* Active progress fill */}
        <div
          className="pipeline-progress-fill"
          style={{ width: isFailed ? '0%' : `${Math.min(progress, 100)}%` }}
        />
        {/* Stage nodes */}
        {STAGES.map((stage, i) => {
          const isActive = i === currentIdx && !isFailed;
          const isDone = i < currentIdx;
          const isCurrent = i <= currentIdx && !isFailed;
          const Icon = stage.icon;

          return (
            <div
              key={stage.key}
              className={`pipeline-node ${isActive ? 'active' : ''} ${isDone ? 'done' : ''} ${isCurrent ? 'current' : ''}`}
              style={{ left: `${(i / (STAGES.length - 1)) * 100}%` }}
            >
              <div className={`pipeline-node-dot ${isActive ? 'pulse-cyan' : ''}`}>
                <Icon size={14} />
              </div>
              <div className="pipeline-node-label">
                <span className="stage-name">{stage.label}</span>
                <span className="stage-desc">{stage.desc}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Status text */}
      <div className="pipeline-status">
        {isFailed ? (
          <span className="text-error">任务失败 — 请查看错误日志后重试</span>
        ) : (
          <span>
            进度 <span className="mono text-cyan">{progress}%</span>
            {status !== 'completed' && status !== 'pending' && (
              <span className="text-muted"> — {STAGES[currentIdx]?.desc || '等待中...'}</span>
            )}
          </span>
        )}
      </div>

      <style>{`
        .pipeline {
          width: 100%;
          padding: 12px 0;
        }
        .pipeline-track {
          position: relative;
          height: 80px;
          margin: 0 10px;
        }
        .pipeline-progress-bg {
          position: absolute;
          top: 20px;
          left: 0; right: 0;
          height: 2px;
          background: var(--border);
          border-radius: 1px;
        }
        .pipeline-progress-fill {
          position: absolute;
          top: 20px;
          left: 0;
          height: 2px;
          background: var(--accent-cyan);
          border-radius: 1px;
          transition: width 0.6s cubic-bezier(0.4, 0, 0.2, 1);
          z-index: 1;
        }
        .pipeline-node {
          position: absolute;
          top: 0;
          transform: translateX(-50%);
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
          z-index: 2;
        }
        .pipeline-node-dot {
          width: 36px; height: 36px;
          border-radius: 50%;
          background: var(--bg-card);
          border: 2px solid var(--border);
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--text-muted);
          transition: all 0.3s ease;
          position: relative;
          z-index: 3;
        }
        .pipeline-node.current .pipeline-node-dot {
          border-color: var(--border-active);
          color: var(--text-secondary);
        }
        .pipeline-node.active .pipeline-node-dot {
          background: var(--accent-cyan-dim);
          border-color: var(--accent-cyan);
          color: var(--accent-cyan);
        }
        .pipeline-node.done .pipeline-node-dot {
          background: rgba(0, 230, 118, 0.1);
          border-color: var(--success);
          color: var(--success);
        }
        .pipeline-node-label {
          text-align: center;
          white-space: nowrap;
        }
        .stage-name {
          display: block;
          font-size: 12px;
          font-weight: 600;
          font-family: var(--font-mono);
          color: var(--text-muted);
        }
        .pipeline-node.current .stage-name { color: var(--text-secondary); }
        .pipeline-node.active .stage-name { color: var(--accent-cyan); }
        .pipeline-node.done .stage-name { color: var(--success); }
        .stage-desc {
          display: block;
          font-size: 10px;
          color: var(--text-muted);
          margin-top: 2px;
        }
        .pipeline-status {
          text-align: center;
          font-size: 12px;
          color: var(--text-secondary);
          margin-top: 8px;
          font-family: var(--font-mono);
        }
        .text-error { color: var(--error); }
      `}</style>
    </div>
  );
}
