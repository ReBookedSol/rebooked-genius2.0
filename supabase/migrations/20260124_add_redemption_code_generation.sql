-- Function to generate unique redemption codes
CREATE OR REPLACE FUNCTION generate_redemption_code()
RETURNS TEXT AS $$
DECLARE
  code TEXT;
  code_exists BOOLEAN;
BEGIN
  -- Generate a unique code in format: REWARD-XXXXX-XXXXX
  LOOP
    code := 'REWARD-' || 
            UPPER(SUBSTRING(MD5(RANDOM()::TEXT), 1, 5)) || '-' ||
            UPPER(SUBSTRING(MD5(RANDOM()::TEXT || CLOCK_TIMESTAMP()::TEXT), 1, 5));
    
    -- Check if code already exists
    SELECT EXISTS(
      SELECT 1 FROM public.user_rewards 
      WHERE redemption_code = code
    ) INTO code_exists;
    
    -- Exit loop if code is unique
    EXIT WHEN NOT code_exists;
  END LOOP;
  
  RETURN code;
END;
$$ LANGUAGE plpgsql;

-- Update user_rewards trigger to auto-generate redemption codes
CREATE OR REPLACE FUNCTION generate_reward_redemption_code()
RETURNS TRIGGER AS $$
BEGIN
  -- Generate redemption code if not provided
  IF NEW.redemption_code IS NULL THEN
    NEW.redemption_code := generate_redemption_code();
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-generate redemption codes on insert
DROP TRIGGER IF EXISTS user_rewards_generate_code_trigger ON public.user_rewards;

CREATE TRIGGER user_rewards_generate_code_trigger
  BEFORE INSERT ON public.user_rewards
  FOR EACH ROW
  EXECUTE FUNCTION generate_reward_redemption_code();

-- Add index on redemption_code for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_rewards_redemption_code 
  ON public.user_rewards(redemption_code);
