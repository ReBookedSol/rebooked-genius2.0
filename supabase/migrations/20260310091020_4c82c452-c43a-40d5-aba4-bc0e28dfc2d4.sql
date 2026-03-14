
-- Add trial support columns to coupon_codes
ALTER TABLE public.coupon_codes 
  ADD COLUMN IF NOT EXISTS trial_days integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS trial_tier text DEFAULT 'tier2';

-- Rename table from coupon_codes to codes (keep old name as well for compatibility)
-- Actually, let's just add comments. Renaming tables is risky with existing RLS/FKs.

-- Create code_redemptions table to track who redeemed what
CREATE TABLE IF NOT EXISTS public.code_redemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  code_id uuid REFERENCES public.coupon_codes(id) ON DELETE CASCADE NOT NULL,
  code text NOT NULL,
  redemption_type text NOT NULL DEFAULT 'discount', -- 'discount' or 'trial'
  trial_tier text,
  trial_starts_at timestamptz,
  trial_ends_at timestamptz,
  discount_type text,
  discount_value numeric,
  status text NOT NULL DEFAULT 'active', -- 'active', 'expired', 'cancelled'
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, code_id)
);

-- Enable RLS
ALTER TABLE public.code_redemptions ENABLE ROW LEVEL SECURITY;

-- Users can read their own redemptions
CREATE POLICY "Users can read own redemptions" ON public.code_redemptions
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Users can insert their own redemptions
CREATE POLICY "Users can insert own redemptions" ON public.code_redemptions
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Service role can update (for expiry cron)
CREATE POLICY "Service role can update redemptions" ON public.code_redemptions
  FOR UPDATE TO authenticated
  USING (true);

-- Updated_at trigger
CREATE TRIGGER update_code_redemptions_updated_at
  BEFORE UPDATE ON public.code_redemptions
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
