# Video Lecture Transcript Q&A — Backend (FastAPI + PostgreSQL)

REST API that powers the Ask Ora frontend. It handles authentication (login
details are stored on signup), chat history, the video library, complaints,
admin alerts and analytics.

## Tech stack

- **FastAPI** — web framework
- **SQLAlchemy 2** — ORM (tables auto-created on startup)
- **PostgreSQL 18** — database `video_lecture_transcript`
- **JWT (python-jose)** + **bcrypt (passlib)** — auth & password hashing

## Prerequisites

- Python 3.10+
- PostgreSQL 18 running locally on port 5432

## Configuration

Settings are read from `backend/.env` (already created for your machine):

```
POSTGRES_SERVER=localhost
POSTGRES_PORT=5432
POSTGRES_USER=postgres
POSTGRES_PASSWORD=Manojkumar@c1
POSTGRES_DB=video_lecture_transcript
SECRET_KEY=...
BACKEND_CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
SEED_DEMO_DATA=true
```

## Setup & run (Windows PowerShell)

```powershell
cd backend

# 1. Create and activate a virtual environment
python -m venv .venv
.\.venv\Scripts\Activate.ps1

# 2. Install dependencies
pip install -r requirements.txt

# 3. Create the database (uses credentials from .env)
python create_db.py

# 4. Start the API (tables are auto-created + demo accounts seeded on startup)
uvicorn app.main:app --reload --port 8000
```

API docs: http://localhost:8000/docs

## Seeded demo accounts

| Role  | Email               | Password   |
|-------|---------------------|------------|
| Admin | admin@example.com   | password   |
| User  | user@example.com    | password   |

New users created from the Sign Up page are stored in the `users` table with a
bcrypt-hashed password.

## Database tables

| Table           | Purpose                                            |
|-----------------|----------------------------------------------------|
| `users`         | Login + account details (created on signup)        |
| `chat_sessions` | A user's "New Chat" sessions / "Recent" history    |
| `chat_messages` | Messages belonging to a chat session               |
| `videos`        | Library videos uploaded by a user                  |
| `complaints`    | Complaints raised by users, resolved by admins     |
| `alerts`        | System / complaint / security alerts for admins    |

Raw SQL for these tables is documented in `db/schema.sql`.

## Key endpoints (prefix: `/api`)

### Auth
- `POST /api/auth/signup` — create account (stores login details)
- `POST /api/auth/login` — JSON login, returns JWT + user
- `GET  /api/auth/me` — current user

### Users (admin)
- `GET    /api/users` — list (search + status filter)
- `GET    /api/users/{id}`
- `PATCH  /api/users/{id}/status` — block / unblock
- `PATCH  /api/users/me` — update own profile
- `DELETE /api/users/{id}`

### Chats
- `GET/POST /api/chats`, `GET/PUT/DELETE /api/chats/{id}`

### Videos
- `GET/POST /api/videos`, `PATCH/DELETE /api/videos/{id}`, `POST /api/videos/{id}/access`

### Complaints
- `GET/POST /api/complaints`, `GET /api/complaints/{id}`, `PATCH/DELETE /api/complaints/{id}` (admin)

### Alerts (admin)
- `GET/POST /api/alerts`, `PATCH/DELETE /api/alerts/{id}`

### Analytics (admin)
- `GET /api/analytics/summary`

## Frontend connection

The frontend reads `VITE_API_URL` (see `frontend/.env`, default
`http://localhost:8000/api`). Start the backend first, then run the frontend
(`npm run dev`). Login/signup now persist to PostgreSQL.
