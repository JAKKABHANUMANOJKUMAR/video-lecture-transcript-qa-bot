# Load Testing with Locust

This folder contains a **Locust-based load-testing harness** for the Video Lecture Transcript Q&A platform. All test scenarios exercise the real API endpoints and **persist data to PostgreSQL** — users, videos, chats, messages, complaints, and alerts are all saved to the database.

## Prerequisites

1. **Backend running** on `http://localhost:8000` with `SEED_DEMO_DATA=true` (creates the admin account)
2. **RAG service running** on `http://localhost:8100` (for YouTube ingestion and Q&A queries)
3. **PostgreSQL** running and accessible
4. **Locust** installed:

```bash
pip install locust
```

## Quick Start

Run from the **project root directory**:

```bash
locust -f load_tests/locustfile.py --host http://localhost:8000 --users 10 --spawn-rate 2 --run-time 1m
```

Then open the **Locust web UI** at `http://localhost:8089`.

### Headless mode (no UI):

```bash
locust -f load_tests/locustfile.py --headless --host http://localhost:8000 --users 10 --spawn-rate 2 --run-time 1m
```

## Test Scenarios

### 1. SignupUser (weight: 2)
Creates user accounts via `POST /api/auth/signup` → saved in `users` table.
- Signup/login flow
- Profile retrieval (`GET /api/auth/me`)

### 2. VideoUser (weight: 3)
Creates video records and triggers YouTube ingestion.
- `POST /api/videos` — saves to `videos` table
- `POST /ingest/url` (RAG) — ingests YouTube video for transcription
- `GET /ingest/status/{job_id}` — polls ingestion progress
- `GET /api/videos` — lists user's videos
- `POST /api/videos/{id}/access` — marks video as accessed

### 3. ChatUser (weight: 2)
Creates chat sessions with messages.
- `POST /api/chats` — saved to `chat_sessions` + `chat_messages` tables
- `GET /api/chats` — lists chat sessions
- `POST /query` (RAG) — asks questions about lecture content
- `PUT /api/chats/{id}` — updates chat with new messages

### 4. ComplaintUser (weight: 1)
Submits complaints (auto-generates alerts).
- `POST /api/complaints` — saved to `complaints` table + creates `alerts` row
- `GET /api/complaints` — lists user's complaints

### 5. AdminUser (weight: 1)
Admin dashboard operations (read-only).
- `GET /api/users` — lists all user accounts
- `GET /api/alerts` — lists all alerts
- `GET /api/analytics/summary` — dashboard statistics
- `GET /api/complaints` — lists all complaints

## Test User Accounts

These accounts are created automatically during the test via the signup API:

| Email | Password | Full Name |
|-------|----------|-----------|
| loadtest_user1@example.com | TestPass123! | Load Test User 1 |
| loadtest_user2@example.com | TestPass123! | Load Test User 2 |
| loadtest_user3@example.com | TestPass123! | Load Test User 3 |
| loadtest_user4@example.com | TestPass123! | Load Test User 4 |
| loadtest_user5@example.com | TestPass123! | Load Test User 5 |

Admin account (created by backend seed): `admin@example.com` / `password`

## YouTube Test Videos

| # | URL |
|---|-----|
| 1 | https://www.youtube.com/watch?v=T-D1OfcDW1M |
| 2 | https://www.youtube.com/watch?v=UabBYexBD4k |
| 3 | https://www.youtube.com/watch?v=3s0lFtUrhSQ |
| 4 | https://www.youtube.com/watch?v=icMq3yMPI5s |
| 5 | https://www.youtube.com/watch?v=DS4wKW_2AOQ |

## Data Persisted to Database

After a test run, the following tables will contain test data:

| Table | What's Created |
|-------|---------------|
| `users` | 5 load-test user accounts (reused across runs) |
| `videos` | Video records with YouTube metadata |
| `chat_sessions` | Chat sessions linked to videos |
| `chat_messages` | Messages within chat sessions |
| `complaints` | Test complaints from users |
| `alerts` | Auto-generated alerts from complaints |

## Generating Reports

```bash
locust -f load_tests/locustfile.py --host http://localhost:8000 \
       --users 50 --spawn-rate 5 --run-time 5m \
       --html load_tests/reports/report.html
```

## Configuration

Override defaults with environment variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `BACKEND_BASE_URL` | `http://localhost:8000` | Backend API URL |
| `RAG_BASE_URL` | `http://localhost:8100` | RAG service URL |
| `API_PREFIX` | `/api` | API route prefix |
| `LOAD_TEST_ADMIN_EMAIL` | `admin@example.com` | Admin email |
| `LOAD_TEST_ADMIN_PASSWORD` | `password` | Admin password |
