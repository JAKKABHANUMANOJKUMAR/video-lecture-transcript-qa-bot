"""Steps 2-4 — persist a transcript to PostgreSQL, then chunk + embed into ChromaDB."""

from __future__ import annotations

from dataclasses import dataclass

from sqlalchemy.orm import Session

from rag.database import SessionLocal, init_db
from rag.models import Transcript, TranscriptChunk
from rag.pipeline.chunking import chunk_text
from rag.pipeline.transcription import TranscriptionResult, transcribe_video
from rag.pipeline.vectorstore import add_chunks


@dataclass
class IngestionResult:
    transcript_id: str
    language: str
    is_english: bool
    num_chunks: int
    duration_seconds: float
    original_chars: int
    english_chars: int


def save_transcript(
    db: Session,
    result: TranscriptionResult,
    *,
    source_path: str | None = None,
    title: str | None = None,
    video_id: str | None = None,
    user_id: str | None = None,
) -> Transcript:
    """Step 2 — store original + English text in the `transcripts` table."""
    transcript = Transcript(
        user_id=user_id,
        video_id=video_id,
        source_path=source_path,
        title=title,
        language=result.language,
        is_english=result.is_english,
        original_text=result.original_text,
        english_text=result.english_text,
        duration_seconds=int(result.duration_seconds),
        status="completed",
    )
    db.add(transcript)
    db.commit()
    db.refresh(transcript)
    return transcript


def index_transcript(db: Session, transcript: Transcript) -> int:
    """Steps 3-4 — chunk the English text, persist chunks, and embed into ChromaDB."""
    chunks = chunk_text(transcript.english_text)
    if not chunks:
        return 0

    # Persist chunk rows for traceability.
    db.query(TranscriptChunk).filter(TranscriptChunk.transcript_id == transcript.id).delete()
    for i, content in enumerate(chunks):
        db.add(TranscriptChunk(transcript_id=transcript.id, chunk_index=i, content=content))

    # Store vectors in ChromaDB.
    num = add_chunks(
        transcript_id=transcript.id,
        chunks=chunks,
        video_id=transcript.video_id,
        language="en",
        user_id=transcript.user_id,
    )

    transcript.indexed = True
    db.commit()
    return num


def ingest_video(
    path: str,
    *,
    title: str | None = None,
    video_id: str | None = None,
    user_id: str | None = None,
) -> IngestionResult:
    """End-to-end: video -> Whisper -> DB -> chunks -> embeddings -> ChromaDB."""
    init_db()

    result = transcribe_video(path)

    db = SessionLocal()
    try:
        transcript = save_transcript(
            db, result, source_path=path, title=title, video_id=video_id, user_id=user_id
        )
        num_chunks = index_transcript(db, transcript)
        return IngestionResult(
            transcript_id=transcript.id,
            language=transcript.language,
            is_english=transcript.is_english,
            num_chunks=num_chunks,
            duration_seconds=result.duration_seconds,
            original_chars=len(result.original_text),
            english_chars=len(result.english_text),
        )
    finally:
        db.close()
