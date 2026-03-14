-- 1. Fix nullable constraints in flashcards table
ALTER TABLE public.flashcards 
ALTER COLUMN times_reviewed SET NOT NULL DEFAULT 0,
ALTER COLUMN times_correct SET NOT NULL DEFAULT 0,
ALTER COLUMN is_mastered SET NOT NULL DEFAULT false;

-- 2. Fix nullable constraints in flashcard_decks table
ALTER TABLE public.flashcard_decks 
ALTER COLUMN is_ai_generated SET NOT NULL DEFAULT false,
ALTER COLUMN total_cards SET NOT NULL DEFAULT 0,
ALTER COLUMN mastered_cards SET NOT NULL DEFAULT 0;

-- 3. Fix nullable constraints in quiz_questions table
ALTER TABLE public.quiz_questions 
ALTER COLUMN points SET NOT NULL DEFAULT 1;

-- 4. Fix nullable constraints in quizzes table
ALTER TABLE public.quizzes 
ALTER COLUMN is_ai_generated SET NOT NULL DEFAULT false,
ALTER COLUMN total_questions SET NOT NULL DEFAULT 0;

-- 5. Create function to award achievements based on requirements
CREATE OR REPLACE FUNCTION public.check_and_award_achievements()
RETURNS TRIGGER AS $$
DECLARE
  v_user_id UUID;
  v_achievement RECORD;
  v_requirement_value INTEGER;
  v_current_value INTEGER;
BEGIN
  -- Get user_id depending on which table triggered this
  v_user_id := CASE
    WHEN TG_TABLE_NAME = 'study_sessions' THEN NEW.user_id
    WHEN TG_TABLE_NAME = 'flashcards' THEN NEW.user_id
    WHEN TG_TABLE_NAME = 'quiz_attempts' THEN NEW.user_id
    WHEN TG_TABLE_NAME = 'user_points' THEN NEW.user_id
    ELSE NULL
  END;

  IF v_user_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- Loop through all achievements and check if conditions are met
  FOR v_achievement IN
    SELECT * FROM public.achievements
  LOOP
    -- Skip if already unlocked
    IF EXISTS (
      SELECT 1 FROM public.user_achievements 
      WHERE user_id = v_user_id AND achievement_id = v_achievement.id
    ) THEN
      CONTINUE;
    END IF;

    -- Check each achievement type and award if requirement is met
    CASE v_achievement.requirement_type
      WHEN 'study_sessions' THEN
        SELECT COUNT(*) INTO v_current_value
        FROM public.study_sessions
        WHERE user_id = v_user_id AND status = 'completed';
        
        IF v_current_value >= v_achievement.requirement_value THEN
          INSERT INTO public.user_achievements (user_id, achievement_id, unlocked_at)
          VALUES (v_user_id, v_achievement.id, now())
          ON CONFLICT (user_id, achievement_id) DO NOTHING;
        END IF;

      WHEN 'streak_days' THEN
        SELECT current_streak INTO v_current_value
        FROM public.user_points
        WHERE user_id = v_user_id;
        
        v_current_value := COALESCE(v_current_value, 0);
        IF v_current_value >= v_achievement.requirement_value THEN
          INSERT INTO public.user_achievements (user_id, achievement_id, unlocked_at)
          VALUES (v_user_id, v_achievement.id, now())
          ON CONFLICT (user_id, achievement_id) DO NOTHING;
        END IF;

      WHEN 'total_study_minutes' THEN
        SELECT COALESCE(SUM(total_study_minutes), 0) INTO v_current_value
        FROM public.study_analytics
        WHERE user_id = v_user_id;
        
        IF v_current_value >= v_achievement.requirement_value THEN
          INSERT INTO public.user_achievements (user_id, achievement_id, unlocked_at)
          VALUES (v_user_id, v_achievement.id, now())
          ON CONFLICT (user_id, achievement_id) DO NOTHING;
        END IF;

      WHEN 'flashcards_created' THEN
        SELECT COUNT(*) INTO v_current_value
        FROM public.flashcards
        WHERE user_id = v_user_id;
        
        IF v_current_value >= v_achievement.requirement_value THEN
          INSERT INTO public.user_achievements (user_id, achievement_id, unlocked_at)
          VALUES (v_user_id, v_achievement.id, now())
          ON CONFLICT (user_id, achievement_id) DO NOTHING;
        END IF;

      WHEN 'flashcards_mastered' THEN
        SELECT COUNT(*) INTO v_current_value
        FROM public.flashcards
        WHERE user_id = v_user_id AND is_mastered = true;
        
        IF v_current_value >= v_achievement.requirement_value THEN
          INSERT INTO public.user_achievements (user_id, achievement_id, unlocked_at)
          VALUES (v_user_id, v_achievement.id, now())
          ON CONFLICT (user_id, achievement_id) DO NOTHING;
        END IF;

      WHEN 'quizzes_completed' THEN
        SELECT COUNT(*) INTO v_current_value
        FROM public.quiz_attempts
        WHERE user_id = v_user_id;
        
        IF v_current_value >= v_achievement.requirement_value THEN
          INSERT INTO public.user_achievements (user_id, achievement_id, unlocked_at)
          VALUES (v_user_id, v_achievement.id, now())
          ON CONFLICT (user_id, achievement_id) DO NOTHING;
        END IF;

      WHEN 'perfect_quizzes' THEN
        SELECT COUNT(*) INTO v_current_value
        FROM public.quiz_attempts
        WHERE user_id = v_user_id AND percentage = 100;
        
        IF v_current_value >= v_achievement.requirement_value THEN
          INSERT INTO public.user_achievements (user_id, achievement_id, unlocked_at)
          VALUES (v_user_id, v_achievement.id, now())
          ON CONFLICT (user_id, achievement_id) DO NOTHING;
        END IF;
    END CASE;
  END LOOP;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 6. Create trigger for achievement checking on study sessions
CREATE TRIGGER on_study_session_achievement_check
AFTER INSERT OR UPDATE ON public.study_sessions
FOR EACH ROW
WHEN (NEW.status = 'completed')
EXECUTE FUNCTION public.check_and_award_achievements();

-- 7. Create trigger for achievement checking on flashcards
CREATE TRIGGER on_flashcard_achievement_check
AFTER INSERT OR UPDATE ON public.flashcards
FOR EACH ROW
EXECUTE FUNCTION public.check_and_award_achievements();

-- 8. Create trigger for achievement checking on quiz attempts
CREATE TRIGGER on_quiz_attempt_achievement_check
AFTER INSERT ON public.quiz_attempts
FOR EACH ROW
EXECUTE FUNCTION public.check_and_award_achievements();

-- 9. Create trigger for achievement checking on user points updates
CREATE TRIGGER on_user_points_achievement_check
AFTER UPDATE ON public.user_points
FOR EACH ROW
EXECUTE FUNCTION public.check_and_award_achievements();
