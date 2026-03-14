-- Add is_memo column to documents table to distinguish between past papers and memos
ALTER TABLE public.documents 
ADD COLUMN IF NOT EXISTS is_memo BOOLEAN DEFAULT false;

-- Add memo_for_document_id to link a memo to its corresponding past paper
ALTER TABLE public.documents 
ADD COLUMN IF NOT EXISTS memo_for_document_id UUID REFERENCES public.documents(id);

-- Update past_paper_attempts to track user's own results entry
ALTER TABLE public.past_paper_attempts 
ADD COLUMN IF NOT EXISTS user_entered_score BOOLEAN DEFAULT false;

-- Create index for efficient memo lookups
CREATE INDEX IF NOT EXISTS idx_documents_memo_for ON public.documents(memo_for_document_id) WHERE memo_for_document_id IS NOT NULL;