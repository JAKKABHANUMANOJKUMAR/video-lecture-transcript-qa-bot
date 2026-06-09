"""Step 3a — split a transcript into overlapping text chunks for embedding."""

from __future__ import annotations

import re

from rag.config import settings


def _split_sentences(text: str) -> list[str]:
    # Split on sentence boundaries while keeping it simple and dependency-free.
    parts = re.split(r"(?<=[.!?])\s+", text.strip())
    return [p.strip() for p in parts if p.strip()]


def chunk_text(
    text: str,
    chunk_size: int | None = None,
    chunk_overlap: int | None = None,
) -> list[str]:
    """Greedy sentence-aware chunking with character overlap.

    Sentences are accumulated until `chunk_size` (chars) is reached. Consecutive
    chunks share roughly `chunk_overlap` characters of trailing context so that
    information spanning a boundary is still retrievable.
    """
    chunk_size = chunk_size or settings.CHUNK_SIZE
    chunk_overlap = chunk_overlap or settings.CHUNK_OVERLAP
    text = (text or "").strip()
    if not text:
        return []

    sentences = _split_sentences(text)
    if not sentences:
        return []

    chunks: list[str] = []
    current = ""

    for sentence in sentences:
        if current and len(current) + len(sentence) + 1 > chunk_size:
            chunks.append(current.strip())
            # Start the next chunk with the overlap tail of the previous one.
            current = (current[-chunk_overlap:] + " " + sentence).strip() if chunk_overlap else sentence
        else:
            current = f"{current} {sentence}".strip()

    if current:
        chunks.append(current.strip())

    return chunks
