"""Tests for parsing time expressions out of a question."""

import pytest

from rag.pipeline.timespec import (
    POINT_PAD_AFTER,
    POINT_PAD_BEFORE,
    parse_time_window,
)


@pytest.mark.parametrize(
    "question,start,end",
    [
        ("What is covered between 2:10 and 4:00?", 130, 240),
        ("Summarise from 1:00 to 2:30", 60, 150),
        ("explain 2:10-4:00", 130, 240),
        ("explain 2:10 – 4:00", 130, 240),
        ("What happens between 1:02:00 and 1:03:00?", 3720, 3780),
        ("recap between 30 seconds and 90 seconds", 30, 90),
    ],
)
def test_ranges(question, start, end):
    window = parse_time_window(question)
    assert window is not None, question
    assert window.kind == "range"
    assert (window.start, window.end) == (start, end)


@pytest.mark.parametrize(
    "question,point",
    [
        ("What does she explain at 12:41?", 761),
        ("explain around 5:30", 330),
        ("what is said near 0:45", 45),
        ("what about 12:41", 761),
        ("Explain the part at 90 seconds", 90),
        ("what happens at 1h20m", 4800),
        ("explain minute 7", 420),
    ],
)
def test_points(question, point):
    window = parse_time_window(question)
    assert window is not None, question
    if window.kind == "point":
        assert window.start == pytest.approx(max(0.0, point - POINT_PAD_BEFORE))
        assert window.end == pytest.approx(point + POINT_PAD_AFTER)
    else:  # "minute 7" resolves to the whole minute
        assert window.start == pytest.approx(point)


def test_head_and_tail():
    head = parse_time_window("summarise the first 5 minutes")
    assert head is not None and head.kind == "head"
    assert (head.start, head.end) == (0, 300)

    tail = parse_time_window("what is in the last 2 minutes?", duration_seconds=600)
    assert tail is not None and tail.kind == "tail"
    assert (tail.start, tail.end) == (480, 600)


def test_tail_needs_duration():
    """Without a known duration, "last 2 minutes" can't be resolved."""
    assert parse_time_window("what is in the last 2 minutes?") is None


def test_after_and_before():
    after = parse_time_window("what does he cover after 5:00?", duration_seconds=600)
    assert after is not None and after.kind == "after"
    assert (after.start, after.end) == (300, 600)

    before = parse_time_window("what is explained before 3:00?")
    assert before is not None and before.kind == "before"
    assert (before.start, before.end) == (0, 180)


def test_window_is_clamped_to_duration():
    window = parse_time_window("explain at 5:30", duration_seconds=340)
    assert window is not None
    assert window.end == 340


def test_start_is_not_clamped_so_caller_can_detect_overrun():
    """A question past the end must stay detectable, not silently slide back."""
    window = parse_time_window("what happens at 50:00", duration_seconds=176)
    assert window is not None
    assert window.start > 176


@pytest.mark.parametrize(
    "question",
    [
        "What is retrieval-augmented generation?",
        "Explain backpropagation",
        "What is the 3:1 ratio he mentions?",
        "Is the lecture at 2:30 pm?",
        "summarise the last few minutes",
        "",
    ],
)
def test_no_false_positives(question):
    assert parse_time_window(question) is None


def test_label():
    window = parse_time_window("between 2:10 and 4:00")
    assert window is not None
    assert window.label == "2:10–4:00"
