"""Apply lightweight schema patches for existing databases.

SQLAlchemy create_all() does not ALTER existing tables, so new columns must be
added here on startup.
"""

from sqlalchemy import text

from app.database import engine

PATCHES: list[str] = [
    "ALTER TABLE chat_sessions ADD COLUMN IF NOT EXISTS transcript_id VARCHAR(64)",
    "CREATE INDEX IF NOT EXISTS idx_chat_sessions_transcript_id ON chat_sessions(transcript_id)",
    "ALTER TABLE chat_sessions ADD COLUMN IF NOT EXISTS video_id VARCHAR(64)",
    "CREATE INDEX IF NOT EXISTS idx_chat_sessions_video_id ON chat_sessions(video_id)",
]


def apply_schema_patches() -> None:
    with engine.begin() as conn:
        for stmt in PATCHES:
            conn.execute(text(stmt))
