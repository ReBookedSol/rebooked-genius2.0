
-- Drop triggers that use encryption functions
DROP TRIGGER IF EXISTS encrypt_chat_message_trigger ON public.chat_messages;
DROP TRIGGER IF EXISTS encrypt_lesson_comment_trigger ON public.lesson_comments;

-- Drop encryption/decryption functions
DROP FUNCTION IF EXISTS public.encrypt_chat_message() CASCADE;
DROP FUNCTION IF EXISTS public.encrypt_lesson_comment() CASCADE;
DROP FUNCTION IF EXISTS public.decrypt_chat_message(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.decrypt_lesson_comment(uuid) CASCADE;

-- Drop the encryption_keys table and its policies
DROP TABLE IF EXISTS public.encryption_keys CASCADE;
