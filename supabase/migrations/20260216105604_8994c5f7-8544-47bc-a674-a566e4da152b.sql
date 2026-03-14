
-- Add token_count column to ai_usage table for tracking daily token consumption
ALTER TABLE public.ai_usage ADD COLUMN IF NOT EXISTS token_count bigint NOT NULL DEFAULT 0;

-- Update the can_use_ai function to also check token limits
-- Free users: 100,000 tokens per day for first 14 days, then regular message limit
CREATE OR REPLACE FUNCTION public.can_use_ai(p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_tier TEXT;
  v_token_count BIGINT;
  v_message_count INTEGER;
  v_account_age_days INTEGER;
BEGIN
  v_tier := public.get_user_tier(p_user_id);
  
  -- Paid users have unlimited access
  IF v_tier IN ('tier1', 'tier2') THEN
    RETURN TRUE;
  END IF;
  
  -- Get account age
  SELECT EXTRACT(DAY FROM (now() - created_at))::INTEGER INTO v_account_age_days
  FROM auth.users WHERE id = p_user_id;
  
  -- Get today's usage
  SELECT COALESCE(message_count, 0), COALESCE(token_count, 0) 
  INTO v_message_count, v_token_count
  FROM public.ai_usage
  WHERE user_id = p_user_id AND date = CURRENT_DATE;
  
  -- Free users within first 14 days: 100,000 token limit per day
  IF COALESCE(v_account_age_days, 0) <= 14 THEN
    RETURN COALESCE(v_token_count, 0) < 100000;
  END IF;
  
  -- Free users after 14 days: 10 messages per day
  RETURN COALESCE(v_message_count, 0) < 10;
END;
$function$;

-- Create function to increment token usage
CREATE OR REPLACE FUNCTION public.increment_ai_token_usage(p_user_id uuid, p_tokens bigint)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_new_count BIGINT;
BEGIN
  INSERT INTO public.ai_usage (user_id, date, message_count, token_count)
  VALUES (p_user_id, CURRENT_DATE, 0, p_tokens)
  ON CONFLICT (user_id, date)
  DO UPDATE SET
    token_count = ai_usage.token_count + p_tokens,
    updated_at = now()
  RETURNING token_count INTO v_new_count;
  
  RETURN v_new_count;
END;
$function$;

-- Create function to get remaining tokens for free users
CREATE OR REPLACE FUNCTION public.get_remaining_ai_tokens(p_user_id uuid)
RETURNS bigint
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_tier TEXT;
  v_token_count BIGINT;
  v_account_age_days INTEGER;
BEGIN
  v_tier := public.get_user_tier(p_user_id);
  
  IF v_tier IN ('tier1', 'tier2') THEN
    RETURN 999999999; -- Unlimited
  END IF;
  
  SELECT EXTRACT(DAY FROM (now() - created_at))::INTEGER INTO v_account_age_days
  FROM auth.users WHERE id = p_user_id;
  
  IF COALESCE(v_account_age_days, 0) > 14 THEN
    RETURN 0; -- After trial, use message-based limits
  END IF;
  
  SELECT COALESCE(token_count, 0) INTO v_token_count
  FROM public.ai_usage
  WHERE user_id = p_user_id AND date = CURRENT_DATE;
  
  RETURN GREATEST(0, 100000 - COALESCE(v_token_count, 0));
END;
$function$;
