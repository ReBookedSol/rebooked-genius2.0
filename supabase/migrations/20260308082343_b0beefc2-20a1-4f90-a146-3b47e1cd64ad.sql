-- Fix reminders_reminder_type_check constraint to match frontend values
ALTER TABLE public.reminders DROP CONSTRAINT IF EXISTS reminders_reminder_type_check;
ALTER TABLE public.reminders ADD CONSTRAINT reminders_reminder_type_check 
  CHECK (reminder_type = ANY (ARRAY['meeting'::text, 'task'::text, 'deadline'::text, 'announcement'::text, 'study'::text, 'assignment'::text, 'exam'::text, 'revision'::text, 'other'::text]));