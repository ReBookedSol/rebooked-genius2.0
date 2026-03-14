-- =============================================
-- NBT (NATIONAL BENCHMARK TEST) TABLES
-- =============================================

-- 1. NBT Study Materials table
CREATE TABLE public.nbt_study_materials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  content TEXT NOT NULL,
  section TEXT NOT NULL CHECK (section IN ('AQL', 'MAT', 'QL')) DEFAULT 'AQL',
  topic TEXT NOT NULL,
  material_type TEXT NOT NULL CHECK (material_type IN ('notes', 'tips', 'formula', 'strategy', 'example')) DEFAULT 'notes',
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

CREATE INDEX idx_nbt_study_materials_section ON public.nbt_study_materials(section);
CREATE INDEX idx_nbt_study_materials_topic ON public.nbt_study_materials(topic);
CREATE INDEX idx_nbt_study_materials_user ON public.nbt_study_materials(user_id);
CREATE INDEX idx_nbt_study_materials_published ON public.nbt_study_materials(is_published);

-- 2. NBT Practice Questions table
CREATE TABLE public.nbt_practice_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  question_text TEXT NOT NULL,
  section TEXT NOT NULL CHECK (section IN ('AQL', 'MAT', 'QL')) DEFAULT 'AQL',
  topic TEXT,
  difficulty TEXT NOT NULL CHECK (difficulty IN ('easy', 'medium', 'hard')) DEFAULT 'medium',
  question_type TEXT NOT NULL CHECK (question_type IN ('multiple_choice', 'true_false', 'short_answer', 'data_interpretation')) DEFAULT 'multiple_choice',
  options JSONB DEFAULT '[]',
  correct_answer TEXT NOT NULL,
  correct_answer_index INTEGER,
  explanation TEXT,
  hint TEXT,
  points INTEGER DEFAULT 1,
  is_published BOOLEAN DEFAULT false,
  is_official BOOLEAN DEFAULT false,
  tags TEXT[] DEFAULT '{}',
  order_index INTEGER,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.nbt_practice_questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view published practice questions"
ON public.nbt_practice_questions FOR SELECT
USING (is_published = true OR auth.uid() = user_id);

CREATE POLICY "Users can create own practice questions"
ON public.nbt_practice_questions FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own practice questions"
ON public.nbt_practice_questions FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own practice questions"
ON public.nbt_practice_questions FOR DELETE
USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all practice questions"
ON public.nbt_practice_questions FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_nbt_practice_section ON public.nbt_practice_questions(section);
CREATE INDEX idx_nbt_practice_topic ON public.nbt_practice_questions(topic);
CREATE INDEX idx_nbt_practice_user ON public.nbt_practice_questions(user_id);
CREATE INDEX idx_nbt_practice_published ON public.nbt_practice_questions(is_published);

-- 3. NBT Practice Attempts table (tracks user attempts at practice questions)
CREATE TABLE public.nbt_practice_attempts (
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

CREATE POLICY "Users can update own attempts"
ON public.nbt_practice_attempts FOR UPDATE
USING (auth.uid() = user_id);

CREATE INDEX idx_nbt_practice_attempts_user ON public.nbt_practice_attempts(user_id);
CREATE INDEX idx_nbt_practice_attempts_question ON public.nbt_practice_attempts(question_id);
CREATE INDEX idx_nbt_practice_attempts_section ON public.nbt_practice_attempts(section);

-- 4. NBT Practice Tests (full tests combining multiple questions)
CREATE TABLE public.nbt_practice_tests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  section TEXT CHECK (section IN ('AQL', 'MAT', 'QL', 'FULL')) DEFAULT 'FULL',
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

CREATE POLICY "Users can delete own tests"
ON public.nbt_practice_tests FOR DELETE
USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all tests"
ON public.nbt_practice_tests FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_nbt_practice_tests_section ON public.nbt_practice_tests(section);
CREATE INDEX idx_nbt_practice_tests_user ON public.nbt_practice_tests(user_id);

-- 5. NBT Test Questions (junction table - maps questions to tests)
CREATE TABLE public.nbt_test_questions (
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
USING (EXISTS (SELECT 1 FROM public.nbt_practice_tests WHERE nbt_practice_tests.id = nbt_test_questions.test_id AND (nbt_practice_tests.is_published = true OR nbt_practice_tests.user_id = auth.uid())));

CREATE INDEX idx_nbt_test_questions_test ON public.nbt_test_questions(test_id);
CREATE INDEX idx_nbt_test_questions_question ON public.nbt_test_questions(question_id);

-- 6. NBT Test Attempts (user attempts at full tests)
CREATE TABLE public.nbt_test_attempts (
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

CREATE INDEX idx_nbt_test_attempts_user ON public.nbt_test_attempts(user_id);
CREATE INDEX idx_nbt_test_attempts_test ON public.nbt_test_attempts(test_id);
CREATE INDEX idx_nbt_test_attempts_status ON public.nbt_test_attempts(status);

-- 7. NBT User Progress (summary of user's NBT progress)
CREATE TABLE public.nbt_user_progress (
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

CREATE INDEX idx_nbt_user_progress_user ON public.nbt_user_progress(user_id);

-- 8. Trigger to update test question count
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

CREATE TRIGGER on_nbt_test_question_change
AFTER INSERT OR UPDATE OR DELETE ON public.nbt_test_questions
FOR EACH ROW
EXECUTE FUNCTION public.update_nbt_test_question_count();

-- 9. Trigger to update user NBT progress on test completion
CREATE OR REPLACE FUNCTION public.update_nbt_user_progress()
RETURNS TRIGGER AS $$
DECLARE
  v_section TEXT;
  v_correct_count INTEGER;
BEGIN
  IF NEW.status = 'completed' THEN
    -- Get or create user progress
    INSERT INTO public.nbt_user_progress (user_id)
    VALUES (NEW.user_id)
    ON CONFLICT (user_id) DO NOTHING;

    -- Update general stats
    UPDATE public.nbt_user_progress
    SET 
      total_test_attempts = total_test_attempts + 1,
      best_test_score = GREATEST(best_test_score, NEW.percentage),
      last_attempted_at = now(),
      updated_at = now()
    WHERE user_id = NEW.user_id;

    -- Update section-specific stats if section is specified
    IF NEW.section = 'AQL' THEN
      UPDATE public.nbt_user_progress
      SET 
        aql_attempts = aql_attempts + 1,
        aql_correct = aql_correct + COALESCE(NEW.correct_answers, 0),
        aql_average_score = (aql_average_score * aql_attempts + COALESCE(NEW.percentage, 0)) / (aql_attempts + 1)
      WHERE user_id = NEW.user_id;
    ELSIF NEW.section = 'MAT' THEN
      UPDATE public.nbt_user_progress
      SET 
        mat_attempts = mat_attempts + 1,
        mat_correct = mat_correct + COALESCE(NEW.correct_answers, 0),
        mat_average_score = (mat_average_score * mat_attempts + COALESCE(NEW.percentage, 0)) / (mat_attempts + 1)
      WHERE user_id = NEW.user_id;
    ELSIF NEW.section = 'QL' THEN
      UPDATE public.nbt_user_progress
      SET 
        ql_attempts = ql_attempts + 1,
        ql_correct = ql_correct + COALESCE(NEW.correct_answers, 0),
        ql_average_score = (ql_average_score * ql_attempts + COALESCE(NEW.percentage, 0)) / (ql_attempts + 1)
      WHERE user_id = NEW.user_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_nbt_test_attempt_complete
AFTER INSERT OR UPDATE ON public.nbt_test_attempts
FOR EACH ROW
EXECUTE FUNCTION public.update_nbt_user_progress();
