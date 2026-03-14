-- Cleanup unused database tables
-- This migration removes tables that were defined but are no longer used by the application

-- Drop unused lesson annotation tables
DROP TABLE IF EXISTS public.lesson_annotations CASCADE;

-- Drop unused lesson completion tracking
DROP TABLE IF EXISTS public.lesson_completions CASCADE;

-- Drop unused study annotations
DROP TABLE IF EXISTS public.study_annotations CASCADE;

-- Drop unused PDF annotations
DROP TABLE IF EXISTS public.pdf_annotations CASCADE;

-- Drop unused NBT data interpretation tables
DROP TABLE IF EXISTS public.nbt_data_attempts CASCADE;
DROP TABLE IF EXISTS public.nbt_data_questions CASCADE;
DROP TABLE IF EXISTS public.nbt_data_interpretation CASCADE;

-- Drop unused content table (was scaffolded but never used)
DROP TABLE IF EXISTS public.content CASCADE;

-- Note: subscription_plans table is dropped from DB since frontend uses hardcoded SUBSCRIPTION_PLANS in src/utils/paystackSubscriptionApi.ts
-- If you need to manage plans via DB/admin UI in the future, you can restore this table from a migration
DROP TABLE IF EXISTS public.subscription_plans CASCADE;

-- Note: nbt_question_collections is kept as it may be referenced by nbt_practice_questions structure
-- If no longer needed, it can be dropped in a future migration after verification
