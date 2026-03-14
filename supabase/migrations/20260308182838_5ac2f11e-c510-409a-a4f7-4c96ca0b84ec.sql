-- Remove all NBT practice tests and their related data (test questions, test attempts)
-- Keep only the lesson that was generated from an uploaded document

-- First delete test attempts referencing the tests
DELETE FROM public.nbt_test_attempts;

-- Delete test questions
DELETE FROM public.nbt_test_questions;

-- Delete all practice tests
DELETE FROM public.nbt_practice_tests;

-- Delete NBT generated lessons that were NOT generated from a user-uploaded document
-- Keep lessons with source_document_id (user-uploaded)
DELETE FROM public.nbt_generated_lessons 
WHERE source_document_id IS NULL;