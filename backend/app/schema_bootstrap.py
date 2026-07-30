"""Apply lightweight schema patches for existing databases.

SQLAlchemy create_all() does not ALTER existing tables, so new columns must be
added here on startup — and columns the model no longer writes have to be
removed here too, for the same reason.
"""

from sqlalchemy import text

from app.database import engine

PATCHES: list[str] = [
    "ALTER TABLE chat_sessions ADD COLUMN IF NOT EXISTS transcript_id VARCHAR(64)",
    "CREATE INDEX IF NOT EXISTS idx_chat_sessions_transcript_id ON chat_sessions(transcript_id)",
    "ALTER TABLE chat_sessions ADD COLUMN IF NOT EXISTS video_id VARCHAR(64)",
    "CREATE INDEX IF NOT EXISTS idx_chat_sessions_video_id ON chat_sessions(video_id)",
    # `usage_minutes` became a computed column_property (see app/models.py), so
    # INSERTs no longer supply it. On a database created before that change the
    # physical column survives as NOT NULL with no default, and every signup
    # dies with a NotNullViolation — the model shadows the column, so reads and
    # updates still work and only account creation breaks. Dropping it is
    # lossless: nothing ever incremented the stored counter, which is exactly
    # why it was replaced.
    "ALTER TABLE users DROP COLUMN IF EXISTS usage_minutes",
]


def apply_schema_patches() -> None:
    with engine.begin() as conn:
        for stmt in PATCHES:
            conn.execute(text(stmt))
