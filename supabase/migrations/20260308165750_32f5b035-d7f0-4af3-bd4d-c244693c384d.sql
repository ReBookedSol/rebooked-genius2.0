
CREATE TABLE IF NOT EXISTS public.encryption_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key_name text UNIQUE NOT NULL,
  key_value text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.encryption_keys ENABLE ROW LEVEL SECURITY;

-- Only service role can access encryption keys (no public access)
CREATE POLICY "No public access to encryption keys"
  ON public.encryption_keys
  FOR ALL
  TO authenticated
  USING (false);
