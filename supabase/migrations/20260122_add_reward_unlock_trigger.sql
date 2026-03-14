-- Function to automatically unlock rewards when user reaches required points
CREATE OR REPLACE FUNCTION unlock_rewards_for_user()
RETURNS TRIGGER AS $$
BEGIN
  -- For all rewards that the user has not yet been assigned
  -- Check if the user's total_points now meets or exceeds the reward's required_points
  INSERT INTO public.user_rewards (user_id, reward_id, status, created_at)
  SELECT 
    NEW.user_id,
    r.id,
    'available' :: user_reward_status,
    now()
  FROM public.rewards r
  WHERE 
    r.is_active = true
    AND NEW.total_points >= r.required_points
    AND r.tier_requirement = COALESCE(
      (SELECT subscription_tier FROM public.profiles WHERE user_id = NEW.user_id),
      'free'
    )
    AND NOT EXISTS (
      SELECT 1 
      FROM public.user_rewards ur 
      WHERE ur.user_id = NEW.user_id 
      AND ur.reward_id = r.id
    )
    -- Check availability limit if set
    AND (r.availability_limit IS NULL OR r.claimed_count < r.availability_limit)
  ON CONFLICT (user_id, reward_id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger on user_points INSERT/UPDATE
DROP TRIGGER IF EXISTS user_points_unlock_rewards_trigger ON public.user_points;

CREATE TRIGGER user_points_unlock_rewards_trigger
  AFTER INSERT OR UPDATE ON public.user_points
  FOR EACH ROW
  EXECUTE FUNCTION unlock_rewards_for_user();

-- Function to handle reward claiming and update claimed_count
CREATE OR REPLACE FUNCTION handle_reward_claim()
RETURNS TRIGGER AS $$
BEGIN
  -- When a user_reward status changes to 'claimed', increment the reward's claimed_count
  IF NEW.status = 'claimed' AND (OLD.status != 'claimed' OR OLD.status IS NULL) THEN
    UPDATE public.rewards
    SET claimed_count = claimed_count + 1
    WHERE id = NEW.reward_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger on user_rewards UPDATE for claim tracking
DROP TRIGGER IF EXISTS user_rewards_claim_count_trigger ON public.user_rewards;

CREATE TRIGGER user_rewards_claim_count_trigger
  AFTER INSERT OR UPDATE ON public.user_rewards
  FOR EACH ROW
  EXECUTE FUNCTION handle_reward_claim();
