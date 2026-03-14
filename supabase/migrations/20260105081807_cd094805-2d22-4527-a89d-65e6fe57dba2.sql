-- Create subscription_tier enum
DO $$ BEGIN
  CREATE TYPE subscription_tier AS ENUM ('free', 'tier1', 'tier2');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create subscriptions table to track user subscriptions
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tier subscription_tier NOT NULL DEFAULT 'free',
  paystack_customer_code TEXT,
  paystack_subscription_code TEXT,
  paystack_authorization_code TEXT,
  paystack_plan_code TEXT,
  status TEXT NOT NULL DEFAULT 'active', -- active, attention, cancelled, non-renewing
  current_period_start TIMESTAMP WITH TIME ZONE,
  current_period_end TIMESTAMP WITH TIME ZONE,
  cancelled_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- Create ai_usage table to track daily AI interactions
CREATE TABLE IF NOT EXISTS public.ai_usage (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  message_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, date)
);

-- Create document_usage table to track document limits
CREATE TABLE IF NOT EXISTS public.document_usage (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  document_count INTEGER NOT NULL DEFAULT 0,
  total_pages_processed INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- Create paystack_transactions table to track payment history
CREATE TABLE IF NOT EXISTS public.paystack_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reference TEXT NOT NULL UNIQUE,
  amount INTEGER NOT NULL, -- Amount in kobo/cents
  currency TEXT NOT NULL DEFAULT 'ZAR',
  status TEXT NOT NULL DEFAULT 'pending', -- pending, success, failed
  channel TEXT, -- card, bank, ussd, etc.
  paid_at TIMESTAMP WITH TIME ZONE,
  paystack_event TEXT, -- charge.success, subscription.create, etc.
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all new tables
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.paystack_transactions ENABLE ROW LEVEL SECURITY;

-- RLS policies for subscriptions
CREATE POLICY "Users can view their own subscription"
  ON public.subscriptions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "System can manage subscriptions"
  ON public.subscriptions FOR ALL
  USING (true)
  WITH CHECK (true);

-- RLS policies for ai_usage
CREATE POLICY "Users can view their own AI usage"
  ON public.ai_usage FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own AI usage"
  ON public.ai_usage FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own AI usage"
  ON public.ai_usage FOR UPDATE
  USING (auth.uid() = user_id);

-- RLS policies for document_usage
CREATE POLICY "Users can view their own document usage"
  ON public.document_usage FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own document usage"
  ON public.document_usage FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own document usage"
  ON public.document_usage FOR UPDATE
  USING (auth.uid() = user_id);

-- RLS policies for paystack_transactions
CREATE POLICY "Users can view their own transactions"
  ON public.paystack_transactions FOR SELECT
  USING (auth.uid() = user_id);

-- Function to create default subscription for new users
CREATE OR REPLACE FUNCTION public.handle_new_user_subscription()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.subscriptions (user_id, tier, status)
  VALUES (NEW.id, 'free', 'active')
  ON CONFLICT (user_id) DO NOTHING;
  
  INSERT INTO public.document_usage (user_id, document_count, total_pages_processed)
  VALUES (NEW.id, 0, 0)
  ON CONFLICT (user_id) DO NOTHING;
  
  RETURN NEW;
END;
$$;

-- Create trigger for new user subscription
DROP TRIGGER IF EXISTS on_auth_user_created_subscription ON auth.users;
CREATE TRIGGER on_auth_user_created_subscription
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_subscription();

-- Function to get user tier
CREATE OR REPLACE FUNCTION public.get_user_tier(p_user_id UUID)
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT tier::text FROM public.subscriptions 
     WHERE user_id = p_user_id 
     AND status IN ('active', 'non-renewing') 
     AND (current_period_end IS NULL OR current_period_end > now())
    ),
    'free'
  );
$$;

-- Function to check if user can use AI
CREATE OR REPLACE FUNCTION public.can_use_ai(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tier TEXT;
  v_message_count INTEGER;
BEGIN
  v_tier := public.get_user_tier(p_user_id);
  
  -- Paid users have unlimited access
  IF v_tier IN ('tier1', 'tier2') THEN
    RETURN TRUE;
  END IF;
  
  -- Free users: check daily limit (10 messages)
  SELECT COALESCE(message_count, 0) INTO v_message_count
  FROM public.ai_usage
  WHERE user_id = p_user_id AND date = CURRENT_DATE;
  
  RETURN COALESCE(v_message_count, 0) < 10;
END;
$$;

-- Function to increment AI usage
CREATE OR REPLACE FUNCTION public.increment_ai_usage(p_user_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_count INTEGER;
BEGIN
  INSERT INTO public.ai_usage (user_id, date, message_count)
  VALUES (p_user_id, CURRENT_DATE, 1)
  ON CONFLICT (user_id, date) 
  DO UPDATE SET 
    message_count = ai_usage.message_count + 1,
    updated_at = now()
  RETURNING message_count INTO v_new_count;
  
  RETURN v_new_count;
END;
$$;

-- Function to check document upload limits
CREATE OR REPLACE FUNCTION public.can_upload_document(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tier TEXT;
  v_doc_count INTEGER;
BEGIN
  v_tier := public.get_user_tier(p_user_id);

  SELECT COALESCE(document_count, 0) INTO v_doc_count
  FROM public.document_usage
  WHERE user_id = p_user_id;

  -- Free users: max 2 documents
  IF v_tier = 'free' THEN
    RETURN COALESCE(v_doc_count, 0) < 2;
  END IF;

  -- Tier 1 & 2: unlimited documents
  RETURN TRUE;
END;
$$;

-- Update timestamps trigger
CREATE OR REPLACE FUNCTION public.update_subscription_timestamp()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Apply timestamp triggers
DROP TRIGGER IF EXISTS update_subscriptions_timestamp ON public.subscriptions;
CREATE TRIGGER update_subscriptions_timestamp
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.update_subscription_timestamp();

DROP TRIGGER IF EXISTS update_ai_usage_timestamp ON public.ai_usage;
CREATE TRIGGER update_ai_usage_timestamp
  BEFORE UPDATE ON public.ai_usage
  FOR EACH ROW EXECUTE FUNCTION public.update_subscription_timestamp();

DROP TRIGGER IF EXISTS update_document_usage_timestamp ON public.document_usage;
CREATE TRIGGER update_document_usage_timestamp
  BEFORE UPDATE ON public.document_usage
  FOR EACH ROW EXECUTE FUNCTION public.update_subscription_timestamp();

DROP TRIGGER IF EXISTS update_paystack_transactions_timestamp ON public.paystack_transactions;
CREATE TRIGGER update_paystack_transactions_timestamp
  BEFORE UPDATE ON public.paystack_transactions
  FOR EACH ROW EXECUTE FUNCTION public.update_subscription_timestamp();
