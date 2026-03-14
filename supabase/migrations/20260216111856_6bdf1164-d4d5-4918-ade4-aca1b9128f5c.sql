-- Fix remaining functions without search_path
ALTER FUNCTION public.update_flashcard_mastery_history_updated_at() SET search_path = public;
ALTER FUNCTION public.update_quiz_performance_analytics_updated_at() SET search_path = public;
ALTER FUNCTION public.update_quiz_performance_summary_updated_at() SET search_path = public;
ALTER FUNCTION public.update_study_time_sessions_updated_at() SET search_path = public;
ALTER FUNCTION public.update_study_time_analytics_updated_at() SET search_path = public;
ALTER FUNCTION public.update_study_time_trends_updated_at() SET search_path = public;
ALTER FUNCTION public.update_chat_context_sessions_updated_at() SET search_path = public;
ALTER FUNCTION public.update_flashcard_ai_explanations_updated_at() SET search_path = public;
ALTER FUNCTION public.update_subject_analytics_summary_updated_at() SET search_path = public;