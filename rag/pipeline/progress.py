"""In-memory ingest job progress tracking for the RAG HTTP service."""

from __future__ import annotations

import threading
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Callable

ProgressCallback = Callable[[int, str, str], None]


@dataclass
class JobProgress:
    job_id: str
    status: str = "pending"  # pending | running | completed | failed
    percent: int = 0
    stage: str = "pending"
    message: str = "Waiting to start…"
    error: str | None = None
    result: dict[str, Any] | None = None
    updated_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))


class ProgressStore:
    def __init__(self) -> None:
        self._jobs: dict[str, JobProgress] = {}
        self._lock = threading.Lock()

    def create(self) -> str:
        job_id = str(uuid.uuid4())
        with self._lock:
            self._jobs[job_id] = JobProgress(job_id=job_id)
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

    def get(self, job_id: str) -> JobProgress | None:
        with self._lock:
            job = self._jobs.get(job_id)
            return job

    def callback(self, job_id: str) -> ProgressCallback:
        def report(percent: int, stage: str, message: str) -> None:
            self.update(job_id, percent, stage, message)

        return report


progress_store = ProgressStore()
