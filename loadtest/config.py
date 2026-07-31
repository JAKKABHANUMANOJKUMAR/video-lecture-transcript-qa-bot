"""Shared configuration for the Locust load tests.

Everything is env-overridable so the same scenarios can run against localhost,
a Caddy gateway, or a public tunnel URL without editing code.
"""

from __future__ import annotations

import itertools
import os
import threading
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent

# --- Targets -----------------------------------------------------------------
# Split ports = the normal dev layout. Behind a single origin (Caddy gateway or
# a Cloudflare tunnel) set BOTH to that origin, e.g.
#   LEKTA_API=https://x.trycloudflare.com  LEKTA_RAG=https://x.trycloudflare.com
#
# 127.0.0.1, NOT localhost, and it matters enormously on Windows: `localhost`
# resolves to IPv6 ::1 first, uvicorn listens only on IPv4, and every NEW
# connection therefore stalls ~2s waiting to fall back. Measured here: 2081 ms
# vs 20 ms for an identical /health call. Locust opens a fresh connection per
# virtual user, so using `localhost` adds that 2s to whatever request happens
# to be first (usually login) and makes the app look 8x slower than it is.
API = os.getenv("LEKTA_API", "http://127.0.0.1:8000").rstrip("/")
RAG = os.getenv("LEKTA_RAG", "http://127.0.0.1:8100").rstrip("/")

# --- Test accounts -----------------------------------------------------------
# A distinctive prefix so cleanup.py can find and remove everything afterwards.
USER_PREFIX = os.getenv("LEKTA_USER_PREFIX", "loadtest+")
# Must survive pydantic's EmailStr validation. Special-use domains (.local,
# .test, .invalid, localhost) are rejected outright and every signup 422s, so
# use a real-looking subdomain of the RFC 2606 example domain.
USER_DOMAIN = os.getenv("LEKTA_USER_DOMAIN", "loadtest.example.com")
PASSWORD = os.getenv("LEKTA_PASSWORD", "loadtest-pw-123")

# Size of the account pool. Virtual users claim accounts round-robin, so this
# can be smaller than the concurrency if you want contention on one account.
POOL_SIZE = int(os.getenv("LEKTA_POOL_SIZE", "200"))

# The demo account owns real transcripts, so it is what the Q&A scenario uses
# by default — a freshly created account owns nothing and every query would
# short-circuit before reaching Groq, measuring nothing useful.
DEMO_EMAIL = os.getenv("LEKTA_DEMO_EMAIL", "user@example.com")
DEMO_PASSWORD = os.getenv("LEKTA_DEMO_PASSWORD", "password")

# --- Ingest ------------------------------------------------------------------
# Any video/audio file with real speech. Whisper raises if it finds no speech,
# so a generated silent clip is useless as a fixture.
FIXTURE_VIDEO = os.getenv("LEKTA_FIXTURE_VIDEO", "")

# Append random bytes to each upload so its sha256 differs. Without this the
# duplicate-ingest guard in rag/pipeline/ingestion.py recognises the identical
# file and returns the previous transcript instantly — the test would report
# sub-second "transcriptions" that never ran. Trailing bytes after the moov
# atom are ignored by ffmpeg, so the file still decodes.
SALT_UPLOADS = os.getenv("LEKTA_SALT_UPLOADS", "1") == "1"

# How long to wait for a transcription job before calling it a failure.
INGEST_TIMEOUT_S = float(os.getenv("LEKTA_INGEST_TIMEOUT", "900"))
INGEST_POLL_S = float(os.getenv("LEKTA_INGEST_POLL", "2"))


def find_fixture_video() -> Path | None:
    """The configured fixture, or the smallest already-ingested lecture."""
    if FIXTURE_VIDEO:
        p = Path(FIXTURE_VIDEO)
        return p if p.is_file() else None
    media = REPO_ROOT / "rag" / "media"
    clips = sorted(media.glob("*.mp4"), key=lambda p: p.stat().st_size)
    return clips[0] if clips else None


# --- Account pool ------------------------------------------------------------
_counter = itertools.count()
_lock = threading.Lock()


def claim_account() -> tuple[str, str]:
    """Hand out the next (email, password) pair, cycling through the pool."""
    with _lock:
        n = next(_counter) % POOL_SIZE
    return f"{USER_PREFIX}{n}@{USER_DOMAIN}", PASSWORD


def account(n: int) -> tuple[str, str]:
    return f"{USER_PREFIX}{n}@{USER_DOMAIN}", PASSWORD
