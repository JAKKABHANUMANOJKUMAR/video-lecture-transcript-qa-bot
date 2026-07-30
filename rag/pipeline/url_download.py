"""Download videos from YouTube and Google Drive URLs to a local temp file."""

from __future__ import annotations

import os
import re
import shutil
import tempfile
from pathlib import Path
from typing import Callable

import yt_dlp
import gdown


_YOUTUBE_RE = re.compile(
    r"(?:https?://)?(?:www\.|m\.)?(?:youtube\.com/watch\?v=|youtu\.be/|youtube\.com/shorts/)([\w-]{11})"
)

# Drive links reach us in several shapes: the Share dialog's
# ``/file/d/<id>/view?usp=sharing``, the older ``open?id=``/``uc?id=``, the
# ``docs.google.com`` alias, and ``drive.usercontent.google.com/download?id=``.
_GDRIVE_HOST_RE = re.compile(
    r"(?:https?://)?(?:drive|docs|drive\.usercontent)\.google\.com/", re.I
)
_GDRIVE_ID_RE = re.compile(r"(?:/file/d/|[?&]id=)([\w-]{10,})")
_GDRIVE_FOLDER_RE = re.compile(r"drive\.google\.com/drive/(?:u/\d+/)?folders/", re.I)

# Prefixes used for the temp dirs we download into, so cleanup can recognise them.
_TMP_PREFIXES = ("askora_yt_", "askora_gd_")

# Drive happily shares things that aren't lectures. Catching these here gives a
# useful message instead of a cryptic ffmpeg decode failure deep in Whisper.
_NON_MEDIA_SUFFIXES = {
    ".pdf", ".doc", ".docx", ".txt", ".rtf", ".odt",
    ".ppt", ".pptx", ".key", ".xls", ".xlsx", ".csv",
    ".zip", ".rar", ".7z", ".tar", ".gz",
    ".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg",
    ".html", ".htm", ".json", ".exe", ".dmg",
}


def is_gdrive_folder_url(url: str) -> bool:
    """True for a Drive *folder* link — recognisable, but not something to fetch."""
    return bool(_GDRIVE_FOLDER_RE.search(url))


def is_gdrive_url(url: str) -> bool:
    """True for any Google Drive link we can act on — file or folder."""
    if not _GDRIVE_HOST_RE.search(url):
        return False
    return bool(_GDRIVE_ID_RE.search(url) or _GDRIVE_FOLDER_RE.search(url))


def detect_source(url: str) -> str:
    """Return 'youtube', 'gdrive', or 'unknown'."""
    if _YOUTUBE_RE.search(url):
        return "youtube"
    if is_gdrive_url(url):
        return "gdrive"
    return "unknown"


def cleanup_download(path: str | None) -> None:
    """Delete a downloaded file, and the temp dir we created to hold it."""
    if not path:
        return
    target = Path(path)
    target.unlink(missing_ok=True)
    parent = target.parent
    if parent.name.startswith(_TMP_PREFIXES):
        shutil.rmtree(parent, ignore_errors=True)


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
    # Rebuild a canonical watch URL from the captured 11-char video id so
    # noisy input (a stray "Shared link:" label, ?si= tracking params, extra
    # whitespace) can't reach yt-dlp and get rejected as "not a valid URL".
    match = _YOUTUBE_RE.search(url)
    if match:
        url = f"https://www.youtube.com/watch?v={match.group(1)}"

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


_NO_ACCESS = (
    "Cannot access this Google Drive file. Open it in Drive, choose "
    "Share → General access → 'Anyone with the link', then try again."
)


def _download_gdrive(
    url: str,
    on_progress: Callable[[int, str], None] | None = None,
) -> tuple[str, str]:
    if _GDRIVE_FOLDER_RE.search(url):
        raise ValueError(
            "That link points to a Google Drive folder, not a video. Open the "
            "video itself in Drive, use Share → Copy link, and paste that."
        )

    match = _GDRIVE_ID_RE.search(url)
    if not match:
        raise ValueError(
            "Could not find a file ID in that Google Drive link. Use the link "
            "from Drive's Share → Copy link."
        )

    file_id = match.group(1)
    gdrive_url = f"https://drive.google.com/uc?id={file_id}"

    # Download into a directory (not onto a fixed path) so gdown keeps the
    # file's real name in Drive — that name becomes the lecture title.
    tmp_dir = tempfile.mkdtemp(prefix="askora_gd_")

    if on_progress:
        on_progress(0, "Downloading from Google Drive…")

    def _hook(downloaded: int, total: int | None) -> None:
        if not on_progress:
            return
        pct = int(downloaded / total * 100) if total else 0
        on_progress(pct, f"Downloading from Google Drive… {pct}%")

    try:
        # No `fuzzy=` — gdown 6 dropped it, and the id is already canonical here.
        output = gdown.download(
            gdrive_url,
            tmp_dir + os.sep,
            quiet=True,
            progress=_hook,
        )
    except Exception as exc:
        shutil.rmtree(tmp_dir, ignore_errors=True)
        msg = str(exc)
        if any(word in msg.lower() for word in ("access", "permission", "private")):
            raise ValueError(_NO_ACCESS) from exc
        raise ValueError(f"Could not download from Google Drive: {msg}") from exc

    # gdown returns None (rather than raising) when Drive serves the sign-in or
    # quota page instead of the file.
    if not output or not Path(output).exists():
        shutil.rmtree(tmp_dir, ignore_errors=True)
        raise ValueError(_NO_ACCESS)

    downloaded = Path(output)
    if downloaded.suffix.lower() in _NON_MEDIA_SUFFIXES:
        suffix = downloaded.suffix
        shutil.rmtree(tmp_dir, ignore_errors=True)
        raise ValueError(
            f"That Google Drive file is a {suffix} file, not a video or audio "
            "recording. Share a lecture recording instead."
        )

    if on_progress:
        on_progress(100, "Download complete")

    return str(downloaded), downloaded.stem or "Google Drive video"
