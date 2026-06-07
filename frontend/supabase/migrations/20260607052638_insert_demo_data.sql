/*
# Insert Demo Data for Testing

This migration inserts sample statistics and alerts for the admin dashboard demonstration.
*/

-- Insert sample statistics for today
INSERT INTO admin_statistics (metric_date, total_users, online_users, daily_active_users, avg_usage_time_minutes, questions_asked, transcripts_generated, transcript_failures)
VALUES (CURRENT_DATE, 1250, 845, 920, 45, 3420, 285, 12)
ON CONFLICT DO NOTHING;

-- Insert sample statistics for yesterday
INSERT INTO admin_statistics (metric_date, total_users, online_users, daily_active_users, avg_usage_time_minutes, questions_asked, transcripts_generated, transcript_failures)
VALUES (CURRENT_DATE - INTERVAL '1 day', 1180, 720, 880, 42, 3200, 280, 8)
ON CONFLICT DO NOTHING;

-- Insert sample alerts
INSERT INTO alerts (alert_type, message, status, created_at)
VALUES 
  ('new_user', 'New user registered: john@example.com', 'unresolved', NOW()),
  ('transcript_failure', 'Failed to generate transcript for video_123', 'unresolved', NOW() - INTERVAL '1 hour'),
  ('system_warning', 'System memory usage above 80%', 'unresolved', NOW() - INTERVAL '2 hours'),
  ('complaint_resolved', 'User complaint #45 has been resolved', 'resolved', NOW() - INTERVAL '3 hours'),
  ('new_user', 'New user registered: jane@example.com', 'unresolved', NOW() - INTERVAL '4 hours')
ON CONFLICT DO NOTHING;
