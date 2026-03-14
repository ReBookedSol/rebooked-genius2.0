-- Add 'accurate' column to documents table for auditing purposes
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS accurate TEXT DEFAULT '';

-- Add index for faster querying of unaudited documents
CREATE INDEX IF NOT EXISTS idx_documents_accurate ON public.documents(accurate) WHERE accurate IS NULL OR accurate = '';
