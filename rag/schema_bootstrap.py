"""Schema patches for existing RAG PostgreSQL tables."""

from sqlalchemy import text

from rag.database import engine

PATCHES: list[str] = [
    "ALTER TABLE transcript_chunks ADD COLUMN IF NOT EXISTS start_seconds DOUBLE PRECISION",
    "ALTER TABLE transcript_chunks ADD COLUMN IF NOT EXISTS end_seconds DOUBLE PRECISION",
    "ALTER TABLE transcripts ADD COLUMN IF NOT EXISTS user_id VARCHAR(64)",
    "ALTER TABLE transcripts ADD COLUMN IF NOT EXISTS source_url VARCHAR(1024)",
    "ALTER TABLE transcripts ADD COLUMN IF NOT EXISTS content_hash VARCHAR(64)",
    "CREATE INDEX IF NOT EXISTS ix_transcripts_user_id ON transcripts (user_id)",
    "CREATE INDEX IF NOT EXISTS ix_transcripts_content_hash ON transcripts (content_hash)",
    "CREATE TABLE IF NOT EXISTS ingest_jobs (\n        job_id VARCHAR(64) PRIMARY KEY,\n        status VARCHAR(20) NOT NULL DEFAULT 'pending',\n        percent INTEGER NOT NULL DEFAULT 0,\n        stage VARCHAR(50) NOT NULL DEFAULT 'pending',\n        message TEXT NOT NULL DEFAULT 'Waiting to start…',\n        error TEXT NULL,\n        result TEXT NULL,\n        user_id VARCHAR(64) NULL,\n        video_id VARCHAR(64) NULL,\n        source_url VARCHAR(1024) NULL,\n        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,\n        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP\n    )",
    "ALTER TABLE ingest_jobs ADD COLUMN IF NOT EXISTS elapsed_seconds DOUBLE PRECISION",
    "ALTER TABLE ingest_jobs ADD COLUMN IF NOT EXISTS audio_extract_seconds DOUBLE PRECISION",
    "ALTER TABLE ingest_jobs ADD COLUMN IF NOT EXISTS transcribe_seconds DOUBLE PRECISION",
    "ALTER TABLE ingest_jobs ADD COLUMN IF NOT EXISTS embedding_seconds DOUBLE PRECISION",
]


def apply_schema_patches() -> None:
    with engine.begin() as conn:
        for stmt in PATCHES:
            conn.execute(text(stmt))
