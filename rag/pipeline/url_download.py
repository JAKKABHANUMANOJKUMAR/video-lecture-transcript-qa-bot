"""Download videos from YouTube and Google Drive URLs to a local temp file."""

from __future__ import annotations

import re
import tempfile
from pathlib import Path
from typing import Callable

import yt_dlp
import gdown


_YOUTUBE_RE = re.compile(
    r"(?:https?://)?(?:www\.|m\.)?(?:youtube\.com/watch\?v=|youtu\.be/|youtube\.com/shorts/)([\w-]{11})"
)

_GDRIVE_RE = re.compile(
    r"(?:https?://)?drive\.google\.com/(?:file/d/|open\?id=|uc\?id=)([\w-]+)"
)


def detect_source(url: str) -> str:
    """Return 'youtube', 'gdrive', or 'unknown'."""
    if _YOUTUBE_RE.search(url):
        return "youtube"
    if _GDRIVE_RE.search(url):
        return "gdrive"
    return "unknown"


def extract_title_from_url(url: str, source: str) -> str | None:
    """Try to extract a human-readable title without downloading."""
    if source == "youtube":
        try:
            with yt_dlp.YoutubeDL({"quiet": True, "no_warnings": True, "skip_download": True}) as ydl:
                info = ydl.extract_info(url, download=False)
                return info.get("title")
        except Exception:
            return None
    return None


def download_video(
    url: str,
    on_progress: Callable[[int, str], None] | None = None,
) -> tuple[str, str]:
    """Download video from URL, return (local_path, title).

    Raises ValueError for unsupported/inaccessible URLs.
    """
    source = detect_source(url)

    if source == "youtube":
        return _download_youtube(url, on_progress)
    elif source == "gdrive":
        return _download_gdrive(url, on_progress)
    else:
        raise ValueError(
            f"Unsupported URL. Please provide a YouTube or Google Drive link. Got: {url}"
        )


def _download_youtube(
    url: str,
    on_progress: Callable[[int, str], None] | None = None,
) -> tuple[str, str]:
    tmp_dir = tempfile.mkdtemp(prefix="askora_yt_")
    out_template = str(Path(tmp_dir) / "%(title)s.%(ext)s")

    title = "YouTube video"
    downloaded_path: str | None = None

    def _hook(d: dict) -> None:
        nonlocal downloaded_path
        if d.get("status") == "downloading" and on_progress:
            total = d.get("total_bytes") or d.get("total_bytes_estimate") or 0
            dl = d.get("downloaded_bytes", 0)
            pct = int(dl / total * 100) if total else 0
            on_progress(pct, f"Downloading from YouTube… {pct}%")
        elif d.get("status") == "finished":
            downloaded_path = d.get("filename")
            if on_progress:
                on_progress(100, "Download complete")

    opts = {
        "format": "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best",
        "outtmpl": out_template,
        "quiet": True,
        "no_warnings": True,
        "progress_hooks": [_hook],
        "merge_output_format": "mp4",
        "noplaylist": True,
    }

    try:
        with yt_dlp.YoutubeDL(opts) as ydl:
            info = ydl.extract_info(url, download=True)
            title = info.get("title", title)
            if not downloaded_path:
                downloaded_path = ydl.prepare_filename(info)
    except yt_dlp.utils.DownloadError as exc:
        msg = str(exc)
        if "Private video" in msg or "Sign in" in msg:
            raise ValueError(
                "This YouTube video is private or age-restricted. "
                "Please make it public or unlisted, then try again."
            ) from exc
        if "unavailable" in msg.lower():
            raise ValueError(
                "This YouTube video is unavailable. Please check the URL and try again."
            ) from exc
        raise ValueError(f"Could not download YouTube video: {msg}") from exc

    if not downloaded_path or not Path(downloaded_path).exists():
        candidates = list(Path(tmp_dir).glob("*"))
        if candidates:
            downloaded_path = str(candidates[0])
        else:
            raise ValueError("YouTube download completed but no file was produced.")

    return downloaded_path, title


def _download_gdrive(
    url: str,
    on_progress: Callable[[int, str], None] | None = None,
) -> tuple[str, str]:
    match = _GDRIVE_RE.search(url)
    if not match:
        raise ValueError("Could not parse Google Drive file ID from URL.")

    file_id = match.group(1)
    gdrive_url = f"https://drive.google.com/uc?id={file_id}"

    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".mp4", prefix="askora_gd_")
    tmp.close()

    if on_progress:
        on_progress(0, "Downloading from Google Drive…")

    try:
        output = gdown.download(gdrive_url, tmp.name, quiet=True, fuzzy=True)
    except Exception as exc:
        Path(tmp.name).unlink(missing_ok=True)
        msg = str(exc)
        if "access" in msg.lower() or "permission" in msg.lower():
            raise ValueError(
                "Cannot access this Google Drive file. "
                "Please set sharing to 'Anyone with the link can view', then try again."
            ) from exc
        raise ValueError(f"Could not download from Google Drive: {msg}") from exc

    if not output or not Path(output).exists():
        Path(tmp.name).unlink(missing_ok=True)
        raise ValueError(
            "Cannot access this Google Drive file. "
            "Please set sharing to 'Anyone with the link can view', then try again."
        )

    if on_progress:
        on_progress(100, "Download complete")

    file_name = Path(output).stem or "Google Drive video"
    return output, file_name
