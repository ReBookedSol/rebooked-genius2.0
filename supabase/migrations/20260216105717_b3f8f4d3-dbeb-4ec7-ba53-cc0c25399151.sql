
-- Schedule subscription enforcement to run daily at 2 AM UTC
SELECT cron.schedule(
  'daily-subscription-enforcement',
  '0 2 * * *',
  $$
  SELECT net.http_post(
    url := 'https://rpxmitaveezpinajrutw.supabase.co/functions/v1/subscription-enforcement',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJweG1pdGF2ZWV6cGluYWpydXR3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY5MzkxMDYsImV4cCI6MjA4MjUxNTEwNn0.VgEfuMQotGVHnCYyXKkRHKzOcuSzRShH1edd8rl2vlk"}'::jsonb,
    body := '{"scheduled": true}'::jsonb
  ) AS request_id;
  $$
);
