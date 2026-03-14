
-- Insert encryption keys for message and comment encryption
INSERT INTO public.encryption_keys (key_name, key_value) VALUES 
  ('message_key', md5(random()::text) || md5(random()::text)),
  ('comment_key', md5(random()::text) || md5(random()::text))
ON CONFLICT (key_name) DO NOTHING;

-- Enable pg_cron and pg_net extensions for scheduled tasks
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;
