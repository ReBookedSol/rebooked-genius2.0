-- Add term column to study materials for better organization
ALTER TABLE public.flashcard_decks ADD COLUMN IF NOT EXISTS term INTEGER CHECK (term >= 1 AND term <= 4);
ALTER TABLE public.quizzes ADD COLUMN IF NOT EXISTS term INTEGER CHECK (term >= 1 AND term <= 4);
ALTER TABLE public.knowledge_base ADD COLUMN IF NOT EXISTS term INTEGER CHECK (term >= 1 AND term <= 4);

-- Add knowledge_id to analytics tables to support Exams tracking
ALTER TABLE public.quiz_attempts ADD COLUMN IF NOT EXISTS knowledge_id UUID REFERENCES public.knowledge_base(id) ON DELETE CASCADE;
ALTER TABLE public.quiz_performance_analytics ADD COLUMN IF NOT EXISTS knowledge_id UUID REFERENCES public.knowledge_base(id) ON DELETE CASCADE;

-- Make quiz_id nullable in analytics tables to support Exams (which use knowledge_id instead)
ALTER TABLE public.quiz_attempts ALTER COLUMN quiz_id DROP NOT NULL;
ALTER TABLE public.quiz_performance_analytics ALTER COLUMN quiz_id DROP NOT NULL;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_flashcard_decks_term ON public.flashcard_decks(term);
CREATE INDEX IF NOT EXISTS idx_quizzes_term ON public.quizzes(term);
CREATE INDEX IF NOT EXISTS idx_knowledge_base_term ON public.knowledge_base(term);
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_knowledge_id ON public.quiz_attempts(knowledge_id);
CREATE INDEX IF NOT EXISTS idx_quiz_performance_analytics_knowledge_id ON public.quiz_performance_analytics(knowledge_id);
