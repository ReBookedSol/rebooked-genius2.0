-- Fix all public functions to have search_path set to public

ALTER FUNCTION public.update_updated_at_column() SET search_path = public;
ALTER FUNCTION public.handle_new_user() SET search_path = public;
ALTER FUNCTION public.can_use_ai(uuid) SET search_path = public;
ALTER FUNCTION public.increment_ai_token_usage(uuid, bigint) SET search_path = public;
ALTER FUNCTION public.decrypt_chat_message(uuid) SET search_path = public;
ALTER FUNCTION public.decrypt_lesson_comment(uuid) SET search_path = public;
ALTER FUNCTION public.clear_user_storage(uuid) SET search_path = public;
ALTER FUNCTION public.update_storage_on_document_upload(uuid, bigint) SET search_path = public;

-- Check for encrypt trigger functions
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'encrypt_chat_message_content' AND pronamespace = 'public'::regnamespace) THEN
    EXECUTE 'ALTER FUNCTION public.encrypt_chat_message_content() SET search_path = public';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'encrypt_lesson_comment_content' AND pronamespace = 'public'::regnamespace) THEN
    EXECUTE 'ALTER FUNCTION public.encrypt_lesson_comment_content() SET search_path = public';
  END IF;
END $$;