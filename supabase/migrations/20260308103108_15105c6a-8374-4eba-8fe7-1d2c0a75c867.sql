-- Add is_premium and unlock_animation_type columns
ALTER TABLE public.achievements ADD COLUMN IF NOT EXISTS is_premium boolean DEFAULT false;
ALTER TABLE public.achievements ADD COLUMN IF NOT EXISTS unlock_animation_type text DEFAULT 'confetti';

-- Update category check constraint to include 'nbt'
ALTER TABLE public.achievements DROP CONSTRAINT IF EXISTS achievements_category_check;
ALTER TABLE public.achievements ADD CONSTRAINT achievements_category_check CHECK (category = ANY (ARRAY['study', 'quiz', 'streak', 'flashcard', 'social', 'milestone', 'nbt']));

-- Insert points-based milestone achievements
INSERT INTO public.achievements (name, description, icon_name, category, points, requirement_type, requirement_value, is_premium) VALUES
  ('Rising Star', 'Reach 100 total points', 'star', 'milestone', 20, 'total_points', 100, true),
  ('Point Hunter', 'Reach 500 total points', 'trophy', 'milestone', 50, 'total_points', 500, true),
  ('Point Master', 'Reach 1000 total points', 'crown', 'milestone', 100, 'total_points', 1000, true),
  ('Point Legend', 'Reach 2500 total points', 'flame', 'milestone', 200, 'total_points', 2500, true),
  ('Point God', 'Reach 5000 total points', 'award', 'milestone', 500, 'total_points', 5000, true),
  ('Level 5', 'Reach level 5', 'layers', 'milestone', 30, 'level', 5, true),
  ('Level 10', 'Reach level 10', 'layers', 'milestone', 75, 'level', 10, true),
  ('Level 25', 'Reach level 25', 'layers', 'milestone', 150, 'level', 25, true),
  ('Level 50', 'Reach level 50', 'layers', 'milestone', 300, 'level', 50, true);

-- Insert NBT achievements
INSERT INTO public.achievements (name, description, icon_name, category, points, requirement_type, requirement_value, is_premium) VALUES
  ('NBT Explorer', 'Complete 5 NBT practice questions', 'brain', 'nbt', 15, 'total_points', 50, true),
  ('NBT Scholar', 'Reach 200 points in NBT studies', 'graduation-cap', 'nbt', 40, 'total_points', 200, true),
  ('NBT Champion', 'Reach 500 points as an NBT student', 'trophy', 'nbt', 100, 'total_points', 500, true),
  ('NBT Master', 'Reach 1500 points as an NBT student', 'crown', 'nbt', 250, 'total_points', 1500, true);

-- Mark ALL achievements as premium only
UPDATE public.achievements SET is_premium = true;