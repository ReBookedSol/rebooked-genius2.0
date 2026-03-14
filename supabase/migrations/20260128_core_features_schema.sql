-- ============================================================================
-- CORE STUDY FEATURES SCHEMA MIGRATION
-- Date: 2026-01-28
-- Purpose: Add all 11 new tables for core study features (flashcard mastery,
--          quiz analytics, time tracking, subject tagging, AI chat context,
--          flashcard explanations, and analytics aggregations)
-- ============================================================================

-- ============================================================================
-- 1. FLASHCARD MASTERY TRACKING
-- ============================================================================

-- Track individual mastery state changes for flashcards
CREATE TABLE IF NOT EXISTS public.flashcard_mastery_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  flashcard_id UUID NOT NULL REFERENCES public.flashcards(id) ON DELETE CASCADE,
  deck_id UUID NOT NULL REFERENCES public.flashcard_decks(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (action IN ('mastered', 'unmastered')),
  reason TEXT,
  previous_state BOOLEAN,
  new_state BOOLEAN NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.flashcard_mastery_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own mastery history"
  ON public.flashcard_mastery_history
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own mastery history"
  ON public.flashcard_mastery_history
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_flashcard_mastery_history_user_id ON public.flashcard_mastery_history(user_id);
CREATE INDEX idx_flashcard_mastery_history_flashcard_id ON public.flashcard_mastery_history(flashcard_id);
CREATE INDEX idx_flashcard_mastery_history_created_at ON public.flashcard_mastery_history(created_at DESC);

CREATE OR REPLACE FUNCTION update_flashcard_mastery_history_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER flashcard_mastery_history_updated_at_trigger
  BEFORE UPDATE ON public.flashcard_mastery_history
  FOR EACH ROW
  EXECUTE FUNCTION update_flashcard_mastery_history_updated_at();


-- ============================================================================
-- 2. QUIZ PERFORMANCE ANALYTICS
-- ============================================================================

-- Individual quiz attempt metrics (detailed)
CREATE TABLE IF NOT EXISTS public.quiz_performance_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  quiz_id UUID NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
  quiz_attempt_id UUID REFERENCES public.quiz_attempts(id) ON DELETE CASCADE,
  subject_id UUID REFERENCES public.subjects(id) ON DELETE SET NULL,
  score NUMERIC(5, 2),
  max_score NUMERIC(5, 2),
  percentage NUMERIC(5, 2),
  questions_correct INTEGER,
  total_questions INTEGER,
  time_taken_seconds INTEGER,
  difficulty_level TEXT,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.quiz_performance_analytics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own quiz analytics"
  ON public.quiz_performance_analytics
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own quiz analytics"
  ON public.quiz_performance_analytics
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_quiz_performance_analytics_user_id ON public.quiz_performance_analytics(user_id);
CREATE INDEX idx_quiz_performance_analytics_quiz_id ON public.quiz_performance_analytics(quiz_id);
CREATE INDEX idx_quiz_performance_analytics_subject_id ON public.quiz_performance_analytics(subject_id);
CREATE INDEX idx_quiz_performance_analytics_completed_at ON public.quiz_performance_analytics(completed_at DESC);

CREATE OR REPLACE FUNCTION update_quiz_performance_analytics_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER quiz_performance_analytics_updated_at_trigger
  BEFORE UPDATE ON public.quiz_performance_analytics
  FOR EACH ROW
  EXECUTE FUNCTION update_quiz_performance_analytics_updated_at();


-- Aggregated per-user quiz performance summary (updated by frontend)
CREATE TABLE IF NOT EXISTS public.quiz_performance_summary (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  total_quizzes_taken INTEGER DEFAULT 0,
  average_score NUMERIC(5, 2) DEFAULT 0,
  highest_score NUMERIC(5, 2) DEFAULT 0,
  lowest_score NUMERIC(5, 2) DEFAULT 100,
  total_time_spent_seconds INTEGER DEFAULT 0,
  last_quiz_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.quiz_performance_summary ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own quiz summary"
  ON public.quiz_performance_summary
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own quiz summary"
  ON public.quiz_performance_summary
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own quiz summary"
  ON public.quiz_performance_summary
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_quiz_performance_summary_user_id ON public.quiz_performance_summary(user_id);

CREATE OR REPLACE FUNCTION update_quiz_performance_summary_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER quiz_performance_summary_updated_at_trigger
  BEFORE UPDATE ON public.quiz_performance_summary
  FOR EACH ROW
  EXECUTE FUNCTION update_quiz_performance_summary_updated_at();


-- ============================================================================
-- 3. STUDY MATERIALS SUBJECT TAGGING
-- ============================================================================

-- Add subject_id to study_documents if not exists
ALTER TABLE public.study_documents 
ADD COLUMN IF NOT EXISTS subject_id UUID REFERENCES public.subjects(id) ON DELETE SET NULL;

-- Create index on subject_id for fast queries
CREATE INDEX IF NOT EXISTS idx_study_documents_subject_id ON public.study_documents(subject_id);

-- Junction table for multi-subject tagging (optional, for future enhancement)
CREATE TABLE IF NOT EXISTS public.study_material_subjects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  study_document_id UUID NOT NULL REFERENCES public.study_documents(id) ON DELETE CASCADE,
  subject_id UUID NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.study_material_subjects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own material subjects"
  ON public.study_material_subjects
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own material subjects"
  ON public.study_material_subjects
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own material subjects"
  ON public.study_material_subjects
  FOR DELETE
  USING (auth.uid() = user_id);

CREATE INDEX idx_study_material_subjects_user_id ON public.study_material_subjects(user_id);
CREATE INDEX idx_study_material_subjects_document_id ON public.study_material_subjects(study_document_id);
CREATE INDEX idx_study_material_subjects_subject_id ON public.study_material_subjects(subject_id);
CREATE UNIQUE INDEX idx_study_material_subjects_unique ON public.study_material_subjects(study_document_id, subject_id);


-- ============================================================================
-- 4. TIME-SPENT TRACKING
-- ============================================================================

-- Individual session records (active/paused/completed)
CREATE TABLE IF NOT EXISTS public.study_time_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subject_id UUID REFERENCES public.subjects(id) ON DELETE SET NULL,
  content_type TEXT CHECK (content_type IN ('lesson', 'flashcard', 'quiz', 'document', 'general')),
  content_id UUID,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed')),
  total_duration_seconds INTEGER DEFAULT 0,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  paused_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.study_time_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own time sessions"
  ON public.study_time_sessions
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own time sessions"
  ON public.study_time_sessions
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own time sessions"
  ON public.study_time_sessions
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own time sessions"
  ON public.study_time_sessions
  FOR DELETE
  USING (auth.uid() = user_id);

CREATE INDEX idx_study_time_sessions_user_id ON public.study_time_sessions(user_id);
CREATE INDEX idx_study_time_sessions_subject_id ON public.study_time_sessions(subject_id);
CREATE INDEX idx_study_time_sessions_status ON public.study_time_sessions(status);
CREATE INDEX idx_study_time_sessions_started_at ON public.study_time_sessions(started_at DESC);

CREATE OR REPLACE FUNCTION update_study_time_sessions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER study_time_sessions_updated_at_trigger
  BEFORE UPDATE ON public.study_time_sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_study_time_sessions_updated_at();


-- Daily aggregates per user/subject
CREATE TABLE IF NOT EXISTS public.study_time_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subject_id UUID REFERENCES public.subjects(id) ON DELETE SET NULL,
  study_date DATE NOT NULL,
  total_minutes INTEGER DEFAULT 0,
  session_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.study_time_analytics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own time analytics"
  ON public.study_time_analytics
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own time analytics"
  ON public.study_time_analytics
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own time analytics"
  ON public.study_time_analytics
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE INDEX idx_study_time_analytics_user_id ON public.study_time_analytics(user_id);
CREATE INDEX idx_study_time_analytics_subject_id ON public.study_time_analytics(subject_id);
CREATE INDEX idx_study_time_analytics_study_date ON public.study_time_analytics(study_date DESC);
CREATE UNIQUE INDEX idx_study_time_analytics_unique ON public.study_time_analytics(user_id, subject_id, study_date);

CREATE OR REPLACE FUNCTION update_study_time_analytics_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER study_time_analytics_updated_at_trigger
  BEFORE UPDATE ON public.study_time_analytics
  FOR EACH ROW
  EXECUTE FUNCTION update_study_time_analytics_updated_at();


-- Weekly/monthly rollups
CREATE TABLE IF NOT EXISTS public.study_time_trends (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subject_id UUID REFERENCES public.subjects(id) ON DELETE SET NULL,
  period TEXT NOT NULL CHECK (period IN ('week', 'month')),
  period_start_date DATE NOT NULL,
  period_end_date DATE NOT NULL,
  total_minutes INTEGER DEFAULT 0,
  average_daily_minutes NUMERIC(5, 2) DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.study_time_trends ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own time trends"
  ON public.study_time_trends
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own time trends"
  ON public.study_time_trends
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own time trends"
  ON public.study_time_trends
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE INDEX idx_study_time_trends_user_id ON public.study_time_trends(user_id);
CREATE INDEX idx_study_time_trends_subject_id ON public.study_time_trends(subject_id);
CREATE INDEX idx_study_time_trends_period ON public.study_time_trends(period_start_date DESC);

CREATE OR REPLACE FUNCTION update_study_time_trends_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER study_time_trends_updated_at_trigger
  BEFORE UPDATE ON public.study_time_trends
  FOR EACH ROW
  EXECUTE FUNCTION update_study_time_trends_updated_at();


-- ============================================================================
-- 5. CONTEXT-AWARE AI CHAT
-- ============================================================================

-- Track active context per conversation
CREATE TABLE IF NOT EXISTS public.chat_context_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL REFERENCES public.chat_conversations(id) ON DELETE CASCADE,
  subject_id UUID REFERENCES public.subjects(id) ON DELETE SET NULL,
  active_lesson_id UUID,
  active_document_id UUID REFERENCES public.study_documents(id) ON DELETE SET NULL,
  active_quiz_id UUID REFERENCES public.quizzes(id) ON DELETE SET NULL,
  active_flashcard_id UUID REFERENCES public.flashcards(id) ON DELETE SET NULL,
  context_data JSONB DEFAULT '{}',
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.chat_context_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own chat contexts"
  ON public.chat_context_sessions
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own chat contexts"
  ON public.chat_context_sessions
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own chat contexts"
  ON public.chat_context_sessions
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own chat contexts"
  ON public.chat_context_sessions
  FOR DELETE
  USING (auth.uid() = user_id);

CREATE INDEX idx_chat_context_sessions_user_id ON public.chat_context_sessions(user_id);
CREATE INDEX idx_chat_context_sessions_conversation_id ON public.chat_context_sessions(conversation_id);
CREATE INDEX idx_chat_context_sessions_subject_id ON public.chat_context_sessions(subject_id);

CREATE OR REPLACE FUNCTION update_chat_context_sessions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER chat_context_sessions_updated_at_trigger
  BEFORE UPDATE ON public.chat_context_sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_chat_context_sessions_updated_at();


-- Store references to materials used in chat
CREATE TABLE IF NOT EXISTS public.ai_context_references (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message_id UUID NOT NULL,
  conversation_id UUID NOT NULL REFERENCES public.chat_conversations(id) ON DELETE CASCADE,
  reference_type TEXT NOT NULL CHECK (reference_type IN ('lesson', 'document', 'flashcard', 'quiz', 'subject')),
  reference_id UUID,
  excerpt TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_context_references ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own context references"
  ON public.ai_context_references
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own context references"
  ON public.ai_context_references
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own context references"
  ON public.ai_context_references
  FOR DELETE
  USING (auth.uid() = user_id);

CREATE INDEX idx_ai_context_references_user_id ON public.ai_context_references(user_id);
CREATE INDEX idx_ai_context_references_conversation_id ON public.ai_context_references(conversation_id);
CREATE INDEX idx_ai_context_references_message_id ON public.ai_context_references(message_id);


-- ============================================================================
-- 6. FLASHCARD AI EXPLANATION CACHE
-- ============================================================================

-- Cache generated explanations by style
CREATE TABLE IF NOT EXISTS public.flashcard_ai_explanations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  flashcard_id UUID NOT NULL REFERENCES public.flashcards(id) ON DELETE CASCADE,
  explanation_style TEXT NOT NULL DEFAULT 'simple' CHECK (explanation_style IN ('simple', 'detailed', 'analogy', 'visual')),
  explanation_text TEXT NOT NULL,
  rating INTEGER CHECK (rating IN (1, 2, 3, 4, 5)),
  user_feedback TEXT,
  usage_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.flashcard_ai_explanations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own explanations"
  ON public.flashcard_ai_explanations
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own explanations"
  ON public.flashcard_ai_explanations
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own explanations"
  ON public.flashcard_ai_explanations
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE INDEX idx_flashcard_ai_explanations_user_id ON public.flashcard_ai_explanations(user_id);
CREATE INDEX idx_flashcard_ai_explanations_flashcard_id ON public.flashcard_ai_explanations(flashcard_id);
CREATE UNIQUE INDEX idx_flashcard_ai_explanations_unique ON public.flashcard_ai_explanations(flashcard_id, explanation_style);

CREATE OR REPLACE FUNCTION update_flashcard_ai_explanations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER flashcard_ai_explanations_updated_at_trigger
  BEFORE UPDATE ON public.flashcard_ai_explanations
  FOR EACH ROW
  EXECUTE FUNCTION update_flashcard_ai_explanations_updated_at();


-- ============================================================================
-- 7. ANALYTICS AGGREGATION TABLES
-- ============================================================================

-- Enhance study_analytics table with additional columns
ALTER TABLE public.study_analytics 
ADD COLUMN IF NOT EXISTS subject_id UUID REFERENCES public.subjects(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS content_type TEXT,
ADD COLUMN IF NOT EXISTS flashcard_count INTEGER DEFAULT 0;

-- Create index on new columns
CREATE INDEX IF NOT EXISTS idx_study_analytics_subject_id ON public.study_analytics(subject_id);
CREATE INDEX IF NOT EXISTS idx_study_analytics_content_type ON public.study_analytics(content_type);

-- Per-subject dashboard data
CREATE TABLE IF NOT EXISTS public.subject_analytics_summary (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subject_id UUID NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  total_study_minutes INTEGER DEFAULT 0,
  total_quizzes_taken INTEGER DEFAULT 0,
  average_quiz_score NUMERIC(5, 2) DEFAULT 0,
  total_flashcards_mastered INTEGER DEFAULT 0,
  total_flashcards_created INTEGER DEFAULT 0,
  last_studied_at TIMESTAMPTZ,
  progress_percentage NUMERIC(5, 2) DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.subject_analytics_summary ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own subject analytics"
  ON public.subject_analytics_summary
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own subject analytics"
  ON public.subject_analytics_summary
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own subject analytics"
  ON public.subject_analytics_summary
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE INDEX idx_subject_analytics_summary_user_id ON public.subject_analytics_summary(user_id);
CREATE INDEX idx_subject_analytics_summary_subject_id ON public.subject_analytics_summary(subject_id);
CREATE UNIQUE INDEX idx_subject_analytics_summary_unique ON public.subject_analytics_summary(user_id, subject_id);

CREATE OR REPLACE FUNCTION update_subject_analytics_summary_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER subject_analytics_summary_updated_at_trigger
  BEFORE UPDATE ON public.subject_analytics_summary
  FOR EACH ROW
  EXECUTE FUNCTION update_subject_analytics_summary_updated_at();

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
