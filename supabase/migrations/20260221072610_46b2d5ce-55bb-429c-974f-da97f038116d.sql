
-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Schedule the notification checker every minute
SELECT cron.schedule(
  'send-task-notifications',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := 'https://pmfhygfkzgtsyzbauzeo.supabase.co/functions/v1/send-notifications',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBtZmh5Z2Zremd0c3l6YmF1emVvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk0OTg5NjQsImV4cCI6MjA3NTA3NDk2NH0.eJV6hEkPe2K8UO_3I52Tx9PP36ev1YhdgiIisEZDdok"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
);
