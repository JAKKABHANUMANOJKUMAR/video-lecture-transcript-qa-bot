"""Step 1 — Whisper transcription.

Extracts audio from a video file (via ffmpeg), transcribes it in its original
language, detects the language, and (if not English) produces an English
translation. Both texts are returned for storage.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from functools import lru_cache

import whisper

from rag.config import settings

WHISPER_SAMPLE_RATE = 16000


@dataclass
class TranscriptionResult:
    language: str
    is_english: bool
    original_text: str
    english_text: str
    duration_seconds: float
    segments: list[dict] = field(default_factory=list)


@lru_cache(maxsize=1)
def _load_model(model_name: str):
    """Load (and cache) the Whisper model. First call downloads the weights."""
    return whisper.load_model(model_name)


def transcribe_video(path: str, model_name: str | None = None) -> TranscriptionResult:
    """Transcribe a video/audio file and return original + English text.

    Whisper's `load_audio` runs ffmpeg under the hood to extract and decode the
    audio track from any media container, so video files work directly.
    """
    model = _load_model(model_name or settings.WHISPER_MODEL)

    # Extract audio from the video once and reuse it for both passes.
    audio = whisper.load_audio(path)
    duration_seconds = round(len(audio) / WHISPER_SAMPLE_RATE, 2)

    # Pass 1: transcribe in the original language (also detects the language).
    original = model.transcribe(audio, task="transcribe", fp16=False)
    language = (original.get("language") or "unknown").lower()
    original_text = (original.get("text") or "").strip()
    is_english = language == "en"

    # Pass 2: translate to English only when needed.
    if is_english:
        english_text = original_text
    else:
        translated = model.transcribe(audio, task="translate", fp16=False)
        english_text = (translated.get("text") or "").strip()

    return TranscriptionResult(
        language=language,
        is_english=is_english,
        original_text=original_text,
        english_text=english_text,
        duration_seconds=duration_seconds,
        segments=original.get("segments", []),
    )
