-- Create study_documents table for document-specific metadata and processing
CREATE TABLE public.study_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  knowledge_id UUID NOT NULL REFERENCES public.knowledge_base(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_size INTEGER,
  file_type TEXT,
  num_pages INTEGER,
  extraction_status TEXT DEFAULT 'pending' CHECK (extraction_status IN ('pending', 'processing', 'completed', 'failed')),
  processing_error TEXT,
  extracted_sections JSONB DEFAULT '[]',
  key_concepts TEXT[] DEFAULT '{}',
  summary TEXT,
  processed_content TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.study_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own study documents"
ON public.study_documents FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create own study documents"
ON public.study_documents FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own study documents"
ON public.study_documents FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own study documents"
ON public.study_documents FOR DELETE
USING (auth.uid() = user_id);

CREATE INDEX idx_study_documents_user ON public.study_documents(user_id);
CREATE INDEX idx_study_documents_knowledge ON public.study_documents(knowledge_id);

-- Create study_annotations table for document annotations (highlights, comments, etc)
CREATE TABLE public.study_annotations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  study_document_id UUID NOT NULL REFERENCES public.study_documents(id) ON DELETE CASCADE,
  annotation_type TEXT NOT NULL CHECK (annotation_type IN ('highlight', 'comment', 'bookmark', 'note')),
  position JSONB NOT NULL,
  content TEXT,
  color TEXT DEFAULT '#FFFF00',
  page_number INTEGER,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.study_annotations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own annotations"
ON public.study_annotations FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create own annotations"
ON public.study_annotations FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own annotations"
ON public.study_annotations FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own annotations"
ON public.study_annotations FOR DELETE
USING (auth.uid() = user_id);

CREATE INDEX idx_study_annotations_user ON public.study_annotations(user_id);
CREATE INDEX idx_study_annotations_document ON public.study_annotations(study_document_id);
