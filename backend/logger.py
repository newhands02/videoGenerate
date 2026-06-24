"""Centralized logging: writes to console and stores in SQLite logs table."""
import logging
import sys
from datetime import datetime
from database import get_db

SUCCESS = 25  # Custom level between INFO and WARNING
logging.addLevelName(SUCCESS, "SUCCESS")


# Console formatter with timestamp and level
class ConsoleFormatter(logging.Formatter):
    """Compact colored-like format for terminal readability."""
    grey = "\x1b[38;20m"
    cyan = "\x1b[36;20m"
    yellow = "\x1b[33;20m"
    red = "\x1b[31;20m"
    green = "\x1b[32;20m"
    reset = "\x1b[0m"
    fmt = "%(asctime)s | %(levelname)-7s | %(message)s"

    FORMATS = {
        logging.DEBUG: grey + fmt + reset,
        logging.INFO: cyan + fmt + reset,
        logging.WARNING: yellow + fmt + reset,
        logging.ERROR: red + fmt + reset,
        SUCCESS: green + fmt + reset,
    }

    def format(self, record):
        log_fmt = self.FORMATS.get(record.levelno, self.fmt)
        formatter = logging.Formatter(log_fmt, datefmt="%H:%M:%S")
        return formatter.format(record)


class JobLogger:
    """Per-job logger that writes to both console and SQLite."""

    def __init__(self, job_id: str):
        self.job_id = job_id
        self._logger = self._setup_console_logger()

    def _setup_console_logger(self):
        logger = logging.getLogger(f"job.{self.job_id}")
        logger.setLevel(logging.DEBUG)
        logger.propagate = False
        # Avoid duplicate handlers
        if not logger.handlers:
            handler = logging.StreamHandler(sys.stdout)
            handler.setFormatter(ConsoleFormatter())
            logger.addHandler(handler)
        return logger

    def _store(self, level: str, message: str):
        """Persist log entry to SQLite."""
        try:
            conn = get_db()
            conn.execute(
                "INSERT INTO logs (job_id, level, message) VALUES (?, ?, ?)",
                (self.job_id, level, message),
            )
            conn.commit()
            conn.close()
        except Exception:
            pass  # Don"t let DB errors break the pipeline

    def info(self, msg: str):
        self._logger.info(f"[{self.job_id}] {msg}")
        self._store("INFO", msg)

    def success(self, msg: str):
        self._logger.log(SUCCESS, f"[{self.job_id}] {msg}")
        self._store("SUCCESS", msg)

    def warning(self, msg: str):
        self._logger.warning(f"[{self.job_id}] {msg}")
        self._store("WARNING", msg)

    def error(self, msg: str):
        self._logger.error(f"[{self.job_id}] {msg}")
        self._store("ERROR", msg)

    def step(self, step_num: int, step_name: str):
        """Log a pipeline step start."""
        self._logger.info(f"[{self.job_id}] >>> STEP {step_num}/5: {step_name}")
        self._store("INFO", f"STEP {step_num}: {step_name} started")


def get_job_logs(job_id: str) -> list[dict]:
    """Retrieve all logs for a given job."""
    conn = get_db()
    rows = conn.execute(
        "SELECT * FROM logs WHERE job_id = ? ORDER BY created_at ASC",
        (job_id,),
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]
