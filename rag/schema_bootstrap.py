"""Schema patches for existing RAG PostgreSQL tables."""

from sqlalchemy import text

from rag.database import engine

PATCHES: list[str] = [
    "ALTER TABLE transcript_chunks ADD COLUMN IF NOT EXISTS start_seconds DOUBLE PRECISION",
    "ALTER TABLE transcript_chunks ADD COLUMN IF NOT EXISTS end_seconds DOUBLE PRECISION",
]


def apply_schema_patches() -> None:
    with engine.begin() as conn:
        for stmt in PATCHES:
            conn.execute(text(stmt))
