"""Locust load tests for Lekta.

Pick ONE user class per run — they stress very different bottlenecks and mixing
them makes the numbers unreadable:

    locust -f loadtest/locustfile.py BrowseUser      --host http://localhost:8000
    locust -f loadtest/locustfile.py LoginStormUser  --host http://localhost:8000
    locust -f loadtest/locustfile.py AskUser         --host http://localhost:8000
    locust -f loadtest/locustfile.py IngestUser      --host http://localhost:8000
    locust -f loadtest/locustfile.py JourneyUser     --host http://localhost:8000

See loadtest/README.md for what each one measures and what a bad result means.

Calls to the RAG service use absolute URLs — Locust passes those through
unchanged, so one client can drive both services and every request still lands
in the statistics table under an explicit `name=`.
"""

from __future__ import annotations

import os
import random
import sys
import time
from pathlib import Path

from locust import HttpUser, between, events, task

# Locust normally puts the locustfile's directory on sys.path; belt and braces
# so `-f loadtest/locustfile.py` works from anywhere.
sys.path.insert(0, str(Path(__file__).resolve().parent))

from config import (  # noqa: E402
    API,
    DEMO_EMAIL,
    DEMO_PASSWORD,
    INGEST_POLL_S,
    INGEST_TIMEOUT_S,
    RAG,
    SALT_UPLOADS,
    claim_account,
    find_fixture_video,
)

QUESTIONS = [
    "What is this lecture about?",
    "Summarise the main points.",
    "What examples does the speaker give?",
    "Explain the first two minutes.",
    "What does the lecturer say at 1:30?",
    "List the key definitions.",
]

_fixture_bytes: bytes | None = None


def fixture_payload() -> bytes:
    """Read the fixture once per worker process, then reuse it in memory."""
    global _fixture_bytes
    if _fixture_bytes is None:
        path = find_fixture_video()
        if path is None:
            raise RuntimeError(
                "No ingest fixture found. Put a video with speech in rag/media/ "
                "or set LEKTA_FIXTURE_VIDEO=/path/to/lecture.mp4"
            )
        _fixture_bytes = path.read_bytes()
        print(f"[loadtest] ingest fixture: {path.name} ({len(_fixture_bytes) / 1048576:.1f} MB)")
    return _fixture_bytes


def fire_job_metric(name: str, seconds: float, error: str | None = None) -> None:
    """Report a multi-request job as a single timing in Locust's stats table."""
    events.request.fire(
        request_type="JOB",
        name=name,
        response_time=seconds * 1000.0,
        response_length=0,
        exception=RuntimeError(error) if error else None,
        context={},
    )


class LektaUser(HttpUser):
    """Base: owns an account, logs in on start, keeps the bearer token."""

    abstract = True
    host = API

    #: Set on subclasses that should share the demo account instead of a
    #: dedicated one (the demo account owns real transcripts).
    use_demo_account = False

    def on_start(self) -> None:
        self.email, self.password = (
            (DEMO_EMAIL, DEMO_PASSWORD) if self.use_demo_account else claim_account()
        )
        self.token: str | None = None
        if not self.login() and not self.use_demo_account:
            # First run against a fresh database: create the account, then the
            # rest of the test measures a real login.
            self.signup()

    # -- auth -----------------------------------------------------------------

    def login(self) -> bool:
        with self.client.post(
            "/api/auth/login",
            json={"email": self.email, "password": self.password},
            name="POST /api/auth/login",
            catch_response=True,
        ) as r:
            if r.status_code == 200:
                self.set_token(r.json()["access_token"])
                return True
            if r.status_code == 401:
                # Expected when the pool has not been seeded — not a failure.
                r.success()
                return False
            r.failure(f"login {r.status_code}: {r.text[:120]}")
            return False

    def signup(self) -> bool:
        with self.client.post(
            "/api/auth/signup",
            json={
                "full_name": f"Load Test {self.email}",
                "email": self.email,
                "password": self.password,
            },
            name="POST /api/auth/signup",
            catch_response=True,
        ) as r:
            if r.status_code == 201:
                self.set_token(r.json()["access_token"])
                return True
            if r.status_code == 409:
                r.success()  # another virtual user got there first
                return self.login()
            r.failure(f"signup {r.status_code}: {r.text[:120]}")
            return False

    def set_token(self, token: str) -> None:
        self.token = token
        self.client.headers["Authorization"] = f"Bearer {token}"


class BrowseUser(LektaUser):
    """Read-only traffic: the shape of users with the app open but idle-ish.

    Cheap per request and database-bound. This is the scenario to push to high
    concurrency when you want to know "how many people can be signed in".
    """

    wait_time = between(1, 4)

    @task(4)
    def my_sessions(self) -> None:
        self.client.get("/api/chats", name="GET /api/chats")

    @task(3)
    def my_library(self) -> None:
        self.client.get("/api/videos", name="GET /api/videos")

    @task(2)
    def whoami(self) -> None:
        self.client.get("/api/auth/me", name="GET /api/auth/me")

    @task(1)
    def open_one_session(self) -> None:
        with self.client.get("/api/chats", name="GET /api/chats", catch_response=True) as r:
            if r.status_code != 200:
                return
            chats = r.json()
        if chats:
            cid = random.choice(chats)["id"]
            self.client.get(f"/api/chats/{cid}", name="GET /api/chats/{id}")


class LoginStormUser(LektaUser):
    """Nothing but authentication — the classic "N users all log in at once".

    This is CPU-bound on bcrypt, not on the database: hashing is cost 12 by
    design (~200-300 ms of pure CPU per call). Expect throughput to flatten at
    roughly (cores / 0.25s) logins per second no matter how many users you add,
    and latency to climb linearly past that. That is correct, intended
    behaviour for a password hash — not a bug to optimise away.
    """

    wait_time = between(0.5, 2)

    def on_start(self) -> None:  # deliberately skip the base auto-login
        self.email, self.password = claim_account()
        self.token = None

    @task
    def log_in_again(self) -> None:
        if not self.login():
            self.signup()


class AskUser(LektaUser):
    """Question answering: embedding + ChromaDB search + a Groq completion.

    Runs as the demo account because it owns real transcripts; a fresh account
    owns nothing and every query would return early without ever calling the
    LLM. Groq's free tier rate-limits well below what Locust can generate, so
    sustained 429s here are the upstream API pushing back, not your app.
    """

    use_demo_account = True
    wait_time = between(2, 6)

    @task
    def ask(self) -> None:
        with self.client.post(
            f"{RAG}/query",
            json={"question": random.choice(QUESTIONS), "search_all": True},
            name="RAG POST /query",
            catch_response=True,
            timeout=120,
        ) as r:
            if r.status_code == 429:
                r.failure("Groq rate limit (429) — upstream, not the app")
            elif r.status_code != 200:
                r.failure(f"query {r.status_code}: {r.text[:120]}")


class IngestUser(LektaUser):
    """Upload a video and wait for transcription — the heaviest path there is.

    KEEP CONCURRENCY LOW (start at 1, then 2, 3...). Whisper is CPU-bound and
    every concurrent job competes for the same cores in the same process, so
    wall-clock per job grows roughly linearly with concurrency while throughput
    stays flat. The useful output is the `JOB ingest end-to-end` row.
    """

    wait_time = between(5, 10)

    @task
    def upload_and_wait(self) -> None:
        if not self.token:
            return

        payload = fixture_payload()
        if SALT_UPLOADS:
            payload = payload + os.urandom(64)

        started = time.monotonic()
        with self.client.post(
            f"{RAG}/ingest",
            files={"file": ("loadtest-lecture.mp4", payload, "video/mp4")},
            data={"title": f"Load test {int(started)}"},
            name="RAG POST /ingest",
            catch_response=True,
            timeout=300,
        ) as r:
            if r.status_code != 200:
                r.failure(f"ingest {r.status_code}: {r.text[:160]}")
                fire_job_metric("ingest end-to-end", time.monotonic() - started, "submit failed")
                return
            job_id = r.json().get("job_id")

        if not job_id:
            fire_job_metric("ingest end-to-end", time.monotonic() - started, "no job_id")
            return

        deadline = started + INGEST_TIMEOUT_S
        while time.monotonic() < deadline:
            time.sleep(INGEST_POLL_S)
            with self.client.get(
                f"{RAG}/ingest/status/{job_id}",
                name="RAG GET /ingest/status/{job}",
                catch_response=True,
            ) as r:
                if r.status_code != 200:
                    r.failure(f"status {r.status_code}")
                    continue
                job = r.json()

            if job["status"] == "completed":
                fire_job_metric("ingest end-to-end", time.monotonic() - started)
                return
            if job["status"] == "failed":
                fire_job_metric(
                    "ingest end-to-end", time.monotonic() - started, job.get("error") or "failed"
                )
                return

        fire_job_metric(
            "ingest end-to-end", time.monotonic() - started, f"timeout after {INGEST_TIMEOUT_S}s"
        )


class JourneyUser(LektaUser):
    """A realistic mix — mostly browsing, some questions, rare uploads.

    Use this for a "does it hold up with N real users" answer. Use the focused
    classes above to find out *why* when it doesn't.
    """

    wait_time = between(3, 8)

    @task(10)
    def browse(self) -> None:
        self.client.get("/api/chats", name="GET /api/chats")
        self.client.get("/api/videos", name="GET /api/videos")

    @task(4)
    def ask(self) -> None:
        with self.client.post(
            f"{RAG}/query",
            json={"question": random.choice(QUESTIONS), "search_all": True},
            name="RAG POST /query",
            catch_response=True,
            timeout=120,
        ) as r:
            if r.status_code not in (200, 429):
                r.failure(f"query {r.status_code}")

    @task(1)
    def save_a_session(self) -> None:
        self.client.post(
            "/api/chats",
            json={
                "title": "Load test session",
                "messages": [
                    {"role": "user", "content": "What is this lecture about?"},
                    {"role": "bot", "content": "A load-test placeholder answer."},
                ],
            },
            name="POST /api/chats",
        )


@events.test_start.add_listener
def _announce(environment, **_kwargs) -> None:
    print(f"[loadtest] backend = {API}")
    print(f"[loadtest] rag     = {RAG}")
    if SALT_UPLOADS:
        print("[loadtest] upload salting ON (defeats the duplicate-ingest guard)")
