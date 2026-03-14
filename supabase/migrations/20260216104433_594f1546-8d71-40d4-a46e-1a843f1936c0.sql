
-- Fix: Replace overly permissive "System can manage subscriptions" policy
-- Users should only read their own subscription; all writes go through service-role edge functions

DROP POLICY IF EXISTS "System can manage subscriptions" ON public.subscriptions;

-- Users can only view their own subscription
CREATE POLICY "Users can view own subscription"
  ON public.subscriptions FOR SELECT
  USING (auth.uid() = user_id);

-- No client-side insert/update/delete - service role handles via edge functions
CREATE POLICY "Service role manages subscriptions"
  ON public.subscriptions FOR ALL
  USING (false)
  WITH CHECK (false);
