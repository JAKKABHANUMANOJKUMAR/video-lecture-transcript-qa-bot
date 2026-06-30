"""Step 3a — split transcript segments into overlapping timed chunks for embedding."""

from __future__ import annotations

import re
from dataclasses import dataclass

from rag.config import settings


@dataclass
class TimedChunk:
    text: str
    start_seconds: float
    end_seconds: float


def _split_sentences(text: str) -> list[str]:
    parts = re.split(r"(?<=[.!?])\s+", text.strip())
    return [p.strip() for p in parts if p.strip()]


def _chunk_by_chars(text: str, chunk_size: int, chunk_overlap: int) -> list[str]:
    chunks: list[str] = []
    start = 0
    while start < len(text):
        end = min(start + chunk_size, len(text))
        chunks.append(text[start:end].strip())
        if end >= len(text):
            break
        start = max(end - chunk_overlap, start + 1)
    return [c for c in chunks if c]


def chunk_text(
    text: str,
    chunk_size: int | None = None,
    chunk_overlap: int | None = None,
) -> list[str]:
    """Greedy sentence-aware chunking (fallback when Whisper segments are missing)."""
    chunk_size = chunk_size or settings.CHUNK_SIZE
    chunk_overlap = chunk_overlap or settings.CHUNK_OVERLAP
    text = (text or "").strip()
    if not text:
        return []

    sentences = _split_sentences(text)
    if not sentences:
        return []

    if len(sentences) == 1 and len(sentences[0]) > chunk_size:
        return _chunk_by_chars(text, chunk_size, chunk_overlap)

    chunks: list[str] = []
    current = ""

    for sentence in sentences:
        if current and len(current) + len(sentence) + 1 > chunk_size:
            chunks.append(current.strip())
            current = (current[-chunk_overlap:] + " " + sentence).strip() if chunk_overlap else sentence
        else:
            current = f"{current} {sentence}".strip()

    if current:
        chunks.append(current.strip())

    return chunks


def _normalize_segments(segments: list[dict]) -> list[dict]:
    normalized: list[dict] = []
    for seg in segments:
        text = (seg.get("text") or "").strip()
        if not text:
            continue
        start = float(seg.get("start", 0.0))
        end = float(seg.get("end", start))
        if end < start:
            end = start
        normalized.append({"text": text, "start": start, "end": end})
    return normalized


def chunk_segments(
    segments: list[dict],
    chunk_size: int | None = None,
    chunk_overlap: int | None = None,
) -> list[TimedChunk]:
    """Group Whisper segments into chunks while preserving start/end timestamps."""
    chunk_size = chunk_size or settings.CHUNK_SIZE
    chunk_overlap = chunk_overlap or settings.CHUNK_OVERLAP
    segs = _normalize_segments(segments)
    if not segs:
        return []

    chunks: list[TimedChunk] = []
    i = 0
    while i < len(segs):
        batch: list[dict] = []
        char_count = 0
        j = i
        while j < len(segs):
            piece = segs[j]["text"]
            extra = len(piece) + (1 if batch else 0)
            if batch and char_count + extra > chunk_size:
                break
            batch.append(segs[j])
            char_count += extra
            j += 1

        if not batch:
            i += 1
            continue

        chunks.append(
            TimedChunk(
                text=" ".join(s["text"] for s in batch).strip(),
                start_seconds=batch[0]["start"],
                end_seconds=batch[-1]["end"],
            )
        )

        if j >= len(segs):
            break

        overlap_chars = 0
        k = j - 1
        while k > i and overlap_chars < chunk_overlap:
            overlap_chars += len(segs[k]["text"])
            k -= 1
        i = max(k + 1, i + 1)

    return chunks
