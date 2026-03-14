-- Update check_and_award_achievements function to support total_points requirement type
CREATE OR REPLACE FUNCTION public.check_and_award_achievements()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id UUID;
  v_achievement RECORD;
  v_current_value INTEGER;
BEGIN
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

  FOR v_achievement IN
    SELECT * FROM public.achievements
  LOOP
    IF EXISTS (
      SELECT 1 FROM public.user_achievements 
      WHERE user_id = v_user_id AND achievement_id = v_achievement.id
    ) THEN
      CONTINUE;
    END IF;

    CASE v_achievement.requirement_type
      WHEN 'total_points' THEN
        SELECT total_points INTO v_current_value
        FROM public.user_points
        WHERE user_id = v_user_id;
        
        v_current_value := COALESCE(v_current_value, 0);
        IF v_current_value >= v_achievement.requirement_value THEN
          INSERT INTO public.user_achievements (user_id, achievement_id, unlocked_at)
          VALUES (v_user_id, v_achievement.id, now())
          ON CONFLICT ON CONSTRAINT user_achievements_user_achievement_unique DO NOTHING;
        END IF;

      WHEN 'level' THEN
        SELECT level INTO v_current_value
        FROM public.user_points
        WHERE user_id = v_user_id;
        
        v_current_value := COALESCE(v_current_value, 1);
        IF v_current_value >= v_achievement.requirement_value THEN
          INSERT INTO public.user_achievements (user_id, achievement_id, unlocked_at)
          VALUES (v_user_id, v_achievement.id, now())
          ON CONFLICT ON CONSTRAINT user_achievements_user_achievement_unique DO NOTHING;
        END IF;

      WHEN 'study_sessions' THEN
        SELECT COUNT(*) INTO v_current_value
        FROM public.study_sessions
        WHERE user_id = v_user_id AND status = 'completed';
        
        IF v_current_value >= v_achievement.requirement_value THEN
          INSERT INTO public.user_achievements (user_id, achievement_id, unlocked_at)
          VALUES (v_user_id, v_achievement.id, now())
          ON CONFLICT ON CONSTRAINT user_achievements_user_achievement_unique DO NOTHING;
        END IF;

      WHEN 'streak_days' THEN
        SELECT current_streak INTO v_current_value
        FROM public.user_points
        WHERE user_id = v_user_id;
        
        v_current_value := COALESCE(v_current_value, 0);
        IF v_current_value >= v_achievement.requirement_value THEN
          INSERT INTO public.user_achievements (user_id, achievement_id, unlocked_at)
          VALUES (v_user_id, v_achievement.id, now())
          ON CONFLICT ON CONSTRAINT user_achievements_user_achievement_unique DO NOTHING;
        END IF;

      WHEN 'total_study_minutes' THEN
        SELECT COALESCE(SUM(total_study_minutes), 0) INTO v_current_value
        FROM public.study_analytics
        WHERE user_id = v_user_id;
        
        IF v_current_value >= v_achievement.requirement_value THEN
          INSERT INTO public.user_achievements (user_id, achievement_id, unlocked_at)
          VALUES (v_user_id, v_achievement.id, now())
          ON CONFLICT ON CONSTRAINT user_achievements_user_achievement_unique DO NOTHING;
        END IF;

      WHEN 'flashcards_created' THEN
        SELECT COUNT(*) INTO v_current_value
        FROM public.flashcards
        WHERE user_id = v_user_id;
        
        IF v_current_value >= v_achievement.requirement_value THEN
          INSERT INTO public.user_achievements (user_id, achievement_id, unlocked_at)
          VALUES (v_user_id, v_achievement.id, now())
          ON CONFLICT ON CONSTRAINT user_achievements_user_achievement_unique DO NOTHING;
        END IF;

      WHEN 'flashcards_mastered' THEN
        SELECT COUNT(*) INTO v_current_value
        FROM public.flashcards
        WHERE user_id = v_user_id AND is_mastered = true;
        
        IF v_current_value >= v_achievement.requirement_value THEN
          INSERT INTO public.user_achievements (user_id, achievement_id, unlocked_at)
          VALUES (v_user_id, v_achievement.id, now())
          ON CONFLICT ON CONSTRAINT user_achievements_user_achievement_unique DO NOTHING;
        END IF;

      WHEN 'quizzes_completed' THEN
        SELECT COUNT(*) INTO v_current_value
        FROM public.quiz_attempts
        WHERE user_id = v_user_id;
        
        IF v_current_value >= v_achievement.requirement_value THEN
          INSERT INTO public.user_achievements (user_id, achievement_id, unlocked_at)
          VALUES (v_user_id, v_achievement.id, now())
          ON CONFLICT ON CONSTRAINT user_achievements_user_achievement_unique DO NOTHING;
        END IF;

      WHEN 'perfect_quizzes' THEN
        SELECT COUNT(*) INTO v_current_value
        FROM public.quiz_attempts
        WHERE user_id = v_user_id AND percentage = 100;
        
        IF v_current_value >= v_achievement.requirement_value THEN
          INSERT INTO public.user_achievements (user_id, achievement_id, unlocked_at)
          VALUES (v_user_id, v_achievement.id, now())
          ON CONFLICT ON CONSTRAINT user_achievements_user_achievement_unique DO NOTHING;
        END IF;
      
      ELSE
        NULL;
    END CASE;
  END LOOP;

  RETURN COALESCE(NEW, OLD);
END;
$function$;