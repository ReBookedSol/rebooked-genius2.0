-- Create storage_usage table to track per-user storage consumption
CREATE TABLE IF NOT EXISTS public.storage_usage (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  total_bytes_used BIGINT NOT NULL DEFAULT 0,
  documents_bytes BIGINT NOT NULL DEFAULT 0,
  chat_messages_bytes BIGINT NOT NULL DEFAULT 0,
  flashcards_bytes BIGINT NOT NULL DEFAULT 0,
  quizzes_bytes BIGINT NOT NULL DEFAULT 0,
  whiteboard_bytes BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- Create storage_limits table to define limits per tier
CREATE TABLE IF NOT EXISTS public.storage_limits (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tier TEXT NOT NULL,
  limit_bytes BIGINT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(tier)
);

-- Insert default storage limits for each tier
INSERT INTO public.storage_limits (tier, limit_bytes) VALUES
  ('free', 52428800), -- 50 MB
  ('tier1', 1073741824), -- 1 GB
  ('tier2', 1073741824) -- 1 GB
ON CONFLICT (tier) DO NOTHING;

-- Function to calculate message size in bytes (rough estimate)
-- Assuming ~1 byte per character plus 100 bytes overhead per message
CREATE OR REPLACE FUNCTION estimate_message_size(p_content TEXT)
RETURNS BIGINT
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  RETURN COALESCE(LENGTH(p_content), 0) + 100;
END;
$$;

-- Function to update storage usage when documents are uploaded
CREATE OR REPLACE FUNCTION update_storage_on_document_upload(
  p_user_id UUID,
  p_file_size BIGINT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.storage_usage (user_id, total_bytes_used, documents_bytes)
  VALUES (p_user_id, p_file_size, p_file_size)
  ON CONFLICT (user_id) DO UPDATE
  SET
    total_bytes_used = storage_usage.total_bytes_used + p_file_size,
    documents_bytes = storage_usage.documents_bytes + p_file_size,
    updated_at = now();
END;
$$;

-- Function to update storage usage when documents are deleted
CREATE OR REPLACE FUNCTION update_storage_on_document_delete(
  p_user_id UUID,
  p_file_size BIGINT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.storage_usage
  SET
    total_bytes_used = GREATEST(0, total_bytes_used - p_file_size),
    documents_bytes = GREATEST(0, documents_bytes - p_file_size),
    updated_at = now()
  WHERE user_id = p_user_id;
END;
$$;

-- Function to update storage usage for chat messages
CREATE OR REPLACE FUNCTION update_storage_on_chat_message(
  p_user_id UUID,
  p_message_content TEXT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_message_size BIGINT;
BEGIN
  v_message_size := estimate_message_size(p_message_content);
  
  INSERT INTO public.storage_usage (user_id, total_bytes_used, chat_messages_bytes)
  VALUES (p_user_id, v_message_size, v_message_size)
  ON CONFLICT (user_id) DO UPDATE
  SET
    total_bytes_used = storage_usage.total_bytes_used + v_message_size,
    chat_messages_bytes = storage_usage.chat_messages_bytes + v_message_size,
    updated_at = now();
END;
$$;

-- Function to check if user can upload file (checks storage limit)
CREATE OR REPLACE FUNCTION can_upload_file(
  p_user_id UUID,
  p_file_size BIGINT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_tier TEXT;
  v_limit BIGINT;
  v_used BIGINT;
BEGIN
  -- Get user tier
  SELECT COALESCE(tier, 'free') INTO v_tier
  FROM public.subscriptions
  WHERE user_id = p_user_id;
  
  -- Get storage limit for tier
  SELECT limit_bytes INTO v_limit
  FROM public.storage_limits
  WHERE tier = v_tier;
  
  IF v_limit IS NULL THEN
    -- Default to free tier limit if not found
    v_limit := 52428800; -- 50 MB
  END IF;
  
  -- Get current usage
  SELECT COALESCE(total_bytes_used, 0) INTO v_used
  FROM public.storage_usage
  WHERE user_id = p_user_id;
  
  -- Check if file would exceed limit
  RETURN (v_used + p_file_size) <= v_limit;
END;
$$;

-- Function to get user's storage percentage
CREATE OR REPLACE FUNCTION get_storage_percentage(p_user_id UUID)
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_tier TEXT;
  v_limit BIGINT;
  v_used BIGINT;
BEGIN
  -- Get user tier
  SELECT COALESCE(tier, 'free') INTO v_tier
  FROM public.subscriptions
  WHERE user_id = p_user_id;
  
  -- Get storage limit for tier
  SELECT limit_bytes INTO v_limit
  FROM public.storage_limits
  WHERE tier = v_tier;
  
  IF v_limit IS NULL THEN
    v_limit := 52428800; -- 50 MB default
  END IF;
  
  -- Get current usage
  SELECT COALESCE(total_bytes_used, 0) INTO v_used
  FROM public.storage_usage
  WHERE user_id = p_user_id;
  
  -- Return percentage (0-100)
  RETURN ROUND(CAST(v_used AS NUMERIC) / CAST(v_limit AS NUMERIC) * 100, 2);
END;
$$;

-- Function to clear all user storage (delete all data)
CREATE OR REPLACE FUNCTION clear_user_storage(p_user_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Delete all flashcard decks
  DELETE FROM public.flashcard_decks WHERE user_id = p_user_id;
  
  -- Delete all quizzes
  DELETE FROM public.quizzes WHERE user_id = p_user_id;
  
  -- Delete all chat messages and conversations
  DELETE FROM public.chat_messages 
  WHERE conversation_id IN (
    SELECT id FROM public.chat_conversations WHERE user_id = p_user_id
  );
  DELETE FROM public.chat_conversations WHERE user_id = p_user_id;
  
  -- Delete all study documents
  DELETE FROM public.study_documents WHERE user_id = p_user_id;
  
  -- Delete all knowledge base entries
  DELETE FROM public.knowledge_base WHERE user_id = p_user_id;
  
  -- Reset storage usage
  DELETE FROM public.storage_usage WHERE user_id = p_user_id;
  
  -- Delete files from storage (handled by frontend or storage triggers)
END;
$$;

-- Add RLS policies for storage_usage table
ALTER TABLE public.storage_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own storage usage"
  ON public.storage_usage
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can insert storage usage"
  ON public.storage_usage
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Service role can update storage usage"
  ON public.storage_usage
  FOR UPDATE
  USING (true);

-- Add RLS policies for storage_limits table
ALTER TABLE public.storage_limits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read storage limits"
  ON public.storage_limits
  FOR SELECT
  USING (true);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_storage_usage_user_id ON public.storage_usage(user_id);
CREATE INDEX IF NOT EXISTS idx_storage_usage_updated_at ON public.storage_usage(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_storage_limits_tier ON public.storage_limits(tier);
