"""SQLite database for task metadata and job tracking."""
import sqlite3
import json
from datetime import datetime

DB_PATH = "video_gen.db"


def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    conn = get_db()
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS jobs (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            status TEXT DEFAULT 'pending',
            raw_text TEXT,
            segments TEXT,
            progress INTEGER DEFAULT 0,
            output_path TEXT,
            error TEXT,
            retry_count INTEGER DEFAULT 0,
            created_at TEXT DEFAULT (datetime('now','localtime')),
            updated_at TEXT DEFAULT (datetime('now','localtime'))
        );

        CREATE TABLE IF NOT EXISTS segments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            job_id TEXT NOT NULL,
            index_num INTEGER NOT NULL,
            text TEXT NOT NULL,
            image_description TEXT,
            image_path TEXT,
            audio_path TEXT,
            audio_duration REAL,
            status TEXT DEFAULT 'pending',
            FOREIGN KEY (job_id) REFERENCES jobs(id)
        );

        CREATE TABLE IF NOT EXISTS logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            job_id TEXT NOT NULL,
            level TEXT DEFAULT 'INFO',
            message TEXT,
            created_at TEXT DEFAULT (datetime('now','localtime')),
            FOREIGN KEY (job_id) REFERENCES jobs(id)
        );
    """)
    conn.commit()
    conn.close()


def create_job(job_id: str, title: str, raw_text: str) -> dict:
    conn = get_db()
    conn.execute(
        "INSERT INTO jobs (id, title, raw_text, status) VALUES (?, ?, ?, 'pending')",
        (job_id, title, raw_text),
    )
    conn.commit()
    conn.close()
    return {"id": job_id, "title": title, "status": "pending"}


def update_job_status(job_id: str, status: str, progress: int = None, error: str = None, output_path: str = None):
    conn = get_db()
    fields = ["status = ?", "updated_at = datetime('now','localtime')"]
    params = [status]
    if progress is not None:
        fields.append("progress = ?")
        params.append(progress)
    if error is not None:
        fields.append("error = ?")
        params.append(error)
    if output_path is not None:
        fields.append("output_path = ?")
        params.append(output_path)
    params.append(job_id)
    conn.execute(f"UPDATE jobs SET {', '.join(fields)} WHERE id = ?", params)
    conn.commit()
    conn.close()


def get_job(job_id: str) -> dict | None:
    conn = get_db()
    row = conn.execute("SELECT * FROM jobs WHERE id = ?", (job_id,)).fetchone()
    conn.close()
    if row:
        return dict(row)
    return None


def list_jobs() -> list[dict]:
    conn = get_db()
    rows = conn.execute("SELECT * FROM jobs ORDER BY created_at DESC").fetchall()
    conn.close()
    return [dict(r) for r in rows]


def save_segments(job_id: str, segments: list[dict]):
    conn = get_db()
    conn.execute("DELETE FROM segments WHERE job_id = ?", (job_id,))
    for seg in segments:
        conn.execute(
            "INSERT INTO segments (job_id, index_num, text, image_description, status) VALUES (?, ?, ?, ?, 'pending')",
            (job_id, seg["index"], seg["text"], seg.get("image_description", "")),
        )
    conn.commit()
    # Store JSON segments in jobs table too for convenience
    conn.execute("UPDATE jobs SET segments = ? WHERE id = ?", (json.dumps(segments, ensure_ascii=False), job_id))
    conn.commit()
    conn.close()


def update_segment_status(job_id: str, index: int, status: str, image_path: str = None, audio_path: str = None, audio_duration: float = None):
    conn = get_db()
    fields = ["status = ?"]
    params = [status]
    if image_path:
        fields.append("image_path = ?")
        params.append(image_path)
    if audio_path:
        fields.append("audio_path = ?")
        params.append(audio_path)
    if audio_duration is not None:
        fields.append("audio_duration = ?")
        params.append(audio_duration)
    params.extend([job_id, index])
    conn.execute(f"UPDATE segments SET {', '.join(fields)} WHERE job_id = ? AND index_num = ?", params)
    conn.commit()
    conn.close()


def get_segments(job_id: str) -> list[dict]:
    conn = get_db()
    rows = conn.execute("SELECT * FROM segments WHERE job_id = ? ORDER BY index_num", (job_id,)).fetchall()
    conn.close()
    return [dict(r) for r in rows]
