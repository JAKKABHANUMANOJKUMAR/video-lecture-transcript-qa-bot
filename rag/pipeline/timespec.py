"""Parse time expressions out of a question so retrieval can be scoped by time.

"What does she explain at 12:41?" and "summarise 2:10–4:00" are not semantic
questions — the words in them say almost nothing about the lecture content, so
embedding similarity retrieves the wrong chunks. Detecting the time expression
lets the chain retrieve *by the clock* instead.

Kept free of heavy imports (Whisper / Chroma / Groq), like ``formatting``, so it
can be unit-tested in isolation.
"""

from __future__ import annotations

import re
from dataclasses import dataclass

from rag.pipeline.formatting import format_timestamp

# A point question ("what happens at 12:41?") is answered from a window around
# the mark: a little before it for run-up, more after it, because an
# explanation starts at the timestamp and then continues.
POINT_PAD_BEFORE = 30.0
POINT_PAD_AFTER = 90.0

# How far "after 5:00" reaches when the lecture duration isn't known.
OPEN_ENDED_SPAN = 300.0

_CLOCK = r"\d{1,2}:\d{2}(?::\d{2})?"
# Units end at a non-letter rather than \b, so the "m" in "1h20m" (followed by a
# digit, not a word boundary) still terminates the token.
_UNIT_END = r"(?![A-Za-z])"
# "90 seconds", "5 min", "1h20m" — full unit words may be spaced from the
# number, bare single letters must be attached so "5 s" can't eat "5 slides".
_DUR = (
    rf"(?:\d+(?:\.\d+)?(?:\s*(?:hours?|hrs?|minutes?|mins?|seconds?|secs?)|h|m|s){_UNIT_END}\s*)+"
)
_SPAN = rf"(?:{_CLOCK}|{_DUR})"
# "2:30 pm" is a wall clock, not a lecture offset.
_NOT_WALL_CLOCK = r"(?!\s*[ap]\.?\s*m\b)"

_UNIT_SECONDS = {
    "h": 3600.0, "hr": 3600.0, "hrs": 3600.0, "hour": 3600.0, "hours": 3600.0,
    "m": 60.0, "min": 60.0, "mins": 60.0, "minute": 60.0, "minutes": 60.0,
    "s": 1.0, "sec": 1.0, "secs": 1.0, "second": 1.0, "seconds": 1.0,
}
_DUR_TOKEN_RE = re.compile(
    rf"(\d+(?:\.\d+)?)\s*(hours?|hrs?|minutes?|mins?|seconds?|secs?|h|m|s){_UNIT_END}", re.I
)

_RANGE_RE = re.compile(
    rf"\b(?:between\s+|from\s+)?({_SPAN})\s*(?:and|to|until|till|through|[-–—])\s*({_SPAN})",
    re.I,
)
_HEAD_RE = re.compile(rf"\b(?:first|opening|initial)\s+({_DUR})", re.I)
_TAIL_RE = re.compile(rf"\b(?:last|final|closing|ending)\s+({_DUR})", re.I)
_AFTER_RE = re.compile(rf"\b(?:after|past|beyond|since)\s+(?:the\s+)?({_SPAN})", re.I)
_BEFORE_RE = re.compile(
    rf"\b(?:before|up\s+to|prior\s+to|until)\s+(?:the\s+)?({_SPAN})", re.I
)
_MINUTE_N_RE = re.compile(r"\b(?:minute|min)\s+(\d{1,3})\b", re.I)
_AT_RE = re.compile(
    rf"\b(?:at|around|near|about|@)\s+(?:the\s+)?({_SPAN}){_NOT_WALL_CLOCK}", re.I
)
# A bare "12:41" is a timestamp in this context; "2:30 pm" is a wall clock.
_BARE_CLOCK_RE = re.compile(rf"\b({_CLOCK})\b{_NOT_WALL_CLOCK}", re.I)


@dataclass(frozen=True)
class TimeWindow:
    """A span of lecture time a question is asking about."""

    start: float
    end: float
    kind: str  # point | range | head | tail | after | before
    raw: str

    @property
    def label(self) -> str:
        """Human-readable span, e.g. ``2:10–4:00``."""
        return f"{format_timestamp(self.start)}–{format_timestamp(self.end)}"


def _clock_to_seconds(text: str) -> float | None:
    parts = text.split(":")
    try:
        nums = [int(p) for p in parts]
    except ValueError:
        return None
    if len(nums) == 2:
        minutes, seconds = nums
        return None if seconds >= 60 else minutes * 60.0 + seconds
    if len(nums) == 3:
        hours, minutes, seconds = nums
        if minutes >= 60 or seconds >= 60:
            return None
        return hours * 3600.0 + minutes * 60.0 + seconds
    return None


def _duration_to_seconds(text: str) -> float | None:
    total = 0.0
    found = False
    for value, unit in _DUR_TOKEN_RE.findall(text):
        total += float(value) * _UNIT_SECONDS[unit.lower()]
        found = True
    return total if found else None


def _to_seconds(text: str) -> float | None:
    text = text.strip()
    return _clock_to_seconds(text) if ":" in text else _duration_to_seconds(text)


def _window(
    start: float,
    end: float,
    kind: str,
    raw: str,
    duration_seconds: float | None,
) -> TimeWindow:
    """Clamp a raw span into a usable window.

    ``start`` is deliberately *not* clamped to the duration: the caller needs to
    see that the question pointed past the end of the lecture so it can say so
    instead of silently answering about the final minute.
    """
    start = max(0.0, start)
    end = max(end, start + 1.0)
    if duration_seconds and duration_seconds > 0 and start < duration_seconds:
        end = min(end, duration_seconds)
    return TimeWindow(start=start, end=end, kind=kind, raw=raw.strip())


def parse_time_window(
    question: str,
    duration_seconds: float | None = None,
) -> TimeWindow | None:
    """Return the time span a question is asking about, or ``None``.

    ``duration_seconds`` resolves spans that are relative to the end of the
    lecture ("the last 2 minutes"); without it those return ``None`` and the
    caller falls back to ordinary semantic retrieval.
    """
    if not question or not question.strip():
        return None
    text = question.strip()

    match = _RANGE_RE.search(text)
    if match:
        start = _to_seconds(match.group(1))
        end = _to_seconds(match.group(2))
        if start is not None and end is not None and end > start:
            return _window(start, end, "range", match.group(0), duration_seconds)

    match = _HEAD_RE.search(text)
    if match:
        span = _duration_to_seconds(match.group(1))
        if span:
            return _window(0.0, span, "head", match.group(0), duration_seconds)

    match = _TAIL_RE.search(text)
    if match:
        span = _duration_to_seconds(match.group(1))
        # Only meaningful once we know where the lecture ends.
        if span and duration_seconds and duration_seconds > 0:
            return _window(
                max(0.0, duration_seconds - span),
                duration_seconds,
                "tail",
                match.group(0),
                duration_seconds,
            )

    match = _AFTER_RE.search(text)
    if match:
        start = _to_seconds(match.group(1))
        if start is not None:
            end = duration_seconds if duration_seconds else start + OPEN_ENDED_SPAN
            return _window(start, end, "after", match.group(0), duration_seconds)

    match = _BEFORE_RE.search(text)
    if match:
        end = _to_seconds(match.group(1))
        if end is not None and end > 0:
            return _window(0.0, end, "before", match.group(0), duration_seconds)

    match = _MINUTE_N_RE.search(text)
    if match:
        start = int(match.group(1)) * 60.0
        return _window(start, start + 60.0, "range", match.group(0), duration_seconds)

    match = _AT_RE.search(text)
    if match:
        point = _to_seconds(match.group(1))
        if point is not None:
            return _window(
                point - POINT_PAD_BEFORE,
                point + POINT_PAD_AFTER,
                "point",
                match.group(0),
                duration_seconds,
            )

    match = _BARE_CLOCK_RE.search(text)
    if match:
        point = _clock_to_seconds(match.group(1))
        if point is not None:
            return _window(
                point - POINT_PAD_BEFORE,
                point + POINT_PAD_AFTER,
                "point",
                match.group(0),
                duration_seconds,
            )

    return None
