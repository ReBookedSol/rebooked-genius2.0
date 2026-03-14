-- Create ENUM types for rewards system
CREATE TYPE reward_type AS ENUM ('discount', 'affiliate_link', 'custom_benefit');
CREATE TYPE tier_requirement AS ENUM ('free', 'tier1', 'tier2');
CREATE TYPE user_reward_status AS ENUM ('available', 'claimed', 'redeemed');

-- Create rewards table
CREATE TABLE IF NOT EXISTS public.rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  required_points INTEGER NOT NULL DEFAULT 0,
  reward_type reward_type NOT NULL,
  discount_percentage INTEGER,
  discount_code TEXT,
  affiliate_link TEXT,
  availability_limit INTEGER,
  claimed_count INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,ns
  tier_requirement tier_requirement NOT NULL DEFAULT 'free',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create user_rewards table
CREATE TABLE IF NOT EXISTS public.user_rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reward_id UUID NOT NULL REFERENCES public.rewards(id) ON DELETE CASCADE,
  claimed_at TIMESTAMPTZ,
  redemption_code TEXT UNIQUE,
  status user_reward_status NOT NULL DEFAULT 'available',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, reward_id)
);

-- Enable RLS for rewards table
ALTER TABLE public.rewards ENABLE ROW LEVEL SECURITY;

-- RLS Policies for rewards table
-- Anyone can view active rewards (tier filtering happens in app logic)
CREATE POLICY "Anyone can view active rewards"
  ON public.rewards
  FOR SELECT
  USING (is_active = true);

-- Only admins can insert/update/delete rewards
CREATE POLICY "Admins can manage rewards"
  ON public.rewards
  FOR ALL
  USING (auth.jwt() ->> 'email' = (SELECT email FROM auth.users WHERE id = auth.uid() AND raw_user_meta_data ->> 'role' = 'admin'))
  WITH CHECK (auth.jwt() ->> 'email' = (SELECT email FROM auth.users WHERE id = auth.uid() AND raw_user_meta_data ->> 'role' = 'admin'));

-- Enable RLS for user_rewards table
ALTER TABLE public.user_rewards ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_rewards table
-- Users can view/update their own rewards
CREATE POLICY "Users can view own rewards"
  ON public.user_rewards
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own rewards"
  ON public.user_rewards
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own rewards"
  ON public.user_rewards
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Create indexes for performance
CREATE INDEX idx_rewards_required_points ON public.rewards(required_points);
CREATE INDEX idx_rewards_is_active ON public.rewards(is_active);
CREATE INDEX idx_rewards_tier_requirement ON public.rewards(tier_requirement);
CREATE INDEX idx_user_rewards_user_id ON public.user_rewards(user_id);
CREATE INDEX idx_user_rewards_reward_id ON public.user_rewards(reward_id);
CREATE INDEX idx_user_rewards_status ON public.user_rewards(status);

-- Create trigger to update rewards updated_at timestamp
CREATE OR REPLACE FUNCTION update_rewards_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER rewards_updated_at_trigger
  BEFORE UPDATE ON public.rewards
  FOR EACH ROW
  EXECUTE FUNCTION update_rewards_updated_at();
