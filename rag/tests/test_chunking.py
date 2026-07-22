"""Tests for transcript chunking — especially timestamp preservation."""

from rag.pipeline.chunking import TimedChunk, chunk_segments, chunk_text


def _segments():
    # 6 short segments, ~10s apart, ~40 chars each.
    return [
        {"text": "Sentence one about python basics.", "start": 0.0, "end": 10.0},
        {"text": "Sentence two about variables here.", "start": 10.0, "end": 20.0},
        {"text": "Sentence three explains functions.", "start": 20.0, "end": 30.0},
        {"text": "Sentence four covers loops today.", "start": 30.0, "end": 40.0},
        {"text": "Sentence five discusses classes.", "start": 40.0, "end": 50.0},
        {"text": "Sentence six wraps everything up.", "start": 50.0, "end": 60.0},
    ]


def test_chunk_segments_preserves_span():
    chunks = chunk_segments(_segments(), chunk_size=80, chunk_overlap=0)
    assert len(chunks) > 1  # forced to split at size 80

    # Every chunk carries a valid, ordered timestamp span.
    for c in chunks:
        assert isinstance(c, TimedChunk)
        assert c.start_seconds <= c.end_seconds
        assert c.text

    # The first chunk starts at the very beginning and the last ends at the end.
    assert chunks[0].start_seconds == 0.0
    assert chunks[-1].end_seconds == 60.0


def test_chunk_segments_respects_size():
    chunks = chunk_segments(_segments(), chunk_size=80, chunk_overlap=0)
    # No chunk grossly exceeds the size (allow one segment of slack).
    for c in chunks:
        assert len(c.text) <= 80 + 40


def test_chunk_segments_empty():
    assert chunk_segments([], chunk_size=100, chunk_overlap=0) == []
    assert chunk_segments([{"text": "  ", "start": 0, "end": 1}]) == []


def test_chunk_segments_overlap_repeats_context():
    with_overlap = chunk_segments(_segments(), chunk_size=80, chunk_overlap=40)
    # Overlap should not lose coverage: still spans the full lecture.
    assert with_overlap[0].start_seconds == 0.0
    assert with_overlap[-1].end_seconds == 60.0


def test_chunk_text_fallback():
    text = "First sentence. Second sentence. Third sentence. " * 20
    chunks = chunk_text(text, chunk_size=100, chunk_overlap=20)
    assert len(chunks) > 1
    assert all(chunks)
    assert chunk_text("", chunk_size=100, chunk_overlap=20) == []
