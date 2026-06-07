/*
# Video Lecture Q&A System — Schema Setup

1. Users Profile Table
   - Links to Supabase auth.users
   - Stores role (admin/user) in profiles table
   - Tracks status and creation

2. Lectures Table
   - System-owned video lectures
   - All authenticated users can read

3. Questions Table
   - User questions tied to lectures
   - User-scoped: each user sees only their own questions
   - Admins see ONLY aggregated counts, never question content

4. Statistics Table
   - Pre-aggregated metrics for admin dashboard
   - Updated periodically via edge functions
   - Admins can read without accessing raw user data

5. Alerts Table
   - System alerts (transcript failures, complaints, etc.)
   - Admins can CRUD alerts

6. Complaints Table
   - Users can file complaints
   - Admins can view and resolve

## Security Model
- RLS enforces: users see only their own data
- Admins see ONLY aggregate statistics + system alerts
- No raw user chat/transcript data exposed to admins
*/

-- Profiles: extend auth.users with role and metadata
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('admin', 'user')),
  status text DEFAULT 'active' CHECK (status IN ('active', 'suspended')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_read_own_profile" ON profiles;
CREATE POLICY "users_read_own_profile" ON profiles FOR SELECT
TO authenticated USING (auth.uid() = id);

DROP POLICY IF EXISTS "admins_read_all_profiles" ON profiles;
CREATE POLICY "admins_read_all_profiles" ON profiles FOR SELECT
TO authenticated USING (role = 'admin');

DROP POLICY IF EXISTS "admins_update_profiles" ON profiles;
CREATE POLICY "admins_update_profiles" ON profiles FOR UPDATE
TO authenticated USING (role = 'admin')
WITH CHECK (role = 'admin');

-- Lectures: system content, readable by all
CREATE TABLE IF NOT EXISTS lectures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  video_url text,
  transcript_url text,
  duration_seconds integer,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE lectures ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anyone_read_lectures" ON lectures;
CREATE POLICY "anyone_read_lectures" ON lectures FOR SELECT
TO authenticated USING (true);

-- Questions: user's personal Q&A (admins don't read content)
CREATE TABLE IF NOT EXISTS questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  lecture_id uuid REFERENCES lectures(id) ON DELETE CASCADE,
  question_text text NOT NULL,
  answer_text text,
  timestamp_seconds integer,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE questions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_read_own_questions" ON questions;
CREATE POLICY "users_read_own_questions" ON questions FOR SELECT
TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "users_insert_questions" ON questions;
CREATE POLICY "users_insert_questions" ON questions FOR INSERT
TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "users_update_own_questions" ON questions;
CREATE POLICY "users_update_own_questions" ON questions FOR UPDATE
TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "users_delete_own_questions" ON questions;
CREATE POLICY "users_delete_own_questions" ON questions FOR DELETE
TO authenticated USING (auth.uid() = user_id);

-- Statistics: aggregated data for admin dashboard
CREATE TABLE IF NOT EXISTS admin_statistics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_date date NOT NULL,
  total_users integer DEFAULT 0,
  online_users integer DEFAULT 0,
  daily_active_users integer DEFAULT 0,
  avg_usage_time_minutes integer DEFAULT 0,
  questions_asked integer DEFAULT 0,
  transcripts_generated integer DEFAULT 0,
  transcript_failures integer DEFAULT 0,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE admin_statistics ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admins_read_statistics" ON admin_statistics;
CREATE POLICY "admins_read_statistics" ON admin_statistics FOR SELECT
TO authenticated USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- Alerts: system events for admin dashboard
CREATE TABLE IF NOT EXISTS alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_type text NOT NULL CHECK (alert_type IN ('new_user', 'transcript_failure', 'system_warning', 'complaint_resolved')),
  message text NOT NULL,
  status text DEFAULT 'unresolved' CHECK (status IN ('unresolved', 'resolved')),
  created_at timestamptz DEFAULT now(),
  resolved_at timestamptz
);

ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admins_read_alerts" ON alerts;
CREATE POLICY "admins_read_alerts" ON alerts FOR SELECT
TO authenticated USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

DROP POLICY IF EXISTS "admins_create_alerts" ON alerts;
CREATE POLICY "admins_create_alerts" ON alerts FOR INSERT
TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

DROP POLICY IF EXISTS "admins_update_alerts" ON alerts;
CREATE POLICY "admins_update_alerts" ON alerts FOR UPDATE
TO authenticated USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'))
WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- Complaints: users file, admins resolve
CREATE TABLE IF NOT EXISTS complaints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  subject text NOT NULL,
  description text NOT NULL,
  status text DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved')),
  created_at timestamptz DEFAULT now(),
  resolved_at timestamptz
);

ALTER TABLE complaints ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_read_own_complaints" ON complaints;
CREATE POLICY "users_read_own_complaints" ON complaints FOR SELECT
TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "users_create_complaints" ON complaints;
CREATE POLICY "users_create_complaints" ON complaints FOR INSERT
TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "admins_read_all_complaints" ON complaints;
CREATE POLICY "admins_read_all_complaints" ON complaints FOR SELECT
TO authenticated USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

DROP POLICY IF EXISTS "admins_update_complaints" ON complaints;
CREATE POLICY "admins_update_complaints" ON complaints FOR UPDATE
TO authenticated USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'))
WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- Indexes for frequently-queried columns
CREATE INDEX IF NOT EXISTS idx_questions_user_id ON questions(user_id);
CREATE INDEX IF NOT EXISTS idx_questions_lecture_id ON questions(lecture_id);
CREATE INDEX IF NOT EXISTS idx_complaints_user_id ON complaints(user_id);
CREATE INDEX IF NOT EXISTS idx_alerts_created_at ON alerts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_statistics_metric_date ON admin_statistics(metric_date DESC);