
-- Fix overly permissive update policy
DROP POLICY IF EXISTS "Service role can update redemptions" ON public.code_redemptions;

-- Only allow users to update their own redemptions (expiry handled by service role in edge functions)
CREATE POLICY "Users can update own redemptions" ON public.code_redemptions
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid());
