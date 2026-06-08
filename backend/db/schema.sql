-- ============================================================================
-- Video Lecture Transcript Q&A — PostgreSQL schema (reference)
--
-- The FastAPI backend auto-creates these tables on startup via SQLAlchemy
-- (Base.metadata.create_all). This file documents the equivalent raw SQL and
-- can be used to provision the database manually if preferred.
--
-- Database: video_lecture_transcript
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ---------------------------------------------------------------------------
-- users : login + account details (a row is created on every signup)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name       VARCHAR(255) NOT NULL,
    email           VARCHAR(255) NOT NULL UNIQUE,
    hashed_password VARCHAR(255) NOT NULL,
    role            VARCHAR(20)  NOT NULL DEFAULT 'user',     -- admin | user
    status          VARCHAR(20)  NOT NULL DEFAULT 'active',   -- active | inactive | blocked
    auth_provider   VARCHAR(20)  NOT NULL DEFAULT 'local',    -- local | google
    avatar_url      VARCHAR(512),
    usage_minutes   INTEGER      NOT NULL DEFAULT 0,
    last_login      TIMESTAMPTZ,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- ---------------------------------------------------------------------------
-- chat_sessions / chat_messages : user "New Chat" + "Recent" history
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS chat_sessions (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title       VARCHAR(255) DEFAULT 'New chat',
    video_name  VARCHAR(512),
    step        INTEGER DEFAULT 0,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_user_id ON chat_sessions(user_id);

CREATE TABLE IF NOT EXISTS chat_messages (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id  UUID NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
    role        VARCHAR(20) NOT NULL,   -- user | bot
    content     TEXT NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_chat_messages_session_id ON chat_messages(session_id);

-- ---------------------------------------------------------------------------
-- videos : library content uploaded by a user
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS videos (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title            VARCHAR(512) NOT NULL,
    subject          VARCHAR(100),    -- python | c | java | ml | rag
    description      TEXT,
    thumbnail_url    VARCHAR(512),
    duration_seconds INTEGER DEFAULT 0,
    size_mb          INTEGER DEFAULT 0,
    status           VARCHAR(20) DEFAULT 'processing', -- processed | processing | failed
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_accessed    TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_videos_user_id ON videos(user_id);

-- ---------------------------------------------------------------------------
-- complaints : raised by users, managed by admins
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS complaints (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id      VARCHAR(30) NOT NULL UNIQUE,
    user_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title          VARCHAR(255) NOT NULL,
    category       VARCHAR(50) DEFAULT 'other',
    priority       VARCHAR(20) DEFAULT 'low',  -- low | medium | high
    description    TEXT NOT NULL,
    screenshot_url VARCHAR(512),
    status         VARCHAR(20) DEFAULT 'open', -- open | in_progress | resolved
    admin_response TEXT,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    resolved_at    TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_complaints_user_id ON complaints(user_id);

-- ---------------------------------------------------------------------------
-- alerts : system / complaint / security events for the admin dashboard
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS alerts (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    alert_code  VARCHAR(30) NOT NULL UNIQUE,
    alert_type  VARCHAR(50) NOT NULL,   -- complaint | system | security
    user_id     UUID REFERENCES users(id) ON DELETE SET NULL,
    user_name   VARCHAR(255),
    message     TEXT NOT NULL,
    priority    VARCHAR(20) DEFAULT 'low',
    status      VARCHAR(20) DEFAULT 'open', -- open | in_progress | resolved
    admin_notes TEXT,
    is_read     BOOLEAN DEFAULT FALSE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    resolved_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_alerts_created_at ON alerts(created_at DESC);
