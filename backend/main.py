"""FastAPI backend — AI video generation platform."""
import os
import uuid
import threading
import traceback
from pathlib import Path

from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse

from database import init_db, create_job, get_job, list_jobs, update_job_status, save_segments, get_segments, update_segment_status, get_db
from logger import JobLogger, get_job_logs
from services.parser import parse_document
from services.image_gen import generate_image
from services.tts import synthesize
from services.composer import compose_video

app = FastAPI(title="AI Video Generator", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

OUTPUT_DIR = Path(__file__).parent / "outputs"
OUTPUT_DIR.mkdir(exist_ok=True)

MAX_RETRIES = 15  # Safety limit


@app.on_event("startup")
async def startup():
    init_db()


# ─── Pipeline: supports fresh runs and breakpoint resume ───

def _run_pipeline(job_id: str, raw_text: str, resume: bool = False):
    """Execute video generation pipeline.
    When resume=True, checks segment statuses and skips already-completed steps.
    """
    log = JobLogger(job_id)
    log.info("Pipeline started" + (" (resume mode)" if resume else ""))

    try:
        loop = _get_or_create_event_loop()
        existing = get_segments(job_id) if resume else []
        has_segments = len(existing) > 0

        # Determine what"s already done
        images_done = [s for s in existing if s["status"] == "image_done" or s["status"] == "audio_done"]
        audio_done  = [s for s in existing if s["status"] == "audio_done"]
        all_images_ready = has_segments and len(images_done) == len(existing)
        all_audio_ready  = has_segments and len(audio_done) == len(existing)

        # ── Step 1: Parse document ──
        if not has_segments:
            log.step(1, "文稿解析")
            update_job_status(job_id, "parsing", progress=5)
            segments = parse_document(raw_text)
            if not segments:
                raise ValueError("Failed to parse document into segments — text may be too short or LLM unavailable")
            save_segments(job_id, segments)
            total = len(segments)
            log.success(f"文稿解析完成: {total} 个段落")
        else:
            # Reuse existing segments
            log.info(f"断点续传: 跳过文稿解析，已有 {len(existing)} 段")
            segments = [{"index": s["index_num"], "text": s["text"], "keywords": [], "image_description": s.get("image_description", "")} for s in existing]
            total = len(segments)
            update_job_status(job_id, "parsing", progress=5)

        # ── Step 2: Generate images ──
        if not all_images_ready:
            log.step(2, f"AI 图像生成 ({total} 张)")
            update_job_status(job_id, "generating_images", progress=10)
            done_set = {s["index_num"] for s in images_done}

            for i, seg in enumerate(segments):
                if i in done_set:
                    log.info(f"跳过已完成的图片 {i+1}/{total}")
                    continue
                desc = seg.get("image_description", f"cinematic scene about {seg['text'][:50]}")
                log.info(f"生成图片 {i+1}/{total}: {desc[:80]}...")
                img_path = loop.run_until_complete(generate_image(desc, job_id, i))
                update_segment_status(job_id, i, "image_done", image_path=img_path)
                progress = 10 + int((i + 1) / total * 30)
                update_job_status(job_id, "generating_images", progress=progress)
            log.success(f"图像生成完成: {total} 张")
        else:
            log.info("断点续传: 跳过图像生成，所有图片已就绪")

        # Refresh segments from DB
        segments_db = get_segments(job_id)

        # ── Step 3: TTS ──
        audio_done_set = {s["index_num"] for s in get_segments(job_id) if s["status"] == "audio_done"}

        if len(audio_done_set) < total:
            log.step(3, f"语音合成 ({total} 段)")
            update_job_status(job_id, "synthesizing_audio", progress=40)
            for i, seg in enumerate(segments_db):
                if i in audio_done_set:
                    log.info(f"跳过已完成的语音 {i+1}/{total}")
                    continue
                text = seg["text"]
                log.info(f"合成语音 {i+1}/{total}: {text[:40]}...")
                audio_path, duration = loop.run_until_complete(synthesize(text, job_id, i))
                update_segment_status(job_id, i, "audio_done", audio_path=audio_path, audio_duration=duration)
                progress = 40 + int((i + 1) / total * 20)
                update_job_status(job_id, "synthesizing_audio", progress=progress)
            log.success(f"语音合成完成: {total} 段")
        else:
            log.info("断点续传: 跳过语音合成，所有音频已就绪")

        # ── Step 4: Compose video ──
        log.step(4, "视频合成 (FFmpeg)")
        update_job_status(job_id, "composing", progress=60)
        segments_final = get_segments(job_id)
        segments_for_composer = [
            {
                "index": s["index_num"],
                "text": s["text"],
                "image_path": s["image_path"],
                "audio_path": s["audio_path"],
                "audio_duration": s["audio_duration"] or 5.0,
            }
            for s in segments_final
        ]
        log.info(f"开始合成视频，共 {len(segments_for_composer)} 个片段")
        output_path = compose_video(job_id, segments_for_composer)
        update_job_status(job_id, "composing", progress=90)
        log.success(f"视频合成完成: {output_path}")

        # ── Step 5: Done ──
        update_job_status(job_id, "completed", progress=100, output_path=output_path)
        log.success("Pipeline 完成! 视频已就绪")

    except Exception as e:
        traceback.print_exc()
        err_msg = f"{type(e).__name__}: {e}"
        log.error(f"Pipeline 失败: {err_msg}")
        update_job_status(job_id, "failed", error=err_msg)


_event_loop = None


def _get_or_create_event_loop():
    global _event_loop
    if _event_loop is None or _event_loop.is_closed():
        import asyncio
        _event_loop = asyncio.new_event_loop()
        asyncio.set_event_loop(_event_loop)
    return _event_loop


# ─── API Routes ───

@app.get("/api/health")
async def health():
    return {"status": "ok", "service": "AI Video Generator"}


@app.post("/api/jobs")
async def create_video_job(
    title: str = Form("Untitled"),
    file: UploadFile = File(None),
    text: str = Form(""),
):
    """Create a new video generation job."""
    raw_text = text
    if file:
        content = await file.read()
        try:
            raw_text = content.decode("utf-8")
        except UnicodeDecodeError:
            raw_text = content.decode("gbk")
        if not title or title == "Untitled":
            title = os.path.splitext(file.filename)[0] if file.filename else "Uploaded"

    if not raw_text or not raw_text.strip():
        raise HTTPException(status_code=400, detail="No text content provided")

    job_id = uuid.uuid4().hex[:12]
    create_job(job_id, title, raw_text)

    thread = threading.Thread(target=_run_pipeline, args=(job_id, raw_text), daemon=True)
    thread.start()

    return {"job_id": job_id, "title": title, "status": "pending"}


@app.get("/api/jobs")
async def list_all_jobs():
    return list_jobs()


@app.get("/api/jobs/{job_id}")
async def get_job_detail(job_id: str):
    job = get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    segments = get_segments(job_id)
    job["segments"] = segments
    return job


@app.delete("/api/jobs/{job_id}")
async def delete_job(job_id: str):
    """Delete a job and its output files."""
    import shutil
    job = get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    for f in OUTPUT_DIR.glob(f"{job_id}*"):
        try:
            f.unlink()
        except OSError:
            pass
    temp_dir = OUTPUT_DIR / f"{job_id}_temp"
    if temp_dir.exists():
        shutil.rmtree(temp_dir, ignore_errors=True)
    from database import get_db
    conn = get_db()
    conn.execute("DELETE FROM segments WHERE job_id = ?", (job_id,))
    conn.execute("DELETE FROM logs WHERE job_id = ?", (job_id,))
    conn.execute("DELETE FROM jobs WHERE id = ?", (job_id,))
    conn.commit()
    conn.close()
    return {"deleted": job_id}


@app.get("/api/jobs/{job_id}/download")
async def download_video(job_id: str):
    job = get_job(job_id)
    if not job or not job["output_path"]:
        raise HTTPException(status_code=404, detail="Output video not found")
    path = Path(job["output_path"])
    if not path.exists():
        raise HTTPException(status_code=404, detail="Output file missing")
    return FileResponse(path, media_type="video/mp4", filename=f"{job['title']}.mp4")


@app.get("/outputs/{filename}")
async def serve_output(filename: str):
    path = OUTPUT_DIR / filename
    if not path.exists():
        raise HTTPException(status_code=404)
    return FileResponse(path)


@app.post("/api/jobs/{job_id}/retry")
async def retry_job(job_id: str):
    """Smart retry: resume from breakpoint instead of restarting."""
    job = get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    if job["status"] not in ("failed", "completed"):
        raise HTTPException(status_code=400, detail=f"Cannot retry job in status: {job['status']}")

    raw_text = job.get("raw_text", "")
    if not raw_text:
        raise HTTPException(status_code=400, detail="No original text to retry with")

    retry_count = (job.get("retry_count") or 0) + 1
    if retry_count > MAX_RETRIES:
        raise HTTPException(status_code=400, detail=f"Max retries ({MAX_RETRIES}) exceeded")

    segments = get_segments(job_id)
    has_segments = len(segments) > 0

    # Determine if we can resume (segments exist) or must restart
    can_resume = has_segments and job["status"] == "failed"

    conn = get_db()
    if can_resume:
        # Keep segments, just clear error and reset progress
        conn.execute(
            "UPDATE jobs SET status='pending', progress=0, error=NULL, output_path=NULL, retry_count=? WHERE id=?",
            (retry_count, job_id),
        )
    else:
        # Full restart
        conn.execute(
            "UPDATE jobs SET status='pending', progress=0, error=NULL, output_path=NULL, retry_count=? WHERE id=?",
            (retry_count, job_id),
        )
        conn.execute("DELETE FROM segments WHERE job_id = ?", (job_id,))
        # Clean old files
        for f in OUTPUT_DIR.glob(f"{job_id}*"):
            try:
                f.unlink()
            except OSError:
                pass
    conn.commit()
    conn.close()

    thread = threading.Thread(target=_run_pipeline, args=(job_id, raw_text, can_resume), daemon=True)
    thread.start()

    return {
        "job_id": job_id,
        "status": "pending",
        "retry_count": retry_count,
        "mode": "resume" if can_resume else "restart",
    }


@app.get("/api/jobs/{job_id}/logs")
async def get_job_log_list(job_id: str):
    job = get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return get_job_logs(job_id)


@app.get("/api/logs")
async def get_all_logs():
    """Get all logs across all jobs (for global log viewer)."""
    conn = get_db()
    rows = conn.execute(
        "SELECT l.*, j.title as job_title FROM logs l LEFT JOIN jobs j ON l.job_id = j.id ORDER BY l.created_at DESC LIMIT 500"
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)

