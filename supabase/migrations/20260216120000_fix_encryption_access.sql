-- Update decrypt_chat_message to allow owners to decrypt their own messages
CREATE OR REPLACE FUNCTION public.decrypt_chat_message(p_message_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_key text;
  v_encrypted bytea;
  v_result text;
  v_owner_id uuid;
BEGIN
  -- Get the owner of the conversation this message belongs to
  SELECT c.user_id INTO v_owner_id 
  FROM public.chat_conversations c
  JOIN public.chat_messages m ON m.conversation_id = c.id
  WHERE m.id = p_message_id;

  -- Allow admins OR the owner to decrypt
  IF NOT (public.has_role(auth.uid(), 'admin') OR auth.uid() = v_owner_id) THEN
    RETURN '[UNAUTHORIZED]';
  END IF;
  
  SELECT key_value INTO v_key FROM public.encryption_keys WHERE key_name = 'message_key' LIMIT 1;
  SELECT encrypted_content INTO v_encrypted FROM public.chat_messages WHERE id = p_message_id;
  
  IF v_key IS NULL OR v_encrypted IS NULL THEN
    -- Return plain content if no encryption exists
    SELECT content INTO v_result FROM public.chat_messages WHERE id = p_message_id;
    RETURN v_result;
  END IF;
  
  BEGIN
    RETURN pgp_sym_decrypt(v_encrypted, v_key);
  EXCEPTION WHEN OTHERS THEN
    -- Fallback to plain content if decryption fails
    SELECT content INTO v_result FROM public.chat_messages WHERE id = p_message_id;
    RETURN v_result;
  END;
END;
$function$;

-- Update decrypt_lesson_comment to allow owners to decrypt their own comments
CREATE OR REPLACE FUNCTION public.decrypt_lesson_comment(p_comment_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_key text;
  v_encrypted bytea;
  v_result text;
  v_owner_id uuid;
BEGIN
  -- Get the owner of the comment
  SELECT user_id INTO v_owner_id FROM public.lesson_comments WHERE id = p_comment_id;

  -- Allow admins OR the owner to decrypt
  IF NOT (public.has_role(auth.uid(), 'admin') OR auth.uid() = v_owner_id) THEN
    RETURN '[UNAUTHORIZED]';
  END IF;
  
  SELECT key_value INTO v_key FROM public.encryption_keys WHERE key_name = 'comment_key' LIMIT 1;
  SELECT encrypted_content INTO v_encrypted FROM public.lesson_comments WHERE id = p_comment_id;
  
  IF v_key IS NULL OR v_encrypted IS NULL THEN
    SELECT content INTO v_result FROM public.lesson_comments WHERE id = p_comment_id;
    RETURN v_result;
  END IF;
  
  BEGIN
    RETURN pgp_sym_decrypt(v_encrypted, v_key);
  EXCEPTION WHEN OTHERS THEN
    -- Fallback to plain content if decryption fails
    SELECT content INTO v_result FROM public.lesson_comments WHERE id = p_comment_id;
    RETURN v_result;
  END;
END;
$function$;

-- Create RPC to fetch decrypted chat messages for a conversation
CREATE OR REPLACE FUNCTION public.get_decrypted_chat_messages(p_conversation_id uuid)
RETURNS TABLE (
  id uuid,
  role text,
  content text,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_owner_id uuid;
BEGIN
  -- Check if user is owner of the conversation
  SELECT user_id INTO v_owner_id FROM public.chat_conversations WHERE id = p_conversation_id;
  
  IF NOT (public.has_role(auth.uid(), 'admin') OR auth.uid() = v_owner_id) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  RETURN QUERY
  SELECT 
    m.id,
    m.role::text,
    public.decrypt_chat_message(m.id) as content,
    m.created_at
  FROM public.chat_messages m
  WHERE m.conversation_id = p_conversation_id
  ORDER BY m.created_at ASC;
END;
$function$;

-- Create RPC to fetch decrypted lesson comments
CREATE OR REPLACE FUNCTION public.get_decrypted_lesson_comments(p_lesson_id uuid)
RETURNS TABLE (
  id uuid,
  lesson_id uuid,
  user_id uuid,
  content text,
  highlighted_text text,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    c.id,
    c.lesson_id,
    c.user_id,
    public.decrypt_lesson_comment(c.id) as content,
    c.highlighted_text,
    c.created_at,
    c.updated_at
  FROM public.lesson_comments c
  WHERE c.lesson_id = p_lesson_id AND (public.has_role(auth.uid(), 'admin') OR c.user_id = auth.uid())
  ORDER BY c.created_at DESC;
END;
$function$;
