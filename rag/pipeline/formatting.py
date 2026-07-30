"""Small pure helpers for formatting and source handling.

Kept free of heavy imports (Whisper / Chroma / Groq) so they can be unit-tested
in isolation and reused across the pipeline.
"""

from __future__ import annotations

import re

_YOUTUBE_ID_RE = re.compile(
    r"(?:youtube\.com/watch\?v=|youtu\.be/|youtube\.com/shorts/)([\w-]{11})"
)

_UNSAFE_FILENAME_CHARS = re.compile(r'[<>:"/\\|?*\x00-\x1f]')


def safe_filename(name: str | None, fallback: str) -> str:
    """Turn a lecture title into a filename every OS will accept.

    Lecture titles routinely contain ``?``, ``:`` and ``/`` — all illegal on
    Windows — so downloads need them stripped rather than escaped.
    """
    cleaned = _UNSAFE_FILENAME_CHARS.sub("", (name or "").strip())
    cleaned = re.sub(r"\s+", " ", cleaned).strip(" .")
    return cleaned[:120] if cleaned else fallback


def format_timestamp(seconds: float | None) -> str:
    """Render seconds as a ``m:ss`` (or ``h:mm:ss``) label."""
    if seconds is None:
        return "0:00"
    total = max(0, int(seconds))
    h, rem = divmod(total, 3600)
    m, s = divmod(rem, 60)
    if h:
        return f"{h}:{m:02d}:{s:02d}"
    return f"{m}:{s:02d}"


def similarity_from_distance(distance: float | None) -> float:
    """Convert a cosine distance into a clamped 0..1 similarity score."""
    if distance is None:
        return 0.0
    return round(max(0.0, min(1.0, 1.0 - float(distance))), 4)


def youtube_deep_link(source_url: str | None, start_seconds: float | None) -> str | None:
    """Build a ``…&t=<n>s`` deep link for a YouTube source, else None."""
    if not source_url:
        return None
    match = _YOUTUBE_ID_RE.search(source_url)
    if not match:
        return None
    video_id = match.group(1)
    start = max(0, int(start_seconds or 0))
    return f"https://www.youtube.com/watch?v={video_id}&t={start}s"


def dedupe_key(transcript_id: str, start_seconds: float | None, end_seconds: float | None) -> tuple:
    """Key used to collapse bilingual (original+english) hits for the same moment."""
    start = round(float(start_seconds), 1) if start_seconds is not None else None
    end = round(float(end_seconds), 1) if end_seconds is not None else None
    return (transcript_id, start, end)
