ALTER TABLE public.support_tickets DROP CONSTRAINT IF EXISTS support_tickets_type_check;
ALTER TABLE public.support_tickets ADD CONSTRAINT support_tickets_type_check CHECK (type = ANY (ARRAY['contact'::text, 'bug_report'::text, 'support'::text, 'report'::text]));

-- Add extracted_text column to study_documents for AI context
ALTER TABLE public.study_documents ADD COLUMN IF NOT EXISTS extracted_text text;