"""Tests for URL source detection (skipped if yt_dlp/gdown aren't installed)."""

import pytest

pytest.importorskip("yt_dlp")
gdown = pytest.importorskip("gdown")

from pathlib import Path  # noqa: E402

from rag.pipeline import url_download  # noqa: E402
from rag.pipeline.url_download import cleanup_download, detect_source  # noqa: E402


def test_detect_youtube():
    for url in [
        "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        "https://youtu.be/dQw4w9WgXcQ",
        "http://m.youtube.com/watch?v=dQw4w9WgXcQ",
        "https://youtube.com/shorts/dQw4w9WgXcQ",
    ]:
        assert detect_source(url) == "youtube", url


@pytest.mark.parametrize(
    "url",
    [
        # What Drive's Share dialog actually produces today.
        "https://drive.google.com/file/d/1AbCdEfGhIjK/view?usp=sharing",
        "https://drive.google.com/file/d/1AbCdEfGhIjK/view?usp=drive_link",
        "https://drive.google.com/file/d/1AbCdEfGhIjK/preview",
        "https://drive.google.com/u/0/file/d/1AbCdEfGhIjK/view",
        "https://drive.google.com/open?id=1AbCdEfGhIjK",
        "https://drive.google.com/uc?id=1AbCdEfGhIjK",
        "https://drive.google.com/uc?export=download&id=1AbCdEfGhIjK",
        "https://docs.google.com/file/d/1AbCdEfGhIjK/edit",
        "https://drive.usercontent.google.com/download?id=1AbCdEfGhIjK&export=download",
        # A folder is still Drive — it gets its own explanatory error later.
        "https://drive.google.com/drive/folders/1AbCdEfGhIjK",
        "https://drive.google.com/drive/u/0/folders/1AbCdEfGhIjK",
    ],
)
def test_detect_gdrive(url):
    assert detect_source(url) == "gdrive", url


def test_detect_unknown():
    assert detect_source("https://example.com/video.mp4") == "unknown"
    assert detect_source("not a url") == "unknown"
    assert detect_source("https://drive.google.com/") == "unknown"


def test_folder_link_explains_itself():
    with pytest.raises(ValueError, match="folder"):
        url_download._download_gdrive("https://drive.google.com/drive/folders/1AbCdEfGhIjK")


def test_gdrive_download_keeps_real_filename_as_title(monkeypatch, tmp_path):
    """gdown is handed a directory so the Drive filename survives as the title."""
    captured = {}

    def fake_download(url, output, **kwargs):
        captured["url"] = url
        captured["output"] = output
        target = Path(output) / "Week 3 — Backpropagation.mp4"
        target.write_bytes(b"video")
        return str(target)

    monkeypatch.setattr(url_download.gdown, "download", fake_download)

    path, title = url_download._download_gdrive(
        "https://drive.google.com/file/d/1AbCdEfGhIjK/view?usp=sharing"
    )

    assert title == "Week 3 — Backpropagation"
    assert Path(path).exists()
    assert captured["url"] == "https://drive.google.com/uc?id=1AbCdEfGhIjK"
    # A directory, not a fixed filename — otherwise the title is a temp name.
    assert captured["output"].endswith(("/", "\\"))
    cleanup_download(path)


def test_gdrive_call_matches_installed_gdown_signature(monkeypatch):
    """Guards against gdown dropping a kwarg we pass (it removed `fuzzy` in v6).

    The mocked tests above accept **kwargs, so only binding against the real
    signature catches a call this version of gdown would reject at runtime.
    """
    import inspect

    signature = inspect.signature(gdown.download)
    captured = {}

    def fake_download(*args, **kwargs):
        signature.bind(*args, **kwargs)  # raises TypeError on an unknown kwarg
        captured.update(kwargs)
        target = Path(kwargs.get("output") or args[1]) / "lecture.mp4"
        target.write_bytes(b"video")
        return str(target)

    monkeypatch.setattr(url_download.gdown, "download", fake_download)

    path, _ = url_download._download_gdrive("https://drive.google.com/file/d/1AbCdEfGhIjK/view")
    cleanup_download(path)


def test_gdrive_rejects_non_video(monkeypatch):
    def fake_download(url, output, **kwargs):
        target = Path(output) / "lecture-notes.pdf"
        target.write_bytes(b"%PDF-")
        return str(target)

    monkeypatch.setattr(url_download.gdown, "download", fake_download)

    with pytest.raises(ValueError, match="not a video"):
        url_download._download_gdrive("https://drive.google.com/file/d/1AbCdEfGhIjK/view")


def test_gdrive_permission_page_is_reported_clearly(monkeypatch):
    """gdown returns None (no exception) when Drive serves a sign-in page."""
    monkeypatch.setattr(url_download.gdown, "download", lambda *a, **k: None)

    with pytest.raises(ValueError, match="Anyone with the link"):
        url_download._download_gdrive("https://drive.google.com/file/d/1AbCdEfGhIjK/view")


def test_cleanup_removes_the_temp_dir(tmp_path, monkeypatch):
    def fake_download(url, output, **kwargs):
        target = Path(output) / "lecture.mp4"
        target.write_bytes(b"video")
        return str(target)

    monkeypatch.setattr(url_download.gdown, "download", fake_download)
    path, _ = url_download._download_gdrive("https://drive.google.com/file/d/1AbCdEfGhIjK/view")
    parent = Path(path).parent

    cleanup_download(path)

    assert not parent.exists()


def test_cleanup_leaves_unrelated_directories_alone(tmp_path):
    keeper = tmp_path / "media"
    keeper.mkdir()
    video = keeper / "lecture.mp4"
    video.write_bytes(b"video")

    cleanup_download(str(video))

    assert not video.exists()
    assert keeper.exists()
