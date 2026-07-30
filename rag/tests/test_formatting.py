"""Unit tests for the pure formatting helpers (no heavy deps)."""

from rag.pipeline.formatting import (
    dedupe_key,
    format_timestamp,
    safe_filename,
    similarity_from_distance,
    youtube_deep_link,
)


def test_safe_filename_strips_characters_windows_rejects():
    assert (
        safe_filename("What is Retrieval-Augmented Generation (RAG)?", "x")
        == "What is Retrieval-Augmented Generation (RAG)"
    )
    assert safe_filename('Week 3: intro/outro <notes>', "x") == "Week 3 introoutro notes"


def test_safe_filename_falls_back_when_nothing_usable_remains():
    assert safe_filename(None, "media-id") == "media-id"
    assert safe_filename("", "media-id") == "media-id"
    assert safe_filename("???", "media-id") == "media-id"
    assert safe_filename("   ", "media-id") == "media-id"


def test_safe_filename_collapses_whitespace_and_trims_dots():
    assert safe_filename("  Lecture   one .. ", "x") == "Lecture one"


def test_safe_filename_is_length_capped():
    assert len(safe_filename("a" * 400, "x")) == 120


def test_format_timestamp_basic():
    assert format_timestamp(None) == "0:00"
    assert format_timestamp(0) == "0:00"
    assert format_timestamp(5) == "0:05"
    assert format_timestamp(65) == "1:05"
    assert format_timestamp(600) == "10:00"


def test_format_timestamp_hours():
    assert format_timestamp(3725) == "1:02:05"  # 1h 2m 5s


def test_format_timestamp_negative_clamped():
    assert format_timestamp(-10) == "0:00"


def test_similarity_from_distance():
    assert similarity_from_distance(None) == 0.0
    assert similarity_from_distance(0.0) == 1.0
    assert similarity_from_distance(0.2) == 0.8
    # distances outside [0, 1] are clamped to a valid similarity
    assert similarity_from_distance(-0.5) == 1.0
    assert similarity_from_distance(1.5) == 0.0


def test_youtube_deep_link_variants():
    assert (
        youtube_deep_link("https://youtu.be/dQw4w9WgXcQ", 90)
        == "https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=90s"
    )
    assert (
        youtube_deep_link("https://www.youtube.com/watch?v=dQw4w9WgXcQ", 12.7)
        == "https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=12s"
    )
    assert (
        youtube_deep_link("https://youtube.com/shorts/dQw4w9WgXcQ", None)
        == "https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=0s"
    )


def test_youtube_deep_link_non_youtube():
    assert youtube_deep_link(None, 10) is None
    assert youtube_deep_link("https://drive.google.com/file/d/abc123/view", 10) is None
    assert youtube_deep_link("", 10) is None


def test_dedupe_key_rounds_timestamps():
    # Near-identical timestamps collapse to the same key; distinct ones don't.
    assert dedupe_key("t1", 10.01, 20.04) == dedupe_key("t1", 10.0, 20.0)
    assert dedupe_key("t1", 10.0, 20.0) != dedupe_key("t2", 10.0, 20.0)
    assert dedupe_key("t1", None, None) == ("t1", None, None)
