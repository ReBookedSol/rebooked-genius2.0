ALTER TABLE public.subject_analytics_summary 
ADD COLUMN IF NOT EXISTS average_exam_score NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_lessons_completed INTEGER DEFAULT 0;