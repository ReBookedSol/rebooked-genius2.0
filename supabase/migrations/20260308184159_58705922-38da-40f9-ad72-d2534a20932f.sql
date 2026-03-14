
-- Add columns for proper Paystack subscription management
ALTER TABLE public.subscriptions 
  ADD COLUMN IF NOT EXISTS paystack_email_token TEXT,
  ADD COLUMN IF NOT EXISTS paystack_plan_code TEXT;
