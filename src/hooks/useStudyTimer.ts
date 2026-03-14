import { useState, useEffect, useCallback, useRef } from 'react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { recordStudyActivity } from '@/utils/streak';

interface StudyTimerState {
  isRunning: boolean;
  isPaused: boolean;
  seconds: number;
  totalSeconds: number;
  sessionId: string | null;
  subjectId: string | null;
}

export const useStudyTimer = () => {
  const { toast } = useToast();
  const [state, setState] = useState<StudyTimerState>({
    isRunning: false,
    isPaused: false,
    seconds: 0,
    totalSeconds: 0,
    sessionId: null,
    subjectId: null,
  });
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isRunningRef = useRef(false);

  // Load timer state from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('studyTimer');
    if (saved) {
      const parsed = JSON.parse(saved);
      // Calculate elapsed time if timer was running (seconds is countdown, so subtract)
      if (parsed.isRunning && parsed.startTime) {
        const elapsed = Math.floor((Date.now() - parsed.startTime) / 1000);
        const remaining = Math.max(0, parsed.seconds - elapsed);
        // If timer expired while away, auto-complete
        if (remaining === 0 && parsed.totalSeconds > 0) {
          // Record the completed session
          persistStudyTime(parsed.totalSeconds, parsed.subjectId);
          setState({
            isRunning: false,
            isPaused: false,
            seconds: 0,
            totalSeconds: 0,
            sessionId: null,
            subjectId: null,
          });
        } else {
          setState({ ...parsed, seconds: remaining, startTime: undefined });
        }
      } else {
        setState(parsed);
      }
    }
  }, []);

  // Save timer state to localStorage
  useEffect(() => {
    if (state.isRunning) {
      localStorage.setItem('studyTimer', JSON.stringify({ ...state, startTime: Date.now() }));
    } else {
      localStorage.setItem('studyTimer', JSON.stringify(state));
    }
  }, [state]);

  /**
   * Persist study time to the backend (study_analytics table)
   */
  const persistStudyTime = useCallback(async (totalSeconds: number, subjectId: string | null) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const durationMinutes = Math.round(totalSeconds / 60);
      if (durationMinutes <= 0) return;

      const today = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD local

      // Update study_analytics
      const { data: existing } = await supabase
        .from('study_analytics')
        .select('*')
        .eq('user_id', user.id)
        .eq('date', today)
        .maybeSingle();

      if (existing) {
        await supabase
          .from('study_analytics')
          .update({
            total_study_minutes: (existing.total_study_minutes || 0) + durationMinutes,
            sessions_count: (existing.sessions_count || 0) + 1,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existing.id);
      } else {
        await supabase
          .from('study_analytics')
          .insert({
            user_id: user.id,
            date: today,
            subject_id: subjectId || null,
            total_study_minutes: durationMinutes,
            sessions_count: 1,
            tests_attempted: 0,
            average_score: 0,
          });
      }

      // Also update study_time_analytics for per-subject tracking
      const { data: existingTime } = await supabase
        .from('study_time_analytics')
        .select('*')
        .eq('user_id', user.id)
        .eq('study_date', today)
        .eq('subject_id', subjectId || null)
        .maybeSingle();

      if (existingTime) {
        await supabase
          .from('study_time_analytics')
          .update({
            total_minutes: (existingTime.total_minutes || 0) + durationMinutes,
            session_count: (existingTime.session_count || 0) + 1,
          })
          .eq('id', existingTime.id);
      } else {
        await supabase
          .from('study_time_analytics')
          .insert({
            user_id: user.id,
            subject_id: subjectId || null,
            study_date: today,
            total_minutes: durationMinutes,
            session_count: 1,
          });
      }

      // Record streak activity
      await recordStudyActivity(user.id, 'timer_session', subjectId);

      // Dispatch event so StreakDisplay and Dashboard can refresh
      window.dispatchEvent(new CustomEvent('studySessionCompleted', { detail: { minutes: durationMinutes } }));
    } catch (error) {
      console.error('Error persisting study time:', error);
    }
  }, []);

  // Timer interval - uses ref to prevent excessive re-creation
  useEffect(() => {
    const shouldRun = state.isRunning && !state.isPaused && state.seconds > 0;

    if (shouldRun && !isRunningRef.current) {
      // Start interval
      isRunningRef.current = true;
      intervalRef.current = setInterval(() => {
        setState((prev) => {
          if (prev.seconds <= 1 && prev.totalSeconds > 0) {
            // Timer is done - clear interval FIRST
            if (intervalRef.current) {
              clearInterval(intervalRef.current);
              intervalRef.current = null;
            }
            isRunningRef.current = false;
            const durationMinutes = Math.ceil(prev.totalSeconds / 60);
            try {
              const audio = new Audio('/notification.mp3');
              audio.volume = 0.5;
              audio.play().catch(() => {});
            } catch {}
            
            // Persist to backend
            persistStudyTime(prev.totalSeconds, prev.subjectId);
            
            setTimeout(() => {
              toast({
                title: '🎉 Study session complete!',
                description: `Great job! You studied for ${durationMinutes} minute${durationMinutes !== 1 ? 's' : ''}.`,
              });
            }, 0);
            return {
              ...prev,
              seconds: 0,
              isRunning: false,
              isPaused: false,
              totalSeconds: 0,
              sessionId: null,
              subjectId: null,
            };
          }
          return { ...prev, seconds: Math.max(0, prev.seconds - 1) };
        });
      }, 1000);
    } else if (!shouldRun && isRunningRef.current) {
      // Stop interval
      isRunningRef.current = false;
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
        isRunningRef.current = false;
      }
    };
  }, [state.isRunning, state.isPaused, state.seconds, toast, persistStudyTime]);

  const start = useCallback(async (minutes: number = 25, subjectId?: string) => {
    // Prevent starting a new session if one is already running
    if (state.isRunning || state.sessionId) {
      return;
    }

    const totalSeconds = minutes * 60;
    setState({
      isRunning: true,
      isPaused: false,
      seconds: totalSeconds,
      totalSeconds: totalSeconds,
      sessionId: 'local-session',
      subjectId: subjectId || null,
    });

    toast({
      title: 'Study session started',
      description: `${minutes} minute timer started. Good luck!`,
    });
  }, [state.isRunning, state.sessionId, toast]);

  const pause = useCallback(() => {
    setState((prev) => ({ ...prev, isPaused: true }));
  }, []);

  const resume = useCallback(() => {
    setState((prev) => ({ ...prev, isPaused: false }));
  }, []);

  const stop = useCallback(async () => {
    // Calculate duration studied so far
    const studiedSeconds = state.totalSeconds - state.seconds;
    const durationMinutes = Math.ceil(studiedSeconds / 60);

    // Persist the partial session
    if (studiedSeconds > 0) {
      persistStudyTime(studiedSeconds, state.subjectId);
    }

    toast({
      title: 'Study session completed!',
      description: `You studied for ${durationMinutes} minute${durationMinutes !== 1 ? 's' : ''}`,
    });

    setState({
      isRunning: false,
      isPaused: false,
      seconds: 0,
      totalSeconds: 0,
      sessionId: null,
      subjectId: null,
    });
  }, [state.totalSeconds, state.seconds, state.subjectId, toast, persistStudyTime]);

  const reset = useCallback(() => {
    setState((prev) => ({
      ...prev,
      seconds: 0,
      totalSeconds: 0,
      isRunning: false,
      isPaused: false,
    }));
  }, []);

  const formatTime = useCallback((totalSeconds: number) => {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }, []);

  return {
    ...state,
    start,
    pause,
    resume,
    stop,
    reset,
    formatTime,
    formattedTime: formatTime(state.seconds),
  };
};
