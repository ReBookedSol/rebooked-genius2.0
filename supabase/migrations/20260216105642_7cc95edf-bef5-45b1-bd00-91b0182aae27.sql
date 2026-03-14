
-- Enable pgcrypto for encryption
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Add encrypted content columns to chat_messages and lesson_comments
ALTER TABLE public.chat_messages ADD COLUMN IF NOT EXISTS encrypted_content bytea;
ALTER TABLE public.lesson_comments ADD COLUMN IF NOT EXISTS encrypted_content bytea;

-- Create encryption key storage (admin-only)
CREATE TABLE IF NOT EXISTS public.encryption_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key_name text UNIQUE NOT NULL,
  key_value text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.encryption_keys ENABLE ROW LEVEL SECURITY;

-- Only admins can access encryption keys
CREATE POLICY "Only admins can access encryption keys"
ON public.encryption_keys
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Create function to encrypt content on insert (chat_messages)
CREATE OR REPLACE FUNCTION public.encrypt_chat_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_key text;
BEGIN
  SELECT key_value INTO v_key FROM public.encryption_keys WHERE key_name = 'message_key' LIMIT 1;
  IF v_key IS NOT NULL THEN
    NEW.encrypted_content = pgp_sym_encrypt(NEW.content, v_key);
  END IF;
  RETURN NEW;
END;
$function$;

-- Create function to encrypt content on insert (lesson_comments)
CREATE OR REPLACE FUNCTION public.encrypt_lesson_comment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_key text;
BEGIN
  SELECT key_value INTO v_key FROM public.encryption_keys WHERE key_name = 'comment_key' LIMIT 1;
  IF v_key IS NOT NULL THEN
    NEW.encrypted_content = pgp_sym_encrypt(NEW.content, v_key);
  END IF;
  RETURN NEW;
END;
$function$;

-- Create triggers for encryption
CREATE TRIGGER encrypt_chat_message_trigger
BEFORE INSERT OR UPDATE ON public.chat_messages
FOR EACH ROW EXECUTE FUNCTION public.encrypt_chat_message();

CREATE TRIGGER encrypt_lesson_comment_trigger
BEFORE INSERT OR UPDATE ON public.lesson_comments
FOR EACH ROW EXECUTE FUNCTION public.encrypt_lesson_comment();

-- Create admin-only decryption functions
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
BEGIN
  -- Only admins can decrypt
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Unauthorized: admin access required';
  END IF;
  
  SELECT key_value INTO v_key FROM public.encryption_keys WHERE key_name = 'message_key' LIMIT 1;
  SELECT encrypted_content INTO v_encrypted FROM public.chat_messages WHERE id = p_message_id;
  
  IF v_key IS NULL OR v_encrypted IS NULL THEN
    -- Return plain content if no encryption
    SELECT content INTO v_result FROM public.chat_messages WHERE id = p_message_id;
    RETURN v_result;
  END IF;
  
  RETURN pgp_sym_decrypt(v_encrypted, v_key);
END;
$function$;

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
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Unauthorized: admin access required';
  END IF;
  
  SELECT key_value INTO v_key FROM public.encryption_keys WHERE key_name = 'comment_key' LIMIT 1;
  SELECT encrypted_content INTO v_encrypted FROM public.lesson_comments WHERE id = p_comment_id;
  
  IF v_key IS NULL OR v_encrypted IS NULL THEN
    SELECT content INTO v_result FROM public.lesson_comments WHERE id = p_comment_id;
    RETURN v_result;
  END IF;
  
  RETURN pgp_sym_decrypt(v_encrypted, v_key);
END;
$function$;
