"""Ingest job progress tracking for the RAG HTTP service.

Jobs live in memory for fast polling. Terminal jobs (completed/failed) are also
persisted to a small JSON file so their results survive a process restart, and
stale jobs are pruned so the store can't grow without bound.

Note: this is a single-process store. Behind multiple worker processes each
worker keeps its own copy — run the RAG service with a single worker, or move
this to a shared store (Redis/DB) if you scale out.
"""

from __future__ import annotations

import json
import threading
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Callable

from rag.config import settings
from rag.database import SessionLocal
from rag.models import IngestJob

ProgressCallback = Callable[[int, str, str], None]

_TERMINAL = {"completed", "failed"}
_PERSIST_PATH = Path(settings.chroma_path).parent / "ingest_jobs.json"
_MAX_AGE = timedelta(hours=24)


@dataclass
class JobProgress:
    job_id: str
    status: str = "pending"  # pending | running | completed | failed
    percent: int = 0
    stage: str = "pending"
    message: str = "Waiting to start…"
    error: str | None = None
    result: dict[str, Any] | None = None
    elapsed_seconds: float | None = None
    updated_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))

    def to_dict(self) -> dict[str, Any]:
        return {
            "job_id": self.job_id,
            "status": self.status,
            "percent": self.percent,
            "stage": self.stage,
            "message": self.message,
            "error": self.error,
            "result": self.result,
            "elapsed_seconds": self.elapsed_seconds,
            "updated_at": self.updated_at.isoformat(),
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "JobProgress":
        raw = data.get("updated_at")
        try:
            updated = datetime.fromisoformat(raw) if raw else datetime.now(timezone.utc)
        except ValueError:
            updated = datetime.now(timezone.utc)
        return cls(
            job_id=data["job_id"],
            status=data.get("status", "completed"),
            percent=data.get("percent", 100),
            stage=data.get("stage", "complete"),
            message=data.get("message", ""),
            error=data.get("error"),
            result=data.get("result"),
            elapsed_seconds=data.get("elapsed_seconds"),
            updated_at=updated,
        )


class ProgressStore:
    def __init__(self) -> None:
        self._jobs: dict[str, JobProgress] = {}
        self._lock = threading.Lock()
        self._load()

    # ---- persistence (best-effort; never raises into the request path) ----
    def _load(self) -> None:
        try:
            if not _PERSIST_PATH.exists():
                return
            data = json.loads(_PERSIST_PATH.read_text(encoding="utf-8"))
            cutoff = datetime.now(timezone.utc) - _MAX_AGE
            for item in data:
                job = JobProgress.from_dict(item)
                if job.updated_at >= cutoff:
                    self._jobs[job.job_id] = job
        except Exception:
            pass

    def _persist_locked(self) -> None:
        try:
            cutoff = datetime.now(timezone.utc) - _MAX_AGE
            terminal = [
                j.to_dict()
                for j in self._jobs.values()
                if j.status in _TERMINAL and j.updated_at >= cutoff
            ]
            _PERSIST_PATH.parent.mkdir(parents=True, exist_ok=True)
            _PERSIST_PATH.write_text(json.dumps(terminal), encoding="utf-8")
        except Exception:
            pass

    def _db_save_job(self, job: JobProgress) -> None:
        try:
            db = SessionLocal()
            try:
                existing = db.get(IngestJob, job.job_id)
                result_value = json.dumps(job.result) if job.result is not None else None
                if existing is None:
                    existing = IngestJob(
                        job_id=job.job_id,
                        status=job.status,
                        percent=job.percent,
                        stage=job.stage,
                        message=job.message,
                        error=job.error,
                        result=result_value,
                        elapsed_seconds=job.elapsed_seconds if job.elapsed_seconds is not None else 0.0,
                        audio_extract_seconds=(json.loads(result_value).get("audio_extract_seconds") if result_value else None),
                        transcribe_seconds=(json.loads(result_value).get("transcribe_seconds") if result_value else None),
                        embedding_seconds=(json.loads(result_value).get("embedding_seconds") if result_value else None),
                    )
                    db.add(existing)
                else:
                    existing.status = job.status
                    existing.percent = job.percent
                    existing.stage = job.stage
                    existing.message = job.message
                    existing.error = job.error
                    existing.result = result_value
                    # Persist per-stage timings when available in the result payload
                    try:
                        if result_value:
                            payload = json.loads(result_value)
                            existing.audio_extract_seconds = payload.get("audio_extract_seconds", existing.audio_extract_seconds)
                            existing.transcribe_seconds = payload.get("transcribe_seconds", existing.transcribe_seconds)
                            existing.embedding_seconds = payload.get("embedding_seconds", existing.embedding_seconds)
                    except Exception:
                        pass
                    try:
                        # Compute elapsed time since the DB-created timestamp when available
                        if existing.created_at:
                            now = datetime.now(timezone.utc)
                            elapsed = (now - existing.created_at).total_seconds()
                            existing.elapsed_seconds = float(elapsed)
                        else:
                            existing.elapsed_seconds = job.elapsed_seconds
                    except Exception:
                        # best-effort; don't let timing errors block progress persistence
                        existing.elapsed_seconds = job.elapsed_seconds
                db.commit()
            except Exception:
                db.rollback()
            finally:
                db.close()
        except Exception:
            pass

    def _row_to_job(self, row: IngestJob) -> JobProgress:
        result = None
        if row.result:
            try:
                result = json.loads(row.result)
            except Exception:
                result = None
        return JobProgress(
            job_id=row.job_id,
            status=row.status,
            percent=row.percent,
            stage=row.stage,
            message=row.message,
            error=row.error,
            result=result,
            elapsed_seconds=float(row.elapsed_seconds) if row.elapsed_seconds is not None else None,
            updated_at=row.updated_at or datetime.now(timezone.utc),
        )

    def _prune_locked(self) -> None:
        cutoff = datetime.now(timezone.utc) - _MAX_AGE
        stale = [jid for jid, j in self._jobs.items() if j.updated_at < cutoff]
        for jid in stale:
            self._jobs.pop(jid, None)

    def create(self) -> str:
        job_id = str(uuid.uuid4())
        with self._lock:
            self._prune_locked()
            job = JobProgress(job_id=job_id)
            self._jobs[job_id] = job
        self._db_save_job(job)
        return job_id

    def update(self, job_id: str, percent: int, stage: str, message: str) -> None:
        with self._lock:
            job = self._jobs.get(job_id)
            if not job:
                return
            job.status = "running"
            job.percent = max(0, min(100, percent))
            job.stage = stage
            job.message = message
            job.updated_at = datetime.now(timezone.utc)
        self._db_save_job(job)

    def complete(self, job_id: str, result: dict[str, Any]) -> None:
        with self._lock:
            job = self._jobs.get(job_id)
            if not job:
                return
            job.status = "completed"
            job.percent = 100
            job.stage = "complete"
            job.message = "Video processed and ready."
            job.result = result
            job.updated_at = datetime.now(timezone.utc)
            self._persist_locked()
        self._db_save_job(job)

    def fail(self, job_id: str, error: str) -> None:
        with self._lock:
            job = self._jobs.get(job_id)
            if not job:
                return
            job.status = "failed"
            job.stage = "failed"
            job.message = "Processing failed."
            job.error = error
            job.updated_at = datetime.now(timezone.utc)
            self._persist_locked()
        self._db_save_job(job)

    def get(self, job_id: str) -> JobProgress | None:
        with self._lock:
            job = self._jobs.get(job_id)
            if job:
                return job

        try:
            db = SessionLocal()
            try:
                row = db.get(IngestJob, job_id)
                if row:
                    job = self._row_to_job(row)
                    with self._lock:
                        self._jobs[job_id] = job
                    return job
            finally:
                db.close()
        except Exception:
            pass

        return None

    def callback(self, job_id: str) -> ProgressCallback:
        def report(percent: int, stage: str, message: str) -> None:
            self.update(job_id, percent, stage, message)

        return report


progress_store = ProgressStore()
