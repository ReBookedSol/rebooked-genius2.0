-- Add is_premium column to achievements table
ALTER TABLE public.achievements
ADD COLUMN IF NOT EXISTS is_premium BOOLEAN NOT NULL DEFAULT false;

-- Add unlock_animation_type column to achievements table
ALTER TABLE public.achievements
ADD COLUMN IF NOT EXISTS unlock_animation_type TEXT DEFAULT 'fade';

-- Create index for faster queries on is_premium
CREATE INDEX IF NOT EXISTS idx_achievements_is_premium ON public.achievements(is_premium);

-- Add constraint to ensure unlock_animation_type is one of the valid options
ALTER TABLE public.achievements
ADD CONSTRAINT valid_animation_type CHECK (
  unlock_animation_type IN ('fade', 'scale', 'bounce', 'celebration')
);
