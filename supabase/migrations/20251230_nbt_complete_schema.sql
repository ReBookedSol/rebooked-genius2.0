-- =====================================================
-- NBT COMPLETE SCHEMA - PASTE THIS ENTIRE FILE INTO SUPABASE SQL EDITOR
-- =====================================================

-- 1. NBT STUDY MATERIALS TABLE (supports text, PDFs, images, mixed content)
CREATE TABLE IF NOT EXISTS public.nbt_study_materials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  content TEXT,
  section TEXT NOT NULL CHECK (section IN ('AQL', 'MAT', 'QL')),
  topic TEXT NOT NULL,
  material_type TEXT NOT NULL CHECK (material_type IN ('notes', 'tips', 'formula', 'strategy', 'example', 'pdf', 'image', 'video')),
  content_url TEXT,
  file_type TEXT,
  file_size INTEGER,
  order_index INTEGER,
  is_published BOOLEAN DEFAULT false,
  is_official BOOLEAN DEFAULT false,
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.nbt_study_materials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view published study materials"
ON public.nbt_study_materials FOR SELECT
USING (is_published = true OR auth.uid() = user_id);

CREATE POLICY "Users can create own study materials"
ON public.nbt_study_materials FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own study materials"
ON public.nbt_study_materials FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own study materials"
ON public.nbt_study_materials FOR DELETE
USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all study materials"
ON public.nbt_study_materials FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS idx_nbt_study_materials_section ON public.nbt_study_materials(section);
CREATE INDEX IF NOT EXISTS idx_nbt_study_materials_topic ON public.nbt_study_materials(topic);
CREATE INDEX IF NOT EXISTS idx_nbt_study_materials_user ON public.nbt_study_materials(user_id);
CREATE INDEX IF NOT EXISTS idx_nbt_study_materials_published ON public.nbt_study_materials(is_published);

-- 2. NBT QUESTION COLLECTIONS (groups related questions together)
CREATE TABLE IF NOT EXISTS public.nbt_question_collections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  section TEXT NOT NULL CHECK (section IN ('AQL', 'MAT', 'QL')),
  topic TEXT NOT NULL,
  question_count INTEGER DEFAULT 0,
  difficulty TEXT CHECK (difficulty IN ('easy', 'medium', 'hard', 'mixed')),
  is_published BOOLEAN DEFAULT false,
  is_official BOOLEAN DEFAULT false,
  tags TEXT[] DEFAULT '{}',
  order_index INTEGER,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.nbt_question_collections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view published collections"
ON public.nbt_question_collections FOR SELECT
USING (is_published = true OR auth.uid() = user_id);

CREATE POLICY "Users can create own collections"
ON public.nbt_question_collections FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own collections"
ON public.nbt_question_collections FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own collections"
ON public.nbt_question_collections FOR DELETE
USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all collections"
ON public.nbt_question_collections FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS idx_nbt_collections_section ON public.nbt_question_collections(section);
CREATE INDEX IF NOT EXISTS idx_nbt_collections_topic ON public.nbt_question_collections(topic);
CREATE INDEX IF NOT EXISTS idx_nbt_collections_user ON public.nbt_question_collections(user_id);

-- 3. NBT PRACTICE QUESTIONS (individual questions - grouped by collection)
CREATE TABLE IF NOT EXISTS public.nbt_practice_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id UUID REFERENCES public.nbt_question_collections(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  question_text TEXT NOT NULL,
  section TEXT NOT NULL CHECK (section IN ('AQL', 'MAT', 'QL')),
  topic TEXT,
  difficulty TEXT NOT NULL CHECK (difficulty IN ('easy', 'medium', 'hard')),
  question_type TEXT NOT NULL CHECK (question_type IN ('multiple_choice', 'true_false', 'short_answer', 'long_answer')),
  options JSONB DEFAULT '[]',
  correct_answer TEXT NOT NULL,
  correct_answer_index INTEGER,
  explanation TEXT,
  hint TEXT,
  points INTEGER DEFAULT 1,
  question_image_url TEXT,
  is_published BOOLEAN DEFAULT false,
  is_official BOOLEAN DEFAULT false,
  tags TEXT[] DEFAULT '{}',
  order_index INTEGER,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.nbt_practice_questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view published questions"
ON public.nbt_practice_questions FOR SELECT
USING (is_published = true OR auth.uid() = user_id);

CREATE POLICY "Users can create own questions"
ON public.nbt_practice_questions FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own questions"
ON public.nbt_practice_questions FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own questions"
ON public.nbt_practice_questions FOR DELETE
USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all questions"
ON public.nbt_practice_questions FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS idx_nbt_practice_collection ON public.nbt_practice_questions(collection_id);
CREATE INDEX IF NOT EXISTS idx_nbt_practice_section ON public.nbt_practice_questions(section);
CREATE INDEX IF NOT EXISTS idx_nbt_practice_topic ON public.nbt_practice_questions(topic);
CREATE INDEX IF NOT EXISTS idx_nbt_practice_user ON public.nbt_practice_questions(user_id);

-- 4. NBT DATA INTERPRETATION QUESTIONS (with image support)
CREATE TABLE IF NOT EXISTS public.nbt_data_interpretation (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id UUID REFERENCES public.nbt_question_collections(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  section TEXT NOT NULL CHECK (section IN ('AQL', 'MAT', 'QL')),
  topic TEXT,
  data_image_url TEXT NOT NULL,
  data_image_type TEXT CHECK (data_image_type IN ('graph', 'chart', 'table', 'diagram', 'photograph')),
  difficulty TEXT NOT NULL CHECK (difficulty IN ('easy', 'medium', 'hard')),
  question_count INTEGER DEFAULT 0,
  is_published BOOLEAN DEFAULT false,
  is_official BOOLEAN DEFAULT false,
  tags TEXT[] DEFAULT '{}',
  order_index INTEGER,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.nbt_data_interpretation ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view published data interpretation"
ON public.nbt_data_interpretation FOR SELECT
USING (is_published = true OR auth.uid() = user_id);

CREATE POLICY "Users can create own data interpretation"
ON public.nbt_data_interpretation FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own data interpretation"
ON public.nbt_data_interpretation FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own data interpretation"
ON public.nbt_data_interpretation FOR DELETE
USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all data interpretation"
ON public.nbt_data_interpretation FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS idx_nbt_data_collection ON public.nbt_data_interpretation(collection_id);
CREATE INDEX IF NOT EXISTS idx_nbt_data_section ON public.nbt_data_interpretation(section);
CREATE INDEX IF NOT EXISTS idx_nbt_data_user ON public.nbt_data_interpretation(user_id);

-- 5. DATA INTERPRETATION QUESTIONS (individual questions per data set)
CREATE TABLE IF NOT EXISTS public.nbt_data_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  data_interpretation_id UUID NOT NULL REFERENCES public.nbt_data_interpretation(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  question_text TEXT NOT NULL,
  question_type TEXT NOT NULL CHECK (question_type IN ('multiple_choice', 'short_answer', 'true_false')),
  options JSONB DEFAULT '[]',
  correct_answer TEXT NOT NULL,
  correct_answer_index INTEGER,
  explanation TEXT,
  points INTEGER DEFAULT 1,
  order_index INTEGER,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.nbt_data_questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view published data questions"
ON public.nbt_data_questions FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.nbt_data_interpretation 
  WHERE nbt_data_interpretation.id = nbt_data_questions.data_interpretation_id 
  AND (nbt_data_interpretation.is_published = true OR nbt_data_interpretation.user_id = auth.uid())
));

CREATE POLICY "Users can create own data questions"
ON public.nbt_data_questions FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own data questions"
ON public.nbt_data_questions FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own data questions"
ON public.nbt_data_questions FOR DELETE
USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_nbt_data_questions_data ON public.nbt_data_questions(data_interpretation_id);
CREATE INDEX IF NOT EXISTS idx_nbt_data_questions_user ON public.nbt_data_questions(user_id);

-- 6. PRACTICE ATTEMPTS (track individual question attempts)
CREATE TABLE IF NOT EXISTS public.nbt_practice_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES public.nbt_practice_questions(id) ON DELETE CASCADE,
  section TEXT NOT NULL CHECK (section IN ('AQL', 'MAT', 'QL')),
  user_answer TEXT,
  is_correct BOOLEAN,
  time_taken_seconds INTEGER,
  started_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.nbt_practice_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own attempts"
ON public.nbt_practice_attempts FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create own attempts"
ON public.nbt_practice_attempts FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_nbt_practice_attempts_user ON public.nbt_practice_attempts(user_id);
CREATE INDEX IF NOT EXISTS idx_nbt_practice_attempts_question ON public.nbt_practice_attempts(question_id);

-- 7. DATA INTERPRETATION ATTEMPTS (track individual data question attempts)
CREATE TABLE IF NOT EXISTS public.nbt_data_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  data_question_id UUID NOT NULL REFERENCES public.nbt_data_questions(id) ON DELETE CASCADE,
  user_answer TEXT,
  is_correct BOOLEAN,
  time_taken_seconds INTEGER,
  started_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.nbt_data_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own data attempts"
ON public.nbt_data_attempts FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create own data attempts"
ON public.nbt_data_attempts FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_nbt_data_attempts_user ON public.nbt_data_attempts(user_id);
CREATE INDEX IF NOT EXISTS idx_nbt_data_attempts_question ON public.nbt_data_attempts(data_question_id);

-- 8. PRACTICE TESTS (full mock tests)
CREATE TABLE IF NOT EXISTS public.nbt_practice_tests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  section TEXT CHECK (section IN ('AQL', 'MAT', 'QL', 'FULL')),
  total_questions INTEGER DEFAULT 0,
  time_limit_minutes INTEGER,
  passing_score NUMERIC(5,2) DEFAULT 40,
  is_published BOOLEAN DEFAULT false,
  is_official BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.nbt_practice_tests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view published tests"
ON public.nbt_practice_tests FOR SELECT
USING (is_published = true OR auth.uid() = user_id);

CREATE POLICY "Users can create own tests"
ON public.nbt_practice_tests FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own tests"
ON public.nbt_practice_tests FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all tests"
ON public.nbt_practice_tests FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS idx_nbt_practice_tests_section ON public.nbt_practice_tests(section);
CREATE INDEX IF NOT EXISTS idx_nbt_practice_tests_user ON public.nbt_practice_tests(user_id);

-- 9. TEST QUESTIONS (junction table)
CREATE TABLE IF NOT EXISTS public.nbt_test_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  test_id UUID NOT NULL REFERENCES public.nbt_practice_tests(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES public.nbt_practice_questions(id) ON DELETE CASCADE,
  order_index INTEGER,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(test_id, question_id)
);

ALTER TABLE public.nbt_test_questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view test questions"
ON public.nbt_test_questions FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.nbt_practice_tests 
  WHERE nbt_practice_tests.id = nbt_test_questions.test_id 
  AND (nbt_practice_tests.is_published = true OR nbt_practice_tests.user_id = auth.uid())
));

CREATE INDEX IF NOT EXISTS idx_nbt_test_questions_test ON public.nbt_test_questions(test_id);
CREATE INDEX IF NOT EXISTS idx_nbt_test_questions_question ON public.nbt_test_questions(question_id);

-- 10. TEST ATTEMPTS (full test completion)
CREATE TABLE IF NOT EXISTS public.nbt_test_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  test_id UUID NOT NULL REFERENCES public.nbt_practice_tests(id) ON DELETE CASCADE,
  section TEXT CHECK (section IN ('AQL', 'MAT', 'QL', 'FULL')),
  total_score NUMERIC(5,2),
  max_score NUMERIC(5,2),
  percentage NUMERIC(5,2),
  time_taken_seconds INTEGER,
  answered_questions INTEGER,
  correct_answers INTEGER,
  status TEXT CHECK (status IN ('in_progress', 'completed', 'abandoned')) DEFAULT 'in_progress',
  answers JSONB DEFAULT '{}',
  started_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.nbt_test_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own test attempts"
ON public.nbt_test_attempts FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create own test attempts"
ON public.nbt_test_attempts FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own test attempts"
ON public.nbt_test_attempts FOR UPDATE
USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_nbt_test_attempts_user ON public.nbt_test_attempts(user_id);
CREATE INDEX IF NOT EXISTS idx_nbt_test_attempts_test ON public.nbt_test_attempts(test_id);
CREATE INDEX IF NOT EXISTS idx_nbt_test_attempts_status ON public.nbt_test_attempts(status);

-- 11. USER PROGRESS
CREATE TABLE IF NOT EXISTS public.nbt_user_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  aql_attempts INTEGER DEFAULT 0,
  aql_correct INTEGER DEFAULT 0,
  aql_average_score NUMERIC(5,2) DEFAULT 0,
  mat_attempts INTEGER DEFAULT 0,
  mat_correct INTEGER DEFAULT 0,
  mat_average_score NUMERIC(5,2) DEFAULT 0,
  ql_attempts INTEGER DEFAULT 0,
  ql_correct INTEGER DEFAULT 0,
  ql_average_score NUMERIC(5,2) DEFAULT 0,
  total_test_attempts INTEGER DEFAULT 0,
  best_test_score NUMERIC(5,2),
  last_attempted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.nbt_user_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own progress"
ON public.nbt_user_progress FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create own progress"
ON public.nbt_user_progress FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own progress"
ON public.nbt_user_progress FOR UPDATE
USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_nbt_user_progress_user ON public.nbt_user_progress(user_id);

-- 12. TRIGGER: Update question count on collection
CREATE OR REPLACE FUNCTION public.update_nbt_collection_question_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.nbt_question_collections
  SET 
    question_count = (SELECT COUNT(*) FROM public.nbt_practice_questions WHERE collection_id = COALESCE(NEW.collection_id, OLD.collection_id)),
    updated_at = now()
  WHERE id = COALESCE(NEW.collection_id, OLD.collection_id);
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF NOT EXISTS on_nbt_question_change ON public.nbt_practice_questions;
CREATE TRIGGER on_nbt_question_change
AFTER INSERT OR UPDATE OR DELETE ON public.nbt_practice_questions
FOR EACH ROW
EXECUTE FUNCTION public.update_nbt_collection_question_count();

-- 13. TRIGGER: Update question count on data interpretation
CREATE OR REPLACE FUNCTION public.update_nbt_data_question_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.nbt_data_interpretation
  SET 
    question_count = (SELECT COUNT(*) FROM public.nbt_data_questions WHERE data_interpretation_id = COALESCE(NEW.data_interpretation_id, OLD.data_interpretation_id)),
    updated_at = now()
  WHERE id = COALESCE(NEW.data_interpretation_id, OLD.data_interpretation_id);
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF NOT EXISTS on_nbt_data_question_change ON public.nbt_data_questions;
CREATE TRIGGER on_nbt_data_question_change
AFTER INSERT OR UPDATE OR DELETE ON public.nbt_data_questions
FOR EACH ROW
EXECUTE FUNCTION public.update_nbt_data_question_count();

-- 14. TRIGGER: Update test question count
CREATE OR REPLACE FUNCTION public.update_nbt_test_question_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.nbt_practice_tests
  SET 
    total_questions = (SELECT COUNT(*) FROM public.nbt_test_questions WHERE test_id = COALESCE(NEW.test_id, OLD.test_id)),
    updated_at = now()
  WHERE id = COALESCE(NEW.test_id, OLD.test_id);
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF NOT EXISTS on_nbt_test_question_change ON public.nbt_test_questions;
CREATE TRIGGER on_nbt_test_question_change
AFTER INSERT OR UPDATE OR DELETE ON public.nbt_test_questions
FOR EACH ROW
EXECUTE FUNCTION public.update_nbt_test_question_count();
