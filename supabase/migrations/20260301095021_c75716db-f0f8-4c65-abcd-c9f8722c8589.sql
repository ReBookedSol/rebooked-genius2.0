
-- 1. Create nbt_generated_lessons table for persisting generated lessons
CREATE TABLE IF NOT EXISTS public.nbt_generated_lessons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source_document_id UUID REFERENCES public.nbt_user_documents(id) ON DELETE SET NULL,
  source_material_id UUID REFERENCES public.nbt_study_materials(id) ON DELETE SET NULL,
  section TEXT NOT NULL CHECK (section IN ('AQL', 'MAT', 'QL')),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS for nbt_generated_lessons
ALTER TABLE public.nbt_generated_lessons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own generated lessons"
  ON public.nbt_generated_lessons FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own generated lessons"
  ON public.nbt_generated_lessons FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own generated lessons"
  ON public.nbt_generated_lessons FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own generated lessons"
  ON public.nbt_generated_lessons FOR DELETE
  USING (auth.uid() = user_id);

CREATE INDEX idx_nbt_generated_lessons_user ON public.nbt_generated_lessons(user_id);
CREATE INDEX idx_nbt_generated_lessons_source_doc ON public.nbt_generated_lessons(source_document_id);
CREATE INDEX idx_nbt_generated_lessons_section ON public.nbt_generated_lessons(section);

-- 2. Add nbt_lesson_id to nbt_question_collections to link quizzes/exams to specific lessons
ALTER TABLE public.nbt_question_collections
  ADD COLUMN IF NOT EXISTS nbt_lesson_id UUID REFERENCES public.nbt_generated_lessons(id) ON DELETE SET NULL;

-- 3. Add nbt_lesson_id to flashcard_decks to link flashcards to specific lessons
ALTER TABLE public.flashcard_decks
  ADD COLUMN IF NOT EXISTS nbt_lesson_id UUID REFERENCES public.nbt_generated_lessons(id) ON DELETE SET NULL;

-- 4. Create graph_practice_history for tracking past graph practice sessions
CREATE TABLE IF NOT EXISTS public.graph_practice_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  graph_type TEXT NOT NULL,
  difficulty TEXT NOT NULL DEFAULT 'medium',
  total_questions INTEGER NOT NULL DEFAULT 0,
  correct_answers INTEGER NOT NULL DEFAULT 0,
  score_percentage NUMERIC NOT NULL DEFAULT 0,
  time_taken_seconds INTEGER DEFAULT 0,
  questions_data JSONB,
  completed_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.graph_practice_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own graph practice history"
  ON public.graph_practice_history FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own graph practice history"
  ON public.graph_practice_history FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_graph_practice_history_user ON public.graph_practice_history(user_id);
CREATE INDEX idx_graph_practice_history_type ON public.graph_practice_history(graph_type);

-- 5. Updated_at trigger for nbt_generated_lessons
CREATE OR REPLACE FUNCTION public.update_nbt_generated_lessons_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_nbt_generated_lessons_updated_at
  BEFORE UPDATE ON public.nbt_generated_lessons
  FOR EACH ROW
  EXECUTE FUNCTION public.update_nbt_generated_lessons_updated_at();
