-- Create flashcards table that is missing (referenced by triggers)
CREATE TABLE IF NOT EXISTS public.flashcards (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  deck_id UUID REFERENCES public.flashcard_decks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  front TEXT NOT NULL,
  back TEXT NOT NULL,
  is_mastered BOOLEAN DEFAULT FALSE,
  review_count INTEGER DEFAULT 0,
  last_reviewed_at TIMESTAMP WITH TIME ZONE,
  next_review_at TIMESTAMP WITH TIME ZONE,
  ease_factor NUMERIC(4,2) DEFAULT 2.5,
  interval_days INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.flashcards ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view their own flashcards"
  ON public.flashcards FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own flashcards"
  ON public.flashcards FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own flashcards"
  ON public.flashcards FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own flashcards"
  ON public.flashcards FOR DELETE
  USING (auth.uid() = user_id);

-- Create trigger to update deck stats when flashcards change
CREATE TRIGGER update_deck_stats_on_flashcard_change
  AFTER INSERT OR UPDATE OR DELETE ON public.flashcards
  FOR EACH ROW
  EXECUTE FUNCTION public.update_deck_stats();

-- Add user_roles table entry if needed for admin
CREATE TABLE IF NOT EXISTS public.admin_content (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_by UUID NOT NULL,
  content_type TEXT NOT NULL CHECK (content_type IN ('lesson', 'practice_test', 'practice_question')),
  target_section TEXT CHECK (target_section IN ('NBT', 'MBT', 'MAT', 'QL', 'GENERAL')),
  title TEXT NOT NULL,
  content JSONB,
  source_document_url TEXT,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'processing', 'published', 'failed')),
  is_published BOOLEAN DEFAULT FALSE,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS for admin_content
ALTER TABLE public.admin_content ENABLE ROW LEVEL SECURITY;

-- Only admins can manage admin_content
CREATE POLICY "Admins can manage content"
  ON public.admin_content FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- Everyone can view published content
CREATE POLICY "Users can view published content"
  ON public.admin_content FOR SELECT
  USING (is_published = true);