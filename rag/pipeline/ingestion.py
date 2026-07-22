"""Steps 2-4 — persist a transcript to PostgreSQL, then chunk + embed into ChromaDB."""

from __future__ import annotations

import hashlib
from dataclasses import dataclass
from typing import TYPE_CHECKING

from sqlalchemy.orm import Session

from rag.database import SessionLocal, init_db
from rag.models import Transcript, TranscriptChunk
from rag.pipeline.chunking import TimedChunk, chunk_segments, chunk_text
from rag.pipeline.transcription import TranscriptionResult, transcribe_video
from rag.pipeline.vectorstore import add_timed_chunks

if TYPE_CHECKING:
    from rag.pipeline.progress import ProgressCallback


@dataclass
class IngestionResult:
    transcript_id: str
    language: str
    is_english: bool
    num_chunks: int
    duration_seconds: float
    original_chars: int
    english_chars: int
    media_key: str | None = None
    reused: bool = False


def _sha256_file(path: str, chunk_bytes: int = 1024 * 1024) -> str:
    """Stream the file through sha256 so we can detect re-uploads cheaply."""
    digest = hashlib.sha256()
    with open(path, "rb") as fh:
        for block in iter(lambda: fh.read(chunk_bytes), b""):
            digest.update(block)
    return digest.hexdigest()


def find_reusable_transcript(
    db: Session,
    *,
    user_id: str | None,
    content_hash: str | None = None,
    source_url: str | None = None,
) -> Transcript | None:
    """Return an existing, already-indexed transcript for the same content.

    Matches within the caller's own transcripts (or globally-owned ones when the
    caller is anonymous). Used to skip re-transcribing a video that was already
    processed. Prefers content-hash matches, falling back to source URL.
    """
    if not content_hash and not source_url:
        return None

    owner = (
        Transcript.user_id == user_id
        if user_id is not None
        else Transcript.user_id.is_(None)
    )
    base = db.query(Transcript).filter(owner, Transcript.indexed.is_(True))

    if content_hash:
        hit = base.filter(Transcript.content_hash == content_hash).first()
        if hit:
            return hit
    if source_url:
        return base.filter(Transcript.source_url == source_url).first()
    return None


def _result_from_existing(transcript: Transcript, db: Session) -> IngestionResult:
    num_chunks = (
        db.query(TranscriptChunk)
        .filter(TranscriptChunk.transcript_id == transcript.id)
        .count()
    )
    return IngestionResult(
        transcript_id=transcript.id,
        language=transcript.language,
        is_english=transcript.is_english,
        num_chunks=num_chunks,
        duration_seconds=float(transcript.duration_seconds or 0),
        original_chars=len(transcript.original_text or ""),
        english_chars=len(transcript.english_text or ""),
        media_key=transcript.video_id or transcript.id,
        reused=True,
    )


def save_transcript(
    db: Session,
    result: TranscriptionResult,
    *,
    source_path: str | None = None,
    title: str | None = None,
    video_id: str | None = None,
    user_id: str | None = None,
    source_url: str | None = None,
    content_hash: str | None = None,
) -> Transcript:
    """Step 2 — store original + English text in the `transcripts` table."""
    transcript = Transcript(
        user_id=user_id,
        video_id=video_id,
        source_path=source_path,
        source_url=source_url,
        content_hash=content_hash,
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


def _segments_for_variant(result: TranscriptionResult, variant: str) -> list[dict]:
    if variant == "english":
        return result.english_segments
    if variant == "primary" or variant == "original":
        return result.segments
    return result.segments


def _timed_chunks_from_segments(segments: list[dict], fallback_text: str) -> list[TimedChunk]:
    if segments:
        return chunk_segments(segments)
    plain = chunk_text(fallback_text)
    return [TimedChunk(text=t, start_seconds=0.0, end_seconds=0.0) for t in plain]


def index_transcript(
    db: Session,
    transcript: Transcript,
    result: TranscriptionResult,
    *,
    on_progress: "ProgressCallback | None" = None,
) -> int:
    """Steps 3-4 — chunk with Whisper timestamps, persist, and embed into ChromaDB."""
    def report(percent: int, stage: str, message: str) -> None:
        if on_progress:
            on_progress(percent, stage, message)

    variant_specs: list[tuple[str, str, str]] = []
    if transcript.is_english:
        text = (transcript.english_text or transcript.original_text or "").strip()
        if text:
            variant_specs.append((text, "en", "primary"))
    else:
        original = (transcript.original_text or "").strip()
        english = (transcript.english_text or "").strip()
        if original:
            variant_specs.append((original, transcript.language, "original"))
        if english and english != original:
            variant_specs.append((english, "en", "english"))

    if not variant_specs:
        return 0

    db.query(TranscriptChunk).filter(TranscriptChunk.transcript_id == transcript.id).delete()

    report(82, "chunking", "Splitting transcript into timestamped sections…")

    total = 0
    chunk_index = 0
    num_variants = len(variant_specs)
    for src_idx, (text, language, variant) in enumerate(variant_specs):
        segments = _segments_for_variant(result, variant)
        timed = _timed_chunks_from_segments(segments, text)
        if not timed:
            continue

        start_index = chunk_index
        for tc in timed:
            db.add(
                TranscriptChunk(
                    transcript_id=transcript.id,
                    chunk_index=chunk_index,
                    content=tc.text,
                    start_seconds=tc.start_seconds,
                    end_seconds=tc.end_seconds,
                )
            )
            chunk_index += 1

        embed_pct = 85 + int((src_idx + 1) / max(num_variants, 1) * 12)
        report(embed_pct, "embedding", "Creating vector embeddings…")

        total += add_timed_chunks(
            transcript_id=transcript.id,
            chunks=timed,
            video_id=transcript.video_id,
            language=language,
            variant=variant,
            lecture_title=transcript.title,
            user_id=transcript.user_id,
            start_index=start_index,
        )

    transcript.indexed = total > 0
    db.commit()
    report(98, "embedding", "Search index ready.")
    return total


def ingest_video(
    path: str,
    *,
    title: str | None = None,
    video_id: str | None = None,
    user_id: str | None = None,
    source_url: str | None = None,
    on_progress: "ProgressCallback | None" = None,
) -> IngestionResult:
    """End-to-end: video -> Whisper -> DB -> chunks -> embeddings -> ChromaDB.

    If the same content (by sha256 or source URL) was already ingested by this
    user, the existing transcript is reused instead of re-transcribing.
    """
    def report(percent: int, stage: str, message: str) -> None:
        if on_progress:
            on_progress(percent, stage, message)

    init_db()

    content_hash = _sha256_file(path)

    db = SessionLocal()
    try:
        existing = find_reusable_transcript(
            db, user_id=user_id, content_hash=content_hash, source_url=source_url
        )
        if existing is not None:
            report(100, "complete", "This video was already processed — reusing it.")
            return _result_from_existing(existing, db)

        result = transcribe_video(path, on_progress=on_progress)

        report(76, "saving", "Saving transcript to database…")
        transcript = save_transcript(
            db,
            result,
            source_path=path,
            title=title,
            video_id=video_id,
            user_id=user_id,
            source_url=source_url,
            content_hash=content_hash,
        )
        num_chunks = index_transcript(db, transcript, result, on_progress=on_progress)
        media_key = video_id or transcript.id
        return IngestionResult(
            transcript_id=transcript.id,
            language=transcript.language,
            is_english=transcript.is_english,
            num_chunks=num_chunks,
            duration_seconds=result.duration_seconds,
            original_chars=len(result.original_text),
            english_chars=len(result.english_text),
            media_key=media_key,
        )
    finally:
        db.close()


def delete_transcript_everywhere(
    transcript_id: str,
    *,
    user_id: str | None = None,
) -> bool:
    """Remove a transcript from Postgres and ChromaDB (and report the media key).

    Returns True if a transcript was deleted, False if it didn't exist or the
    caller doesn't own it. Media-file cleanup is handled by the HTTP layer.
    """
    from rag.pipeline.vectorstore import delete_transcript as vs_delete

    db = SessionLocal()
    try:
        transcript = (
            db.query(Transcript).filter(Transcript.id == transcript_id).first()
        )
        if transcript is None:
            return False
        # Ownership check: a signed-in user may only delete their own (or
        # unowned/global) transcripts.
        if (
            user_id is not None
            and transcript.user_id is not None
            and transcript.user_id != user_id
        ):
            return False

        vs_delete(transcript_id)  # ChromaDB vectors
        db.delete(transcript)  # cascades to transcript_chunks
        db.commit()
        return True
    finally:
        db.close()


def delete_by_video(video_id: str, *, user_id: str | None = None) -> list[str]:
    """Delete every transcript (and its vectors) linked to a backend video.

    Returns the transcript ids that were removed so the caller can clean up any
    stored media files. Idempotent: an empty list means there was nothing to
    remove (e.g. the video was never ingested), which is not an error.
    """
    from rag.pipeline.vectorstore import delete_transcript as vs_delete

    db = SessionLocal()
    try:
        rows = db.query(Transcript).filter(Transcript.video_id == video_id).all()
        removed: list[str] = []
        for transcript in rows:
            if (
                user_id is not None
                and transcript.user_id is not None
                and transcript.user_id != user_id
            ):
                continue
            vs_delete(transcript.id)
            db.delete(transcript)
            removed.append(transcript.id)
        db.commit()
        return removed
    finally:
        db.close()
