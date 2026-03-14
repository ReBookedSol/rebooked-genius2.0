import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

interface TimeSession {
  id: string;
  user_id: string;
  subject_id?: string;
  content_type: 'lesson' | 'flashcard' | 'quiz' | 'document' | 'general';
  content_id?: string;
  status: 'active' | 'paused' | 'completed';
  total_duration_seconds: number;
  started_at: string;
  paused_at?: string;
  completed_at?: string;
}

interface TimeAnalytics {
  study_date: string;
  total_minutes: number;
  session_count: number;
}

interface TimeAnalyticsResult {
  date: string;
  total_minutes: number;
  session_count: number;
}

interface SubjectTrendData {
  period: string;
  total_minutes: number;
  average_daily_minutes: number;
}

export const useStudyTimeTracking = () => {
  const { user } = useAuth();
  const { toast } = useToast();

  /**
   * Start a new study session
   */
  const startSession = useCallback(
    async (
      contentType: 'lesson' | 'flashcard' | 'quiz' | 'document' | 'general' = 'general',
      contentId?: string,
      subjectId?: string
    ): Promise<string | null> => {
      if (!user) {
        toast({
          title: 'Error',
          description: 'User not authenticated',
          variant: 'destructive',
        });
        return null;
      }

      try {
        const { data, error } = await supabase
          .from('study_time_sessions')
          .insert({
            user_id: user.id,
            subject_id: subjectId || null,
            content_type: contentType,
            content_id: contentId || null,
            status: 'active',
            total_duration_seconds: 0,
          })
          .select()
          .single();

        if (error) throw error;

        return data.id;
      } catch (error) {
        console.error('Error starting session:', error);
        toast({
          title: 'Error',
          description: 'Failed to start study session',
          variant: 'destructive',
        });
        return null;
      }
    },
    [user, toast]
  );

  /**
   * Pause a study session
   */
  const pauseSession = useCallback(
    async (sessionId: string): Promise<boolean> => {
      if (!user) return false;

      try {
        // Fetch session to get current started_at and total_duration_seconds
        const { data: session } = await supabase
          .from('study_time_sessions')
          .select('*')
          .eq('id', sessionId)
          .single();

        if (session && session.status === 'active') {
          const now = new Date();
          const startedAt = new Date(session.started_at);
          const additionalSeconds = Math.floor((now.getTime() - startedAt.getTime()) / 1000);

          const { error } = await supabase
            .from('study_time_sessions')
            .update({
              status: 'paused',
              paused_at: now.toISOString(),
              total_duration_seconds: (session.total_duration_seconds || 0) + additionalSeconds,
            })
            .eq('id', sessionId)
            .eq('user_id', user.id);

          if (error) throw error;
          return true;
        }
        return false;
      } catch (error) {
        console.error('Error pausing session:', error);
        return false;
      }
    },
    [user]
  );

  /**
   * Resume a paused study session
   */
  const resumeSession = useCallback(
    async (sessionId: string): Promise<boolean> => {
      if (!user) return false;

      try {
        const { error } = await supabase
          .from('study_time_sessions')
          .update({
            status: 'active',
            paused_at: null,
            started_at: new Date().toISOString(),
          })
          .eq('id', sessionId)
          .eq('user_id', user.id);

        if (error) throw error;
        return true;
      } catch (error) {
        console.error('Error resuming session:', error);
        return false;
      }
    },
    [user]
  );

  /**
   * End a study session and update analytics
   */
  const endSession = useCallback(
    async (sessionId: string): Promise<number | null> => {
      if (!user) return null;

      try {
        // Get session data
        const { data: session, error: sessionError } = await supabase
          .from('study_time_sessions')
          .select('*')
          .eq('id', sessionId)
          .eq('user_id', user.id)
          .single();

        if (sessionError) throw sessionError;

        const now = new Date();
        const completedAt = now.toISOString();

        // Calculate duration since last started_at if active
        let additionalSeconds = 0;
        if (session.status === 'active') {
          const startTime = new Date(session.started_at).getTime();
          additionalSeconds = Math.floor((now.getTime() - startTime) / 1000);
        } else if (session.status === 'paused' && session.paused_at) {
          // If paused, we don't add more time, but we ensure we use the accumulated duration
          additionalSeconds = 0;
        }

        const finalDurationSeconds = (session.total_duration_seconds || 0) + additionalSeconds;

        // Update session
        const { error: updateError } = await supabase
          .from('study_time_sessions')
          .update({
            status: 'completed',
            total_duration_seconds: finalDurationSeconds,
            completed_at: completedAt,
          })
          .eq('id', sessionId);

        if (updateError) throw updateError;

        // Fetch the latest subject_id from the source if possible to ensure linking is accurate
        let finalSubjectId = session.subject_id;
        if (!finalSubjectId && session.content_id && session.content_type === 'document') {
          const { data: docData } = await supabase
            .from('study_documents')
            .select('subject_id')
            .eq('id', session.content_id)
            .maybeSingle();
          if (docData?.subject_id) finalSubjectId = docData.subject_id;
        }

        // Update daily analytics using local date for better accuracy
        const today = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD in local time
        const durationMinutes = Math.round(finalDurationSeconds / 60); // Use round instead of ceil for better aggregate accuracy

        // Update study_time_analytics (per-subject granular tracking)
        const { data: existingAnalytics, error: fetchError } = await supabase
          .from('study_time_analytics')
          .select('*')
          .eq('user_id', user.id)
          .eq('study_date', today)
          .eq('subject_id', finalSubjectId || null)
          .maybeSingle();

        if (!fetchError && existingAnalytics) {
          await supabase
            .from('study_time_analytics')
            .update({
              total_minutes: (existingAnalytics.total_minutes || 0) + durationMinutes,
              session_count: (existingAnalytics.session_count || 0) + 1,
            })
            .eq('id', existingAnalytics.id);
        } else {
          await supabase
            .from('study_time_analytics')
            .insert({
              user_id: user.id,
              subject_id: finalSubjectId || null,
              study_date: today,
              total_minutes: durationMinutes,
              session_count: 1,
            });
        }

        // Also update study_analytics (main analytics table used by dashboard/analytics charts)
        const { data: existingMainAnalytics } = await supabase
          .from('study_analytics')
          .select('*')
          .eq('user_id', user.id)
          .eq('date', today)
          .maybeSingle();

        if (existingMainAnalytics) {
          await supabase
            .from('study_analytics')
            .update({
              total_study_minutes: (existingMainAnalytics.total_study_minutes || 0) + durationMinutes,
              sessions_count: (existingMainAnalytics.sessions_count || 0) + 1,
              updated_at: new Date().toISOString(),
            })
            .eq('id', existingMainAnalytics.id);
        } else {
          await supabase
            .from('study_analytics')
            .insert({
              user_id: user.id,
              date: today,
              subject_id: finalSubjectId || null,
              total_study_minutes: durationMinutes,
              sessions_count: 1,
              tests_attempted: 0,
              average_score: 0,
            });
        }

        return durationMinutes;
      } catch (error) {
        console.error('Error ending session:', error);
        toast({
          title: 'Error',
          description: 'Failed to save study session',
          variant: 'destructive',
        });
        return null;
      }
    },
    [user, toast]
  );

  /**
   * Get time analytics for a date range
   */
  const getTimeAnalytics = useCallback(
    async (subjectId?: string, days: number = 30): Promise<TimeAnalyticsResult[]> => {
      if (!user) return [];

      try {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - days);
        const cutoffDateStr = cutoffDate.toLocaleDateString('en-CA');

        let query = supabase
          .from('study_time_analytics')
          .select('*')
          .eq('user_id', user.id)
          .gte('study_date', cutoffDateStr);

        if (subjectId) {
          query = query.eq('subject_id', subjectId);
        }

        const { data, error } = await query.order('study_date', { ascending: true });

        if (error) throw error;

        return (
          (data as TimeAnalytics[])?.map((analytics) => ({
            date: analytics.study_date,
            total_minutes: analytics.total_minutes || 0,
            session_count: analytics.session_count || 0,
          })) || []
        );
      } catch (error) {
        console.error('Error getting time analytics:', error);
        return [];
      }
    },
    [user]
  );

  /**
   * Get subject trends (weekly or monthly rollups)
   */
  const getSubjectTrends = useCallback(
    async (
      subjectId: string,
      period: 'week' | 'month' = 'week'
    ): Promise<SubjectTrendData[]> => {
      if (!user) return [];

      try {
        const { data, error } = await supabase
          .from('study_time_trends')
          .select('*')
          .eq('user_id', user.id)
          .eq('subject_id', subjectId)
          .eq('period', period)
          .order('period_start_date', { ascending: false })
          .limit(12); // Last 12 weeks or months

        if (error) throw error;

        return (
          (data as any[])?.map((trend) => ({
            period: `${trend.period_start_date} to ${trend.period_end_date}`,
            total_minutes: trend.total_minutes || 0,
            average_daily_minutes: parseFloat(trend.average_daily_minutes || 0),
          })) || []
        );
      } catch (error) {
        console.error('Error getting subject trends:', error);
        return [];
      }
    },
    [user]
  );

  /**
   * Get current session duration in a formatted string
   */
  const formatDuration = useCallback((totalSeconds: number) => {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m ${seconds}s`;
  }, []);

  return {
    startSession,
    pauseSession,
    resumeSession,
    endSession,
    getTimeAnalytics,
    getSubjectTrends,
    formatDuration,
  };
};
