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
]


def apply_schema_patches() -> None:
    with engine.begin() as conn:
        for stmt in PATCHES:
            conn.execute(text(stmt))
