"""Tests for URL source detection (skipped if yt_dlp/gdown aren't installed)."""

import pytest

pytest.importorskip("yt_dlp")
pytest.importorskip("gdown")

from rag.pipeline.url_download import detect_source  # noqa: E402


def test_detect_youtube():
    for url in [
        "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        "https://youtu.be/dQw4w9WgXcQ",
        "http://m.youtube.com/watch?v=dQw4w9WgXcQ",
        "https://youtube.com/shorts/dQw4w9WgXcQ",
    ]:
        assert detect_source(url) == "youtube", url


def test_detect_gdrive():
    for url in [
        "https://drive.google.com/file/d/1AbCdEfGhIjK/view",
        "https://drive.google.com/open?id=1AbCdEfGhIjK",
        "https://drive.google.com/uc?id=1AbCdEfGhIjK",
    ]:
        assert detect_source(url) == "gdrive", url


def test_detect_unknown():
    assert detect_source("https://example.com/video.mp4") == "unknown"
    assert detect_source("not a url") == "unknown"
