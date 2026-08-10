"""Configuration for load tests.

Centralises all URLs, credentials, test-user accounts, and YouTube video
URLs so that locustfile.py stays focused on the actual test scenarios.
"""

import os

# ---------------------------------------------------------------------------
# Service URLs
# ---------------------------------------------------------------------------
BACKEND_BASE_URL = os.getenv("BACKEND_BASE_URL", "http://localhost:8000")
RAG_BASE_URL = os.getenv("RAG_BASE_URL", "http://localhost:8100")
API_PREFIX = os.getenv("API_PREFIX", "/api")

# ---------------------------------------------------------------------------
# Admin credentials (must match seed.py in the backend)
# ---------------------------------------------------------------------------
DEFAULT_ADMIN_EMAIL = os.getenv("LOAD_TEST_ADMIN_EMAIL", "admin@example.com")
DEFAULT_ADMIN_PASSWORD = os.getenv("LOAD_TEST_ADMIN_PASSWORD", "password")

# ---------------------------------------------------------------------------
# Test user accounts — created via POST /api/auth/signup during the test.
# Each entry is saved to the `users` table in PostgreSQL.
# ---------------------------------------------------------------------------
TEST_PASSWORD = "TestPass123!"

TEST_USERS = [
    {"full_name": "Load Test User 1", "email": "loadtest_user1@example.com", "password": TEST_PASSWORD},
    {"full_name": "Load Test User 2", "email": "loadtest_user2@example.com", "password": TEST_PASSWORD},
    {"full_name": "Load Test User 3", "email": "loadtest_user3@example.com", "password": TEST_PASSWORD},
    {"full_name": "Load Test User 4", "email": "loadtest_user4@example.com", "password": TEST_PASSWORD},
    {"full_name": "Load Test User 5", "email": "loadtest_user5@example.com", "password": TEST_PASSWORD},
]

# ---------------------------------------------------------------------------
# YouTube video URLs for testing — used to create video records in the
# `videos` table and to trigger RAG ingestion via POST /ingest/url.
# Tracking params (&t=, &list=, &index=) are stripped; not needed for ingest.
# ---------------------------------------------------------------------------
TEST_YOUTUBE_VIDEOS = [
    {
        "url": "https://www.youtube.com/watch?v=T-D1OfcDW1M",
        "title": "YouTube Lecture - T-D1OfcDW1M",
        "subject": "python",
    },
    {
        "url": "https://www.youtube.com/watch?v=UabBYexBD4k",
        "title": "YouTube Lecture - UabBYexBD4k",
        "subject": "ml",
    },
    {
        "url": "https://www.youtube.com/watch?v=3s0lFtUrhSQ",
        "title": "YouTube Lecture - 3s0lFtUrhSQ",
        "subject": "rag",
    },
    {
        "url": "https://www.youtube.com/watch?v=icMq3yMPI5s",
        "title": "YouTube Lecture - icMq3yMPI5s",
        "subject": "java",
    },
    {
        "url": "https://www.youtube.com/watch?v=DS4wKW_2AOQ",
        "title": "YouTube Lecture - DS4wKW_2AOQ",
        "subject": "c",
    },
]

# ---------------------------------------------------------------------------
# Sample questions for RAG query testing
# ---------------------------------------------------------------------------
RAG_TEST_QUESTIONS = [
    "Summarize this lecture in one paragraph",
    "What are the key concepts discussed?",
    "Explain the main topic of this video",
    "What examples were given in the lecture?",
    "What is the conclusion of the lecture?",
]

# ---------------------------------------------------------------------------
# Sample complaint data for testing
# ---------------------------------------------------------------------------
TEST_COMPLAINTS = [
    {
        "title": "Video playback not working",
        "category": "bug",
        "priority": "high",
        "description": "The video player fails to load after clicking play on lecture videos.",
    },
    {
        "title": "Transcript accuracy issue",
        "category": "quality",
        "priority": "medium",
        "description": "The generated transcript has many incorrect words in the first 5 minutes.",
    },
    {
        "title": "Slow loading times",
        "category": "performance",
        "priority": "low",
        "description": "Pages take more than 10 seconds to load during peak hours.",
    },
    {
        "title": "Feature request: dark mode",
        "category": "feature",
        "priority": "low",
        "description": "Would be great to have a dark mode option for the entire platform.",
    },
    {
        "title": "Cannot download transcript",
        "category": "bug",
        "priority": "medium",
        "description": "The download transcript button returns a 500 error for certain videos.",
    },
]
