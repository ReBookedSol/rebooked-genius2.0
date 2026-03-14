-- Update can_use_ai to remove message-based limit, use token-based only with 5-day cap
CREATE OR REPLACE FUNCTION public.can_use_ai(p_user_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_tier TEXT;
  v_token_count BIGINT;
  v_active_days INTEGER;
BEGIN
  v_tier := public.get_user_tier(p_user_id);
  
  -- Paid users have unlimited access
  IF v_tier IN ('tier1', 'tier2') THEN
    RETURN TRUE;
  END IF;
  
  -- Get today's token usage
  SELECT COALESCE(token_count, 0)
  INTO v_token_count
  FROM public.ai_usage
  WHERE user_id = p_user_id AND date = CURRENT_DATE;
  
  -- Check daily token limit (10,000 tokens per day, non-stacking)
  IF COALESCE(v_token_count, 0) >= 10000 THEN
    RETURN FALSE;
  END IF;
  
  -- Check 5-day active usage limit per month
  SELECT COUNT(DISTINCT date) INTO v_active_days
  FROM public.ai_usage
  WHERE user_id = p_user_id
    AND date >= date_trunc('month', CURRENT_DATE)::date
    AND token_count > 0;
  
  IF v_active_days > 5 THEN
    RETURN FALSE;
  END IF;
  
  RETURN TRUE;
END;
$function$;