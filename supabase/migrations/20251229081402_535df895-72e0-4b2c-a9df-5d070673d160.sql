-- =============================================
-- COMPREHENSIVE SCHEMA UPDATE FOR REBOOKED GENIUS
-- =============================================

-- 1. Storage bucket for user uploads (documents, PDFs, images)
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('user-uploads', 'user-uploads', false, 52428800)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for user uploads
CREATE POLICY "Users can upload their own files"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'user-uploads' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can view their own files"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'user-uploads' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete their own files"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'user-uploads' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- 2. Knowledge Base table - stores AI learning data per user
CREATE TABLE public.knowledge_base (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  content_type TEXT NOT NULL DEFAULT 'text' CHECK (content_type IN ('text', 'document', 'pdf', 'note', 'whiteboard')),
  source_file_url TEXT,
  tags TEXT[] DEFAULT '{}',
  subject_id UUID REFERENCES public.subjects(id) ON DELETE SET NULL,
  is_active BOOLEAN DEFAULT true,
  embedding_status TEXT DEFAULT 'pending' CHECK (embedding_status IN ('pending', 'processing', 'completed', 'failed')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.knowledge_base ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own knowledge"
ON public.knowledge_base FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create own knowledge"
ON public.knowledge_base FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own knowledge"
ON public.knowledge_base FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own knowledge"
ON public.knowledge_base FOR DELETE
USING (auth.uid() = user_id);

CREATE INDEX idx_knowledge_base_user ON public.knowledge_base(user_id);
CREATE INDEX idx_knowledge_base_subject ON public.knowledge_base(subject_id);
CREATE INDEX idx_knowledge_base_tags ON public.knowledge_base USING GIN(tags);

-- 3. Whiteboard data table
CREATE TABLE public.whiteboards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'Untitled Whiteboard',
  canvas_data JSONB DEFAULT '{}',
  thumbnail_url TEXT,
  subject_id UUID REFERENCES public.subjects(id) ON DELETE SET NULL,
  is_shared BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.whiteboards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own whiteboards"
ON public.whiteboards FOR SELECT
USING (auth.uid() = user_id OR is_shared = true);

CREATE POLICY "Users can create own whiteboards"
ON public.whiteboards FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own whiteboards"
ON public.whiteboards FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own whiteboards"
ON public.whiteboards FOR DELETE
USING (auth.uid() = user_id);

-- 4. Flashcard decks table
CREATE TABLE public.flashcard_decks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  subject_id UUID REFERENCES public.subjects(id) ON DELETE SET NULL,
  is_ai_generated BOOLEAN DEFAULT false,
  source_knowledge_id UUID REFERENCES public.knowledge_base(id) ON DELETE SET NULL,
  total_cards INTEGER DEFAULT 0,
  mastered_cards INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.flashcard_decks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own decks"
ON public.flashcard_decks FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create own decks"
ON public.flashcard_decks FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own decks"
ON public.flashcard_decks FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own decks"
ON public.flashcard_decks FOR DELETE
USING (auth.uid() = user_id);

-- 5. Flashcards table
CREATE TABLE public.flashcards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deck_id UUID NOT NULL REFERENCES public.flashcard_decks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  front TEXT NOT NULL,
  back TEXT NOT NULL,
  hint TEXT,
  difficulty TEXT DEFAULT 'medium' CHECK (difficulty IN ('easy', 'medium', 'hard')),
  times_reviewed INTEGER DEFAULT 0,
  times_correct INTEGER DEFAULT 0,
  is_mastered BOOLEAN DEFAULT false,
  next_review_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.flashcards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own flashcards"
ON public.flashcards FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create own flashcards"
ON public.flashcards FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own flashcards"
ON public.flashcards FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own flashcards"
ON public.flashcards FOR DELETE
USING (auth.uid() = user_id);

CREATE INDEX idx_flashcards_deck ON public.flashcards(deck_id);
CREATE INDEX idx_flashcards_user ON public.flashcards(user_id);

-- 6. Quizzes table
CREATE TABLE public.quizzes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  subject_id UUID REFERENCES public.subjects(id) ON DELETE SET NULL,
  is_ai_generated BOOLEAN DEFAULT false,
  source_knowledge_id UUID REFERENCES public.knowledge_base(id) ON DELETE SET NULL,
  total_questions INTEGER DEFAULT 0,
  time_limit_minutes INTEGER,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.quizzes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own quizzes"
ON public.quizzes FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create own quizzes"
ON public.quizzes FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own quizzes"
ON public.quizzes FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own quizzes"
ON public.quizzes FOR DELETE
USING (auth.uid() = user_id);

-- 7. Quiz questions table
CREATE TABLE public.quiz_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id UUID NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  question_type TEXT NOT NULL DEFAULT 'multiple_choice' CHECK (question_type IN ('multiple_choice', 'true_false', 'short_answer', 'long_answer')),
  options JSONB DEFAULT '[]',
  correct_answer TEXT NOT NULL,
  explanation TEXT,
  points INTEGER DEFAULT 1,
  order_index INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.quiz_questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view quiz questions"
ON public.quiz_questions FOR SELECT
USING (EXISTS (SELECT 1 FROM public.quizzes WHERE quizzes.id = quiz_questions.quiz_id AND quizzes.user_id = auth.uid()));

CREATE POLICY "Users can create quiz questions"
ON public.quiz_questions FOR INSERT
WITH CHECK (EXISTS (SELECT 1 FROM public.quizzes WHERE quizzes.id = quiz_questions.quiz_id AND quizzes.user_id = auth.uid()));

CREATE POLICY "Users can update quiz questions"
ON public.quiz_questions FOR UPDATE
USING (EXISTS (SELECT 1 FROM public.quizzes WHERE quizzes.id = quiz_questions.quiz_id AND quizzes.user_id = auth.uid()));

CREATE POLICY "Users can delete quiz questions"
ON public.quiz_questions FOR DELETE
USING (EXISTS (SELECT 1 FROM public.quizzes WHERE quizzes.id = quiz_questions.quiz_id AND quizzes.user_id = auth.uid()));

CREATE INDEX idx_quiz_questions_quiz ON public.quiz_questions(quiz_id);

-- 8. Quiz attempts table
CREATE TABLE public.quiz_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id UUID NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  score NUMERIC(5,2),
  max_score NUMERIC(5,2),
  percentage NUMERIC(5,2),
  time_taken_seconds INTEGER,
  answers JSONB DEFAULT '{}',
  started_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ
);

ALTER TABLE public.quiz_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own attempts"
ON public.quiz_attempts FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create own attempts"
ON public.quiz_attempts FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own attempts"
ON public.quiz_attempts FOR UPDATE
USING (auth.uid() = user_id);

CREATE INDEX idx_quiz_attempts_user ON public.quiz_attempts(user_id);
CREATE INDEX idx_quiz_attempts_quiz ON public.quiz_attempts(quiz_id);

-- 9. Study sessions table
CREATE TABLE public.study_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subject_id UUID REFERENCES public.subjects(id) ON DELETE SET NULL,
  title TEXT,
  duration_minutes INTEGER DEFAULT 0,
  break_time_minutes INTEGER DEFAULT 0,
  status TEXT DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'paused', 'completed', 'cancelled')),
  started_at TIMESTAMPTZ DEFAULT now(),
  ended_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.study_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own sessions"
ON public.study_sessions FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create own sessions"
ON public.study_sessions FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own sessions"
ON public.study_sessions FOR UPDATE
USING (auth.uid() = user_id);

CREATE INDEX idx_study_sessions_user ON public.study_sessions(user_id);
CREATE INDEX idx_study_sessions_started ON public.study_sessions(started_at);

-- 10. Achievements/Badges table
CREATE TABLE public.achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL,
  icon_name TEXT,
  category TEXT NOT NULL CHECK (category IN ('study', 'quiz', 'streak', 'flashcard', 'social', 'milestone')),
  points INTEGER DEFAULT 10,
  requirement_type TEXT NOT NULL,
  requirement_value INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.achievements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view achievements"
ON public.achievements FOR SELECT
USING (true);

-- 11. User achievements table
CREATE TABLE public.user_achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  achievement_id UUID NOT NULL REFERENCES public.achievements(id) ON DELETE CASCADE,
  unlocked_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, achievement_id)
);

ALTER TABLE public.user_achievements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own achievements"
ON public.user_achievements FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "System can insert achievements"
ON public.user_achievements FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_user_achievements_user ON public.user_achievements(user_id);

-- 12. User points/gamification table
CREATE TABLE public.user_points (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  total_points INTEGER DEFAULT 0,
  current_streak INTEGER DEFAULT 0,
  longest_streak INTEGER DEFAULT 0,
  last_activity_date DATE,
  level INTEGER DEFAULT 1,
  xp_to_next_level INTEGER DEFAULT 100,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.user_points ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own points"
ON public.user_points FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create own points"
ON public.user_points FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own points"
ON public.user_points FOR UPDATE
USING (auth.uid() = user_id);

-- 13. PDF annotations table
CREATE TABLE public.pdf_annotations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  document_id UUID REFERENCES public.documents(id) ON DELETE CASCADE,
  file_url TEXT,
  page_number INTEGER NOT NULL,
  annotation_type TEXT NOT NULL CHECK (annotation_type IN ('highlight', 'note', 'underline', 'strikethrough', 'drawing')),
  content TEXT,
  color TEXT DEFAULT '#FFFF00',
  position JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.pdf_annotations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own annotations"
ON public.pdf_annotations FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create own annotations"
ON public.pdf_annotations FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own annotations"
ON public.pdf_annotations FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own annotations"
ON public.pdf_annotations FOR DELETE
USING (auth.uid() = user_id);

CREATE INDEX idx_pdf_annotations_user ON public.pdf_annotations(user_id);
CREATE INDEX idx_pdf_annotations_document ON public.pdf_annotations(document_id);

-- 14. AI chat knowledge context (links chat to knowledge base)
ALTER TABLE public.chat_conversations 
ADD COLUMN IF NOT EXISTS knowledge_context JSONB DEFAULT '[]',
ADD COLUMN IF NOT EXISTS ai_model TEXT DEFAULT 'gpt-4o-mini';

-- 15. Insert default achievements
INSERT INTO public.achievements (name, description, icon_name, category, points, requirement_type, requirement_value) VALUES
('First Steps', 'Complete your first study session', 'footprints', 'study', 10, 'study_sessions', 1),
('Study Bug', 'Complete 10 study sessions', 'bug', 'study', 25, 'study_sessions', 10),
('Study Master', 'Complete 50 study sessions', 'graduation-cap', 'study', 100, 'study_sessions', 50),
('Quiz Beginner', 'Complete your first quiz', 'help-circle', 'quiz', 10, 'quizzes_completed', 1),
('Quiz Whiz', 'Complete 25 quizzes', 'brain', 'quiz', 50, 'quizzes_completed', 25),
('Perfect Score', 'Get 100% on a quiz', 'trophy', 'quiz', 50, 'perfect_quizzes', 1),
('3 Day Streak', 'Study for 3 days in a row', 'flame', 'streak', 15, 'streak_days', 3),
('Week Warrior', 'Study for 7 days in a row', 'flame', 'streak', 35, 'streak_days', 7),
('Month Master', 'Study for 30 days in a row', 'flame', 'streak', 150, 'streak_days', 30),
('Card Collector', 'Create 50 flashcards', 'layers', 'flashcard', 25, 'flashcards_created', 50),
('Memory Champion', 'Master 100 flashcards', 'award', 'flashcard', 75, 'flashcards_mastered', 100),
('Hour Hero', 'Study for 10 hours total', 'clock', 'milestone', 50, 'total_study_minutes', 600),
('Centurion', 'Study for 100 hours total', 'star', 'milestone', 200, 'total_study_minutes', 6000);

-- 16. Create trigger to update user points on study session completion
CREATE OR REPLACE FUNCTION public.update_user_streak()
RETURNS TRIGGER AS $$
DECLARE
  last_date DATE;
  current_date_val DATE := CURRENT_DATE;
BEGIN
  -- Get or create user points record
  INSERT INTO public.user_points (user_id, total_points, current_streak, longest_streak, last_activity_date)
  VALUES (NEW.user_id, 0, 0, 0, NULL)
  ON CONFLICT (user_id) DO NOTHING;

  -- Update streak logic
  SELECT last_activity_date INTO last_date
  FROM public.user_points
  WHERE user_id = NEW.user_id;

  IF last_date IS NULL OR last_date < current_date_val - INTERVAL '1 day' THEN
    -- Reset streak
    UPDATE public.user_points
    SET current_streak = 1, 
        last_activity_date = current_date_val,
        updated_at = now()
    WHERE user_id = NEW.user_id;
  ELSIF last_date = current_date_val - INTERVAL '1 day' THEN
    -- Continue streak
    UPDATE public.user_points
    SET current_streak = current_streak + 1,
        longest_streak = GREATEST(longest_streak, current_streak + 1),
        last_activity_date = current_date_val,
        updated_at = now()
    WHERE user_id = NEW.user_id;
  ELSE
    -- Same day, just update the date
    UPDATE public.user_points
    SET last_activity_date = current_date_val,
        updated_at = now()
    WHERE user_id = NEW.user_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_study_session_complete
AFTER INSERT OR UPDATE ON public.study_sessions
FOR EACH ROW
WHEN (NEW.status = 'completed')
EXECUTE FUNCTION public.update_user_streak();

-- 17. Trigger to update flashcard deck stats
CREATE OR REPLACE FUNCTION public.update_deck_stats()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.flashcard_decks
  SET 
    total_cards = (SELECT COUNT(*) FROM public.flashcards WHERE deck_id = COALESCE(NEW.deck_id, OLD.deck_id)),
    mastered_cards = (SELECT COUNT(*) FROM public.flashcards WHERE deck_id = COALESCE(NEW.deck_id, OLD.deck_id) AND is_mastered = true),
    updated_at = now()
  WHERE id = COALESCE(NEW.deck_id, OLD.deck_id);
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_flashcard_change
AFTER INSERT OR UPDATE OR DELETE ON public.flashcards
FOR EACH ROW
EXECUTE FUNCTION public.update_deck_stats();

-- 18. Trigger to update quiz question count
CREATE OR REPLACE FUNCTION public.update_quiz_question_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.quizzes
  SET 
    total_questions = (SELECT COUNT(*) FROM public.quiz_questions WHERE quiz_id = COALESCE(NEW.quiz_id, OLD.quiz_id)),
    updated_at = now()
  WHERE id = COALESCE(NEW.quiz_id, OLD.quiz_id);
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_quiz_question_change
AFTER INSERT OR UPDATE OR DELETE ON public.quiz_questions
FOR EACH ROW
EXECUTE FUNCTION public.update_quiz_question_count();