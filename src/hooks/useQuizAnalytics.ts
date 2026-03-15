import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

interface QuizAttemptRecord {
  id: string;
  user_id: string;
  quiz_id?: string;
  knowledge_id?: string;
  quiz_attempt_id?: string;
  subject_id?: string;
  score: number;
  max_score: number;
  percentage: number;
  questions_correct: number;
  total_questions: number;
  time_taken_seconds: number;
  completed_at: string;
}

interface PerformanceSummary {
  total_quizzes_taken: number;
  average_score: number;
  highest_score: number;
  lowest_score: number;
  total_time_spent_seconds: number;
  last_quiz_date?: string;
}

interface PerformanceBySubject {
  subject_id: string;
  average_score: number;
  total_quizzes: number;
  last_attempt_date?: string;
}

interface TrendData {
  date: string;
  average_score: number;
  quiz_count: number;
}

export const useQuizAnalytics = () => {
  const { user } = useAuth();
  const { toast } = useToast();

  /**
   * Record a new quiz attempt
   */
  const recordQuizAttempt = useCallback(
    async (
      quizId: string | null,
      subjectId: string | undefined,
      score: number,
      maxScore: number,
      timeSeconds: number,
      questionsCorrect: number,
      totalQuestions: number,
      quizAttemptId?: string,
      knowledgeId?: string,
      activityType: 'quiz' | 'exam' | 'flashcard' = 'quiz'
    ): Promise<boolean> => {
      if (!user) {
        toast({
          title: 'Error',
          description: 'User not authenticated',
          variant: 'destructive',
        });
        return false;
      }

      try {
        let finalSubjectId = subjectId;

        // Fallback to fetch subject_id from quizzes or knowledge_base if not provided
        if (!finalSubjectId) {
          if (quizId) {
            try {
              const { data: quizData } = await supabase
                .from('quizzes')
                .select('subject_id')
                .eq('id', quizId)
                .single();

              if (quizData?.subject_id) {
                finalSubjectId = quizData.subject_id;
              }
            } catch (err) {
              console.log('Could not fetch subject_id from quiz:', err);
            }
          } else if (knowledgeId) {
            try {
              const { data: kbData } = await supabase
                .from('knowledge_base')
                .select('subject_id')
                .eq('id', knowledgeId)
                .single();

              if (kbData?.subject_id) {
                finalSubjectId = kbData.subject_id;
              }
            } catch (err) {
              console.log('Could not fetch subject_id from knowledge_base:', err);
            }
          }
        }

        const percentage = (score / maxScore) * 100;

        // Record detailed analytics
        try {
          const { error: analyticsError } = await (supabase as any)
            .from('quiz_performance_analytics')
            .insert({
              user_id: user.id,
              quiz_id: quizId,
              knowledge_id: knowledgeId || null,
              quiz_attempt_id: quizAttemptId || null,
              subject_id: finalSubjectId || null,
              score,
              max_score: maxScore,
              percentage,
              questions_correct: questionsCorrect,
              total_questions: totalQuestions,
              time_taken_seconds: timeSeconds,
              activity_type: activityType, // New field to distinguish activity types
              completed_at: new Date().toISOString(),
            });

          if (analyticsError) throw new Error(`Analytics insert failed: ${analyticsError.message}`);
        } catch (err) {
          console.error('Failed to record analytics:', err);
          throw err;
        }

        // Update study_analytics for daily tracking
        const today = new Date().toLocaleDateString('en-CA');
        try {
          let analyticsQuery = supabase
            .from('study_analytics')
            .select('*')
            .eq('user_id', user.id)
            .eq('date', today);

          if (finalSubjectId) {
            analyticsQuery = analyticsQuery.eq('subject_id', finalSubjectId);
          } else {
            analyticsQuery = analyticsQuery.is('subject_id', null);
          }

          const { data: existingAnalytics, error: analyticsFetchError } = await analyticsQuery.maybeSingle();

          if (analyticsFetchError) {
            console.warn('Could not fetch study_analytics, skipping daily tracking:', analyticsFetchError);
          } else if (existingAnalytics) {
            const currentTests = Number(existingAnalytics.tests_attempted || 0);
            const currentFlashcards = Number(existingAnalytics.flashcard_count || 0);

            let updates: any = {
              updated_at: new Date().toISOString(),
            };

            if (activityType === 'flashcard') {
              updates.flashcard_count = currentFlashcards + 1;
            } else {
              const testsAttempted = currentTests + 1;
              const currentAvgScore = Number(existingAnalytics.average_score) || 0;
              const newAverageScore = ((currentAvgScore * (testsAttempted - 1)) + percentage) / testsAttempted;

              updates.tests_attempted = testsAttempted;
              updates.average_score = newAverageScore;
            }

            const { error: updateError } = await supabase
              .from('study_analytics')
              .update(updates)
              .eq('id', existingAnalytics.id);

            if (updateError) {
              console.warn('Could not update study_analytics:', updateError);
            }
          } else {
            const { error: insertError } = await supabase.from('study_analytics').insert({
              user_id: user.id,
              date: today,
              subject_id: finalSubjectId || null,
              tests_attempted: activityType !== 'flashcard' ? 1 : 0,
              flashcard_count: activityType === 'flashcard' ? 1 : 0,
              average_score: activityType !== 'flashcard' ? percentage : 0,
            });

            if (insertError) {
              console.warn('Could not insert new study_analytics record:', insertError);
            }
          }
        } catch (err) {
          console.warn('Error updating study_analytics:', err);
        }

        // Update or create performance summary
        try {
          const { data: existing, error: summaryFetchError } = await supabase
            .from('quiz_performance_summary')
            .select('*')
            .eq('user_id', user.id)
            .maybeSingle();

          if (!summaryFetchError && existing) {
            // Update existing summary
            const newAverage =
              (existing.average_score * existing.total_quizzes_taken + score) /
              (existing.total_quizzes_taken + 1);

            const { error: updateError } = await supabase
              .from('quiz_performance_summary')
              .update({
                total_quizzes_taken: existing.total_quizzes_taken + 1,
                average_score: newAverage,
                highest_score: Math.max(existing.highest_score || 0, score),
                lowest_score: Math.min(existing.lowest_score || 100, score),
                total_time_spent_seconds: (existing.total_time_spent_seconds || 0) + timeSeconds,
                last_quiz_date: new Date().toISOString(),
              })
              .eq('user_id', user.id);

            if (updateError) {
              console.warn('Could not update quiz_performance_summary:', updateError);
            }
          } else {
            // Create new summary
            const { error: insertError } = await supabase
              .from('quiz_performance_summary')
              .insert({
                user_id: user.id,
                total_quizzes_taken: 1,
                average_score: score,
                highest_score: score,
                lowest_score: score,
                total_time_spent_seconds: timeSeconds,
                last_quiz_date: new Date().toISOString(),
              });

            if (insertError) {
              console.warn('Could not insert new quiz_performance_summary record:', insertError);
            }
          }
        } catch (err) {
          console.warn('Error updating quiz_performance_summary:', err);
        }

        const activityLabel = activityType === 'exam' ? 'Exam' : activityType === 'flashcard' ? 'Flashcard session' : 'Quiz';
        toast({
          title: `${activityLabel} recorded`,
          description: `Score: ${score}/${maxScore} (${Math.round(percentage)}%)`,
        });

        return true;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        const logMessage = error instanceof Error ? error.stack || error.toString() : JSON.stringify(error);
        console.error('Error recording attempt:', logMessage, error);
        toast({
          title: 'Error',
          description: `Failed to record ${activityType || 'quiz'} attempt`,
          variant: 'destructive',
        });
        return false;
      }
    },
    [user, toast]
  );

  /**
   * Get overall performance summary for user
   */
  const getQuizPerformanceSummary = useCallback(
    async (userId: string): Promise<PerformanceSummary | null> => {
      try {
        const { data, error } = await supabase
          .from('quiz_performance_summary')
          .select('*')
          .eq('user_id', userId)
          .single();

        if (error) throw error;
        return data as PerformanceSummary;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error('Error getting performance summary:', errorMessage, error);
        return null;
      }
    },
    []
  );

  /**
   * Get performance breakdown by subject
   */
  const getPerformanceBySubject = useCallback(
    async (subjectId: string, timePeriod?: number): Promise<PerformanceBySubject | null> => {
      if (!user) return null;

      try {
        const query = supabase
          .from('quiz_performance_analytics')
          .select('*')
          .eq('user_id', user.id)
          .eq('subject_id', subjectId);

        if (timePeriod) {
          const cutoffDate = new Date();
          cutoffDate.setDate(cutoffDate.getDate() - timePeriod);
          query.gte('completed_at', cutoffDate.toISOString());
        }

        const { data, error } = await query;

        if (error) throw error;

        const records = (data as QuizAttemptRecord[]) || [];
        if (records.length === 0) return null;

        const totalScore = records.reduce((sum, r) => sum + r.score, 0);
        const averageScore = totalScore / records.length;

        return {
          subject_id: subjectId,
          average_score: averageScore,
          total_quizzes: records.length,
          last_attempt_date: records[0]?.completed_at,
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error('Error getting performance by subject:', errorMessage, error);
        return null;
      }
    },
    [user]
  );

  /**
   * Calculate average score for a quiz
   */
  const calculateAverageScore = useCallback(
    async (quizId: string, knowledgeId?: string): Promise<number> => {
      if (!user) return 0;

      try {
        let query = supabase
          .from('quiz_performance_analytics')
          .select('score, max_score')
          .eq('user_id', user.id);

        if (quizId) query = query.eq('quiz_id', quizId);
        // knowledge_id column may not exist - skip filter if not needed
        if (knowledgeId) query = query.eq('quiz_id', quizId);

        const { data, error } = await query;

        const records = (data as { score: number; max_score: number }[]) || [];
        if (records.length === 0) return 0;

        const totalPercentage = records.reduce((sum, r) => sum + (r.score / r.max_score) * 100, 0);
        return totalPercentage / records.length;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error('Error calculating average score:', errorMessage, error);
        return 0;
      }
    },
    [user]
  );

  /**
   * Get performance trends over time
   */
  const getTrends = useCallback(
    async (subjectId: string | undefined, days: number = 30): Promise<TrendData[]> => {
      if (!user) return [];

      try {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - days);

        let query = supabase
          .from('quiz_performance_analytics')
          .select('completed_at, score, max_score')
          .eq('user_id', user.id)
          .gte('completed_at', cutoffDate.toISOString());

        if (subjectId) {
          query = query.eq('subject_id', subjectId);
        }

        const { data, error } = await query;

        if (error) throw error;

        const records = (data as any[]) || [];

        // Group by date
        const grouped: { [key: string]: { scores: number[]; maxScores: number[] } } = {};

        records.forEach((record) => {
          const date = record.completed_at.split('T')[0];
          if (!grouped[date]) {
            grouped[date] = { scores: [], maxScores: [] };
          }
          grouped[date].scores.push(record.score);
          grouped[date].maxScores.push(record.max_score);
        });

        // Convert to trend data
        const trends: TrendData[] = Object.entries(grouped)
          .map(([date, data]) => {
            const percentages = data.scores.map(
              (score, idx) => (score / data.maxScores[idx]) * 100
            );
            const avgPercentage = percentages.reduce((a, b) => a + b, 0) / percentages.length;

            return {
              date,
              average_score: avgPercentage,
              quiz_count: data.scores.length,
            };
          })
          .sort((a, b) => a.date.localeCompare(b.date));

        return trends;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error('Error getting trends:', errorMessage, error);
        return [];
      }
    },
    [user]
  );

  return {
    recordQuizAttempt,
    getQuizPerformanceSummary,
    getPerformanceBySubject,
    calculateAverageScore,
    getTrends,
  };
};
