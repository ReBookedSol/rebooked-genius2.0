-- Create subscription_plans table to track plan configurations
CREATE TABLE IF NOT EXISTS public.subscription_plans (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  paystack_plan_code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  amount INTEGER NOT NULL, -- Amount in kobo/cents
  currency TEXT NOT NULL DEFAULT 'ZAR',
  interval TEXT NOT NULL DEFAULT 'monthly', -- monthly, quarterly, semi-annually, annually
  tier subscription_tier NOT NULL UNIQUE, -- free, tier1, tier2
  send_invoices BOOLEAN DEFAULT true,
  send_sms BOOLEAN DEFAULT false,
  hosted_invoice_url TEXT,
  invoice_limit INTEGER,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(paystack_plan_code)
);

-- Enable RLS on subscription_plans
ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;

-- RLS policy - anyone can view plans
CREATE POLICY "Anyone can view subscription plans"
  ON public.subscription_plans FOR SELECT
  USING (true);

-- Add new columns to subscriptions table if they don't exist
ALTER TABLE public.subscriptions 
ADD COLUMN IF NOT EXISTS next_billing_date TIMESTAMP WITH TIME ZONE;

ALTER TABLE public.subscriptions 
ADD COLUMN IF NOT EXISTS quantity INTEGER DEFAULT 1;

ALTER TABLE public.subscriptions
ADD COLUMN IF NOT EXISTS metadata JSONB;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_subscriptions_paystack_subscription_code 
ON public.subscriptions(paystack_subscription_code);

CREATE INDEX IF NOT EXISTS idx_subscriptions_paystack_customer_code 
ON public.subscriptions(paystack_customer_code);

CREATE INDEX IF NOT EXISTS idx_subscriptions_status 
ON public.subscriptions(status);

CREATE INDEX IF NOT EXISTS idx_paystack_transactions_user_id 
ON public.paystack_transactions(user_id);

CREATE INDEX IF NOT EXISTS idx_paystack_transactions_status 
ON public.paystack_transactions(status);

-- Create function to handle subscription plan updates
CREATE OR REPLACE FUNCTION public.update_subscription_plan_timestamp()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Apply timestamp trigger to subscription_plans
DROP TRIGGER IF EXISTS update_subscription_plans_timestamp ON public.subscription_plans;
CREATE TRIGGER update_subscription_plans_timestamp
  BEFORE UPDATE ON public.subscription_plans
  FOR EACH ROW EXECUTE FUNCTION public.update_subscription_plan_timestamp();

-- Insert default plans (these should match Paystack configuration)
INSERT INTO public.subscription_plans (paystack_plan_code, name, description, amount, currency, interval, tier, send_invoices, send_sms)
VALUES
  ('PLN_tier1', 'ReBooked Genius Pro', 'Professional tier with unlimited AI messages and more documents', 14900, 'ZAR', 'monthly', 'tier1', true, false),
  ('PLN_tier2', 'ReBooked Genius Premium', 'Premium tier with NBT access and all features', 24900, 'ZAR', 'monthly', 'tier2', true, false)
ON CONFLICT (paystack_plan_code) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  amount = EXCLUDED.amount,
  currency = EXCLUDED.currency,
  interval = EXCLUDED.interval,
  tier = EXCLUDED.tier,
  send_invoices = EXCLUDED.send_invoices,
  send_sms = EXCLUDED.send_sms,
  updated_at = now();

-- Create function to get subscription plan by code
CREATE OR REPLACE FUNCTION public.get_subscription_plan(p_plan_code TEXT)
RETURNS public.subscription_plans
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM public.subscription_plans 
  WHERE paystack_plan_code = p_plan_code AND is_active = true;
$$;

-- Create function to get active subscription for user
CREATE OR REPLACE FUNCTION public.get_active_subscription(p_user_id UUID)
RETURNS public.subscriptions
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM public.subscriptions 
  WHERE user_id = p_user_id 
  AND status IN ('active', 'non-renewing')
  AND (current_period_end IS NULL OR current_period_end > now())
  LIMIT 1;
$$;

-- Add columns to profiles table for subscription tracking if they don't exist
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS subscription_tier subscription_tier DEFAULT 'free';

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS renewal_date DATE;

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS subscription_status TEXT DEFAULT 'active';
