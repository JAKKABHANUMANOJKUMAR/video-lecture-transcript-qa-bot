"""Step 1 — Whisper transcription.

Extracts audio from a video file (via ffmpeg), transcribes it in its original
language, detects the language, and (if not English) produces an English
translation. Both texts are returned for storage.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from functools import lru_cache
from typing import TYPE_CHECKING

import whisper

from rag.config import settings

if TYPE_CHECKING:
    from rag.pipeline.progress import ProgressCallback

WHISPER_SAMPLE_RATE = 16000


@dataclass
class TranscriptionResult:
    language: str
    is_english: bool
    original_text: str
    english_text: str
    duration_seconds: float
    segments: list[dict] = field(default_factory=list)
    english_segments: list[dict] = field(default_factory=list)


@lru_cache(maxsize=1)
def _load_model(model_name: str):
    """Load (and cache) the Whisper model. First call downloads the weights."""
    return whisper.load_model(model_name)


def _run_whisper(model, audio, *, task: str, language: str | None = None) -> dict:
    kwargs: dict = {"task": task, "fp16": False, "verbose": False}
    if language and language != "unknown":
        kwargs["language"] = language
    return model.transcribe(audio, **kwargs)


def transcribe_video(
    path: str,
    model_name: str | None = None,
    *,
    on_progress: "ProgressCallback | None" = None,
) -> TranscriptionResult:
    """Transcribe a video/audio file and return original + English text.

    Whisper's `load_audio` runs ffmpeg under the hood to extract and decode the
    audio track from any media container, so video files work directly.
    """
    def report(percent: int, stage: str, message: str) -> None:
        if on_progress:
            on_progress(percent, stage, message)

    report(18, "loading_model", "Loading speech recognition model…")
    model = _load_model(model_name or settings.WHISPER_MODEL)

    report(22, "extracting_audio", "Extracting audio from video…")
    audio = whisper.load_audio(path)
    duration_seconds = round(len(audio) / WHISPER_SAMPLE_RATE, 2)

    report(28, "transcribing", "Transcribing speech (this may take a while)…")
    original = _run_whisper(model, audio, task="transcribe")
    language = (original.get("language") or "unknown").lower()
    original_text = (original.get("text") or "").strip()
    is_english = language == "en"

    if not original_text:
        raise RuntimeError(
            "Whisper could not extract any speech from this file. "
            "Check that the video has a clear audio track."
        )

    report(58, "transcribing", f"Transcription complete ({language.upper()}).")

    if is_english:
        english_text = original_text
        english_segments = original.get("segments", [])
    else:
        report(62, "translating", "Translating transcript to English…")
        english_text = ""
        english_segments: list[dict] = []
        try:
            translated = _run_whisper(model, audio, task="translate", language=language)
            english_text = (translated.get("text") or "").strip()
            english_segments = translated.get("segments", [])
        except Exception:
            english_text = ""

        if not english_text:
            try:
                translated = _run_whisper(model, audio, task="translate")
                english_text = (translated.get("text") or "").strip()
                if translated.get("segments"):
                    english_segments = translated.get("segments", [])
            except Exception:
                english_text = ""

        if not english_text:
            english_text = original_text

        report(72, "translating", "Translation complete.")

    return TranscriptionResult(
        language=language,
        is_english=is_english,
        original_text=original_text,
        english_text=english_text,
        duration_seconds=duration_seconds,
        segments=original.get("segments", []),
        english_segments=english_segments,
    )
