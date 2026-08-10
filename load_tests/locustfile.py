"""Locust load-test scenarios for the Video Lecture Transcript Q&A platform.

All scenarios exercise the real API endpoints and persist data to PostgreSQL:
  - Users are created via POST /api/auth/signup → saved in `users` table
  - Videos are created via POST /api/videos → saved in `videos` table
  - YouTube URLs are ingested via POST /ingest/url on the RAG service
  - Chat sessions and messages → saved in `chat_sessions` and `chat_messages`
  - Complaints → saved in `complaints` + auto-generated `alerts`

Run:
    locust -f load_tests/locustfile.py --host http://localhost:8000 \
           --users 10 --spawn-rate 2 --run-time 1m
"""

import random
import uuid
import logging

from locust import HttpUser, between, task, events

from load_tests.config import (
    API_PREFIX,
    BACKEND_BASE_URL,
    DEFAULT_ADMIN_EMAIL,
    DEFAULT_ADMIN_PASSWORD,
    RAG_BASE_URL,
    RAG_TEST_QUESTIONS,
    TEST_COMPLAINTS,
    TEST_PASSWORD,
    TEST_USERS,
    TEST_YOUTUBE_VIDEOS,
)

logger = logging.getLogger("load_tests")


# ── helpers ──────────────────────────────────────────────────────────────────

def _auth_header(token: str | None) -> dict:
    """Return an Authorization header dict, or empty dict if no token."""
    if token:
        return {"Authorization": f"Bearer {token}"}
    return {}


def _signup_or_login(client, user_info: dict, api_prefix: str) -> str | None:
    """Try to sign up a user; if email already exists (409), log in instead.

    Returns the access_token on success, or None on failure.
    The user account is saved to the `users` table in PostgreSQL.
    """
    # Try signup first — creates the account in DB
    signup_payload = {
        "full_name": user_info["full_name"],
        "email": user_info["email"],
        "password": user_info["password"],
    }
    with client.post(
        f"{api_prefix}/auth/signup",
        json=signup_payload,
        catch_response=True,
        name="auth/signup",
    ) as resp:
        if resp.status_code == 201:
            token = resp.json().get("access_token")
            resp.success()
            logger.info("Signed up user: %s", user_info["email"])
            return token
        elif resp.status_code == 409:
            # Already exists — fall through to login
            resp.success()  # Not a test failure
        else:
            resp.failure(f"Signup failed: {resp.status_code} {resp.text}")

    # Login with existing account
    login_payload = {"email": user_info["email"], "password": user_info["password"]}
    with client.post(
        f"{api_prefix}/auth/login",
        json=login_payload,
        catch_response=True,
        name="auth/login",
    ) as resp:
        if resp.status_code == 200:
            token = resp.json().get("access_token")
            resp.success()
            return token
        else:
            resp.failure(f"Login failed: {resp.status_code} {resp.text}")
            return None


# ═══════════════════════════════════════════════════════════════════════════
# Scenario 1: Signup & Auth — creates user accounts in the DB
# ═══════════════════════════════════════════════════════════════════════════

class SignupUser(HttpUser):
    """Simulates user signup and authentication flows.

    Creates user accounts in the `users` table via POST /api/auth/signup,
    then exercises login and profile endpoints.
    """

    wait_time = between(1, 3)
    host = BACKEND_BASE_URL
    weight = 2

    def on_start(self) -> None:
        self.client.headers.update({"Content-Type": "application/json"})
        self.user_info = random.choice(TEST_USERS)
        self.token = _signup_or_login(self.client, self.user_info, API_PREFIX)

    @task(3)
    def login_flow(self) -> None:
        """Re-login — tests the POST /api/auth/login endpoint."""
        payload = {"email": self.user_info["email"], "password": self.user_info["password"]}
        with self.client.post(
            f"{API_PREFIX}/auth/login",
            json=payload,
            catch_response=True,
            name="auth/login",
        ) as resp:
            if resp.status_code == 200:
                self.token = resp.json().get("access_token")
                resp.success()
            else:
                resp.failure(f"Login failed: {resp.status_code}")

    @task(2)
    def get_profile(self) -> None:
        """GET /api/auth/me — verifies the JWT token is valid."""
        if not self.token:
            self._try_login()
            return
        with self.client.get(
            f"{API_PREFIX}/auth/me",
            headers=_auth_header(self.token),
            catch_response=True,
            name="auth/me",
        ) as resp:
            if resp.status_code == 200:
                resp.success()
            elif resp.status_code == 401:
                resp.failure("Token expired or invalid")
                self.token = _signup_or_login(self.client, self.user_info, API_PREFIX)
            else:
                resp.failure(f"GET /auth/me failed: {resp.status_code}")

    def _try_login(self) -> None:
        self.token = _signup_or_login(self.client, self.user_info, API_PREFIX)


# ═══════════════════════════════════════════════════════════════════════════
# Scenario 2: Video Library + YouTube Ingestion — saves videos in DB
# ═══════════════════════════════════════════════════════════════════════════

class VideoUser(HttpUser):
    """Simulates video library operations and YouTube URL ingestion.

    Creates video records in the `videos` table via POST /api/videos,
    then posts YouTube URLs to the RAG service for transcript ingestion.
    """

    wait_time = between(2, 5)
    host = BACKEND_BASE_URL
    weight = 3

    def on_start(self) -> None:
        self.client.headers.update({"Content-Type": "application/json"})
        self.user_info = random.choice(TEST_USERS)
        self.token = _signup_or_login(self.client, self.user_info, API_PREFIX)
        self.created_video_ids: list[str] = []
        self.active_ingest_jobs: list[str] = []

    def _ensure_token(self) -> bool:
        if not self.token:
            self.token = _signup_or_login(self.client, self.user_info, API_PREFIX)
        return self.token is not None

    @task(3)
    def post_video(self) -> None:
        """POST /api/videos — creates a video record in the DB.

        Uses metadata from the configured YouTube test videos.
        """
        if not self._ensure_token():
            return
        video_info = random.choice(TEST_YOUTUBE_VIDEOS)
        payload = {
            "title": video_info["title"],
            "subject": video_info["subject"],
            "description": f"Load test video from {video_info['url']}",
            "thumbnail_url": f"https://img.youtube.com/vi/{video_info['url'].split('v=')[1]}/0.jpg",
            "duration_seconds": random.randint(300, 3600),
            "size_mb": random.randint(50, 500),
            "status": "processing",
        }
        with self.client.post(
            f"{API_PREFIX}/videos",
            json=payload,
            headers=_auth_header(self.token),
            catch_response=True,
            name="videos/create",
        ) as resp:
            if resp.status_code == 201:
                video_id = resp.json().get("id")
                if video_id:
                    self.created_video_ids.append(video_id)
                resp.success()
            else:
                resp.failure(f"Create video failed: {resp.status_code}")

    @task(2)
    def ingest_youtube_url(self) -> None:
        """POST /ingest/url on the RAG service — triggers YouTube download & transcript ingestion.

        Sends the JWT token so the RAG service can scope the transcript to this user.
        """
        if not self._ensure_token():
            return
        video_info = random.choice(TEST_YOUTUBE_VIDEOS)
        video_id = self.created_video_ids[-1] if self.created_video_ids else None
        payload = {
            "url": video_info["url"],
            "title": video_info["title"],
        }
        if video_id:
            payload["video_id"] = video_id

        with self.client.post(
            f"{RAG_BASE_URL}/ingest/url",
            json=payload,
            headers=_auth_header(self.token),
            catch_response=True,
            name="rag/ingest-url",
        ) as resp:
            if resp.status_code == 200:
                job_id = resp.json().get("job_id")
                if job_id:
                    self.active_ingest_jobs.append(job_id)
                resp.success()
            else:
                resp.failure(f"Ingest URL failed: {resp.status_code}")

    @task(2)
    def check_ingest_status(self) -> None:
        """GET /ingest/status/{job_id} — polls a real ingestion job."""
        if not self.active_ingest_jobs:
            return
        job_id = random.choice(self.active_ingest_jobs)
        with self.client.get(
            f"{RAG_BASE_URL}/ingest/status/{job_id}",
            catch_response=True,
            name="rag/ingest-status",
        ) as resp:
            if resp.status_code == 200:
                data = resp.json()
                status = data.get("status")
                if status in ("complete", "failed"):
                    # Job is done, remove from active list
                    if job_id in self.active_ingest_jobs:
                        self.active_ingest_jobs.remove(job_id)
                resp.success()
            elif resp.status_code == 404:
                # Job expired from progress store
                if job_id in self.active_ingest_jobs:
                    self.active_ingest_jobs.remove(job_id)
                resp.success()  # Not a test failure
            else:
                resp.failure(f"Ingest status failed: {resp.status_code}")

    @task(3)
    def list_videos(self) -> None:
        """GET /api/videos — lists user's videos from the DB."""
        if not self._ensure_token():
            return
        with self.client.get(
            f"{API_PREFIX}/videos",
            headers=_auth_header(self.token),
            catch_response=True,
            name="videos/list",
        ) as resp:
            if resp.status_code == 200:
                # Capture any video IDs for access-marking
                videos = resp.json()
                for v in videos:
                    vid = v.get("id")
                    if vid and vid not in self.created_video_ids:
                        self.created_video_ids.append(vid)
                resp.success()
            else:
                resp.failure(f"List videos failed: {resp.status_code}")

    @task(1)
    def access_video(self) -> None:
        """POST /api/videos/{id}/access — marks a video as accessed."""
        if not self._ensure_token() or not self.created_video_ids:
            return
        video_id = random.choice(self.created_video_ids)
        with self.client.post(
            f"{API_PREFIX}/videos/{video_id}/access",
            headers=_auth_header(self.token),
            catch_response=True,
            name="videos/access",
        ) as resp:
            if resp.status_code == 200:
                resp.success()
            elif resp.status_code == 404:
                # Video may have been deleted
                if video_id in self.created_video_ids:
                    self.created_video_ids.remove(video_id)
                resp.success()
            else:
                resp.failure(f"Access video failed: {resp.status_code}")


# ═══════════════════════════════════════════════════════════════════════════
# Scenario 3: Chat Sessions — saves chats & messages in DB
# ═══════════════════════════════════════════════════════════════════════════

class ChatUser(HttpUser):
    """Simulates chat session flows.

    Creates chat sessions linked to videos in `chat_sessions` table
    with messages in `chat_messages` table, and queries the RAG service.
    """

    wait_time = between(2, 5)
    host = BACKEND_BASE_URL
    weight = 2

    def on_start(self) -> None:
        self.client.headers.update({"Content-Type": "application/json"})
        self.user_info = random.choice(TEST_USERS)
        self.token = _signup_or_login(self.client, self.user_info, API_PREFIX)
        self.chat_ids: list[str] = []
        self.video_ids: list[str] = []

        # Fetch existing videos for this user to link chats to
        if self.token:
            resp = self.client.get(
                f"{API_PREFIX}/videos",
                headers=_auth_header(self.token),
                name="videos/list",
            )
            if resp.status_code == 200:
                for v in resp.json():
                    self.video_ids.append(v["id"])

    def _ensure_token(self) -> bool:
        if not self.token:
            self.token = _signup_or_login(self.client, self.user_info, API_PREFIX)
        return self.token is not None

    @task(3)
    def create_chat(self) -> None:
        """POST /api/chats — creates a chat session with initial messages in the DB."""
        if not self._ensure_token():
            return
        video_info = random.choice(TEST_YOUTUBE_VIDEOS)
        payload = {
            "title": f"Chat about {video_info['title']}",
            "video_name": video_info["title"],
            "video_id": random.choice(self.video_ids) if self.video_ids else None,
            "step": 0,
            "messages": [
                {"role": "user", "content": random.choice(RAG_TEST_QUESTIONS)},
                {"role": "bot", "content": "Let me analyze that for you..."},
            ],
        }
        with self.client.post(
            f"{API_PREFIX}/chats",
            json=payload,
            headers=_auth_header(self.token),
            catch_response=True,
            name="chats/create",
        ) as resp:
            if resp.status_code == 201:
                chat_id = resp.json().get("id")
                if chat_id:
                    self.chat_ids.append(chat_id)
                resp.success()
            else:
                resp.failure(f"Create chat failed: {resp.status_code}")

    @task(2)
    def list_chats(self) -> None:
        """GET /api/chats — lists user's chat sessions."""
        if not self._ensure_token():
            return
        with self.client.get(
            f"{API_PREFIX}/chats",
            headers=_auth_header(self.token),
            catch_response=True,
            name="chats/list",
        ) as resp:
            if resp.status_code == 200:
                for chat in resp.json():
                    cid = chat.get("id")
                    if cid and cid not in self.chat_ids:
                        self.chat_ids.append(cid)
                resp.success()
            else:
                resp.failure(f"List chats failed: {resp.status_code}")

    @task(2)
    def query_rag(self) -> None:
        """POST /query on the RAG service — asks a question about lecture content."""
        if not self._ensure_token():
            return
        payload = {
            "question": random.choice(RAG_TEST_QUESTIONS),
            "search_all": True,
        }
        with self.client.post(
            f"{RAG_BASE_URL}/query",
            json=payload,
            headers=_auth_header(self.token),
            catch_response=True,
            name="rag/query",
        ) as resp:
            if resp.status_code == 200:
                resp.success()
            else:
                resp.failure(f"RAG query failed: {resp.status_code}")

    @task(1)
    def update_chat(self) -> None:
        """PUT /api/chats/{id} — adds new messages to an existing chat."""
        if not self._ensure_token() or not self.chat_ids:
            return
        chat_id = random.choice(self.chat_ids)
        payload = {
            "title": f"Updated chat {uuid.uuid4().hex[:6]}",
            "step": random.randint(1, 5),
            "messages": [
                {"role": "user", "content": random.choice(RAG_TEST_QUESTIONS)},
                {"role": "bot", "content": "Based on the lecture content, here is my analysis..."},
                {"role": "user", "content": "Can you elaborate on that?"},
                {"role": "bot", "content": "Certainly! The key points are..."},
            ],
        }
        with self.client.put(
            f"{API_PREFIX}/chats/{chat_id}",
            json=payload,
            headers=_auth_header(self.token),
            catch_response=True,
            name="chats/update",
        ) as resp:
            if resp.status_code == 200:
                resp.success()
            elif resp.status_code == 404:
                if chat_id in self.chat_ids:
                    self.chat_ids.remove(chat_id)
                resp.success()
            else:
                resp.failure(f"Update chat failed: {resp.status_code}")


# ═══════════════════════════════════════════════════════════════════════════
# Scenario 4: Complaints — saves complaints + auto-generated alerts in DB
# ═══════════════════════════════════════════════════════════════════════════

class ComplaintUser(HttpUser):
    """Simulates complaint submission flows.

    Creates complaints in the `complaints` table (which auto-generates
    alert rows in the `alerts` table).
    """

    wait_time = between(3, 6)
    host = BACKEND_BASE_URL
    weight = 1

    def on_start(self) -> None:
        self.client.headers.update({"Content-Type": "application/json"})
        self.user_info = random.choice(TEST_USERS)
        self.token = _signup_or_login(self.client, self.user_info, API_PREFIX)

    def _ensure_token(self) -> bool:
        if not self.token:
            self.token = _signup_or_login(self.client, self.user_info, API_PREFIX)
        return self.token is not None

    @task(2)
    def submit_complaint(self) -> None:
        """POST /api/complaints — creates a complaint (and auto-alert) in the DB."""
        if not self._ensure_token():
            return
        complaint = random.choice(TEST_COMPLAINTS)
        payload = {
            "title": f"{complaint['title']} [{uuid.uuid4().hex[:6]}]",
            "category": complaint["category"],
            "priority": complaint["priority"],
            "description": complaint["description"],
        }
        with self.client.post(
            f"{API_PREFIX}/complaints",
            json=payload,
            headers=_auth_header(self.token),
            catch_response=True,
            name="complaints/create",
        ) as resp:
            if resp.status_code == 201:
                resp.success()
            else:
                resp.failure(f"Create complaint failed: {resp.status_code}")

    @task(3)
    def list_complaints(self) -> None:
        """GET /api/complaints — lists user's own complaints."""
        if not self._ensure_token():
            return
        with self.client.get(
            f"{API_PREFIX}/complaints",
            headers=_auth_header(self.token),
            catch_response=True,
            name="complaints/list",
        ) as resp:
            if resp.status_code == 200:
                resp.success()
            else:
                resp.failure(f"List complaints failed: {resp.status_code}")


# ═══════════════════════════════════════════════════════════════════════════
# Scenario 5: Admin — reads users, alerts, analytics from DB
# ═══════════════════════════════════════════════════════════════════════════

class AdminUser(HttpUser):
    """Simulates admin dashboard operations.

    Logs in with the seeded admin account and reads aggregate data that
    reflects all test data created by the other scenarios.
    """

    wait_time = between(3, 6)
    host = BACKEND_BASE_URL
    weight = 1

    def on_start(self) -> None:
        self.client.headers.update({"Content-Type": "application/json"})
        self.token = None
        self._login()

    def _login(self) -> None:
        """Login as admin — the account is created by seed.py on backend startup."""
        payload = {"email": DEFAULT_ADMIN_EMAIL, "password": DEFAULT_ADMIN_PASSWORD}
        with self.client.post(
            f"{API_PREFIX}/auth/login",
            json=payload,
            catch_response=True,
            name="auth/login",
        ) as resp:
            if resp.status_code == 200:
                self.token = resp.json().get("access_token")
                resp.success()
            else:
                resp.failure(f"Admin login failed: {resp.status_code} — "
                             f"ensure the backend is running with SEED_DEMO_DATA=true")

    def _ensure_token(self) -> bool:
        if not self.token:
            self._login()
        return self.token is not None

    @task(2)
    def list_users(self) -> None:
        """GET /api/users — admin sees all user accounts."""
        if not self._ensure_token():
            return
        with self.client.get(
            f"{API_PREFIX}/users",
            headers=_auth_header(self.token),
            catch_response=True,
            name="admin/users",
        ) as resp:
            if resp.status_code == 200:
                resp.success()
            elif resp.status_code == 401:
                resp.failure("Admin token expired")
                self._login()
            else:
                resp.failure(f"List users failed: {resp.status_code}")

    @task(2)
    def list_alerts(self) -> None:
        """GET /api/alerts — admin sees all alerts."""
        if not self._ensure_token():
            return
        with self.client.get(
            f"{API_PREFIX}/alerts",
            headers=_auth_header(self.token),
            catch_response=True,
            name="admin/alerts",
        ) as resp:
            if resp.status_code == 200:
                resp.success()
            elif resp.status_code == 401:
                resp.failure("Admin token expired")
                self._login()
            else:
                resp.failure(f"List alerts failed: {resp.status_code}")

    @task(1)
    def analytics_summary(self) -> None:
        """GET /api/analytics/summary — dashboard aggregate counts."""
        if not self._ensure_token():
            return
        with self.client.get(
            f"{API_PREFIX}/analytics/summary",
            headers=_auth_header(self.token),
            catch_response=True,
            name="admin/analytics",
        ) as resp:
            if resp.status_code == 200:
                resp.success()
            elif resp.status_code == 401:
                resp.failure("Admin token expired")
                self._login()
            else:
                resp.failure(f"Analytics failed: {resp.status_code}")

    @task(1)
    def list_all_complaints(self) -> None:
        """GET /api/complaints — admin sees all complaints."""
        if not self._ensure_token():
            return
        with self.client.get(
            f"{API_PREFIX}/complaints",
            headers=_auth_header(self.token),
            catch_response=True,
            name="admin/complaints",
        ) as resp:
            if resp.status_code == 200:
                resp.success()
            elif resp.status_code == 401:
                resp.failure("Admin token expired")
                self._login()
            else:
                resp.failure(f"List complaints failed: {resp.status_code}")
