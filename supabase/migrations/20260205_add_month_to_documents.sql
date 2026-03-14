-- Add month column to documents table
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS month TEXT;

-- Create an index for the month column to improve filtering performance if needed later
CREATE INDEX IF NOT EXISTS idx_documents_month ON public.documents(month);
