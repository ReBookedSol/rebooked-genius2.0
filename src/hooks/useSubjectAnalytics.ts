import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

export interface SubjectAnalyticsSummary {
  id: string;
  user_id: string;
  subject_id: string;
  total_study_minutes: number;
  total_quizzes_taken: number;
  total_exams_taken: number;
  total_lessons_completed: number;
  average_quiz_score: number;
  average_exam_score: number;
  total_flashcards_mastered: number;
  total_flashcards_created: number;
  last_studied_at?: string;
  progress_percentage: number;
  created_at: string;
  updated_at: string;
}

export interface SubjectProgress {
  masteredFlashcards: number;
  totalFlashcards: number;
  percentMastered: number;
  averageQuizScore: number;
  totalStudyMinutes: number;
  lastActivityDate?: string;
}

export const useSubjectAnalytics = () => {
  const { user } = useAuth();
  const { toast } = useToast();

  /**
   * Get aggregated analytics summary for a subject
   */
  const getSubjectAnalyticsSummary = useCallback(
    async (subjectId: string): Promise<SubjectAnalyticsSummary | null> => {
      if (!user) return null;

      try {
        const { data, error } = await supabase
          .from('subject_analytics_summary')
          .select('*')
          .eq('user_id', user.id)
          .eq('subject_id', subjectId)
          .single();

        if (error) {
          if (error.code === 'PGRST116') {
            // No rows - return null
            return null;
          }
          throw error;
        }

        return data as SubjectAnalyticsSummary;
      } catch (error) {
        console.error('Error getting subject analytics summary:', error);
        return null;
      }
    },
    [user]
  );

  /**
   * Update subject analytics by aggregating current data
   */
  const updateSubjectAnalytics = useCallback(
    async (subjectId: string, silent: boolean = false): Promise<SubjectAnalyticsSummary | null> => {
      if (!user) return null;

      try {
        // Get flashcard stats (filtered by subject)
        const { data: flashcards, error: flashcardsError } = await supabase
          .from('flashcards')
          .select('is_mastered, deck_id, flashcard_decks!inner(subject_id, title, nbt_lesson_id)')
          .eq('user_id', user.id)
          .eq('flashcard_decks.subject_id', subjectId);

        if (flashcardsError) throw flashcardsError;

        // Filter out NBT flashcards (by title OR by nbt_lesson_id)
        const nonNBTFlashcards = (flashcards || []).filter(f =>
          !f.flashcard_decks?.title?.toUpperCase().includes('NBT') &&
          !(f.flashcard_decks as any)?.nbt_lesson_id
        );

        const masteredCount = nonNBTFlashcards.filter((f) => f.is_mastered).length;
        const totalFlashcards = nonNBTFlashcards.length;

        // Get quiz stats (separate quizzes and exams)
        const { data: quizAnalytics, error: quizzesError } = await supabase
          .from('quiz_performance_analytics')
          .select('score, max_score, knowledge_id, quizzes(title)')
          .eq('user_id', user.id)
          .eq('subject_id', subjectId);

        if (quizzesError) throw quizzesError;

        // Filter out NBT quizzes
        const nonNBTQuizzes = (quizAnalytics || []).filter(q =>
          !(q.quizzes as any)?.title?.toUpperCase().includes('NBT')
        );

        const quizzes = nonNBTQuizzes.filter(q => !q.knowledge_id);
        const exams = nonNBTQuizzes.filter(q => !!q.knowledge_id);

        const totalQuizzes = quizzes.length;
        const averageQuizScore =
          totalQuizzes > 0
            ? quizzes.reduce((sum, q) => sum + (q.score / q.max_score) * 100, 0) / totalQuizzes
            : 0;

        const totalExams = exams.length;
        const averageExamScore =
          totalExams > 0
            ? exams.reduce((sum, q) => sum + (q.score / q.max_score) * 100, 0) / totalExams
            : 0;

        // Get lesson stats
        const { data: lessonData, error: lessonError } = await supabase
          .from('generated_lessons')
          .select('id, status, study_documents(subject_id)')
          .eq('user_id', user.id)
          .eq('status', 'completed');

        if (lessonError) throw lessonError;

        const subjectLessons = (lessonData || []).filter((l: any) => l.study_documents?.subject_id === subjectId);
        const totalLessons = subjectLessons.length;

        // Get past paper stats
        const { data: paperAttempts, error: paperError } = await supabase
          .from('past_paper_attempts')
          .select('score, max_score, document_id, documents(subject_id, title)')
          .eq('user_id', user.id);

        if (paperError) throw paperError;

        const subjectPapers = (paperAttempts || []).filter((p: any) =>
          p.documents?.subject_id === subjectId &&
          !p.documents?.title?.toUpperCase().includes('NBT')
        );
        const totalPapers = subjectPapers.length;
        const averagePaperScore =
          totalPapers > 0
            ? subjectPapers.reduce((sum, p) => sum + (p.score / p.max_score) * 100, 0) / totalPapers
            : 0;

        // Calculate combined weighted performance percentage (Subject Performance)
        // Equal weighting: 20% each for Exams, Quizzes, Past Papers, Flashcards, Lessons
        const WEIGHTS = {
          exam: 0.20,
          quiz: 0.20,
          paper: 0.20,
          flashcard: 0.20,
          lesson: 0.20
        };

        let totalWeightUsed = 0;
        let weightedSum = 0;

        // Add Exams weight if exists
        if (totalExams > 0) {
          weightedSum += averageExamScore * WEIGHTS.exam;
          totalWeightUsed += WEIGHTS.exam;
        }

        // Add Quizzes weight if exists
        if (totalQuizzes > 0) {
          weightedSum += averageQuizScore * WEIGHTS.quiz;
          totalWeightUsed += WEIGHTS.quiz;
        }

        // Add Papers weight if exists
        if (totalPapers > 0) {
          weightedSum += averagePaperScore * WEIGHTS.paper;
          totalWeightUsed += WEIGHTS.paper;
        }

        // Add Lessons weight (100% per completed lesson)
        if (totalLessons > 0) {
          weightedSum += 100 * WEIGHTS.lesson;
          totalWeightUsed += WEIGHTS.lesson;
        }

        // Add Flashcards weight (mastery percentage)
        if (totalFlashcards > 0) {
          const flashcardMastery = (masteredCount / totalFlashcards) * 100;
          weightedSum += flashcardMastery * WEIGHTS.flashcard;
          totalWeightUsed += WEIGHTS.flashcard;
        }

        // Exclude NBT data if the subject name is NBT related (though they should be separate already)
        // This is a safety check as per requirements
        const { data: subjectInfo } = await supabase
          .from('subjects')
          .select('name')
          .eq('id', subjectId)
          .single();

        const isNBTSubject = subjectInfo?.name?.toUpperCase().includes('NBT');

        if (isNBTSubject) {
          console.log('Skipping main analytics for NBT subject:', subjectId);
          return null;
        }

        // Normalize if not all categories are present
        const combinedPercentage = totalWeightUsed > 0 ? (weightedSum / totalWeightUsed) : 0;

        // Get time spent stats
        const { data: timeData, error: timeError } = await supabase
          .from('study_time_analytics')
          .select('total_minutes')
          .eq('user_id', user.id)
          .eq('subject_id', subjectId);

        if (timeError) throw timeError;

        const totalMinutes = (timeData || []).reduce((sum, t) => sum + (t.total_minutes || 0), 0);

        // Calculate progress percentage
        const progressPercentage =
          totalFlashcards > 0 ? (masteredCount / totalFlashcards) * 100 : 0;

        // Upsert to avoid duplicate key constraint errors
        const upsertPayload = {
          user_id: user.id,
          subject_id: subjectId,
          total_study_minutes: totalMinutes,
          total_quizzes_taken: totalQuizzes,
          total_exams_taken: totalExams,
          total_lessons_completed: totalLessons,
          average_quiz_score: Math.round(averageQuizScore * 100) / 100,
          average_exam_score: Math.round(averageExamScore * 100) / 100,
          total_flashcards_mastered: masteredCount,
          total_flashcards_created: totalFlashcards,
          progress_percentage: Math.round(combinedPercentage * 100) / 100,
          last_studied_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        const { data: upserted, error: upsertError } = await supabase
          .from('subject_analytics_summary')
          .upsert(upsertPayload as any, { onConflict: 'user_id,subject_id' })
          .select()
          .single();

        if (upsertError) throw upsertError;
        let result: SubjectAnalyticsSummary | null = upserted as SubjectAnalyticsSummary;

        if (!silent) {
          toast({
            title: 'Analytics updated',
            description: 'Subject analytics have been recalculated',
          });
        }

        return result;
      } catch (error: any) {
        console.error('Error updating subject analytics:', error.message || error);
        toast({
          title: 'Error',
          description: error.message || 'Failed to update analytics',
          variant: 'destructive',
        });
        return null;
      }
    },
    [user, toast]
  );

  /**
   * Get comprehensive progress data for a subject
   */
  const getSubjectProgress = useCallback(
    async (subjectId: string): Promise<SubjectProgress | null> => {
      if (!user) return null;

      try {
        // Get summary first
        let summary = await getSubjectAnalyticsSummary(subjectId);

        // If no summary, update to create one
        if (!summary) {
          summary = await updateSubjectAnalytics(subjectId);
        }

        if (!summary) {
          return null;
        }

        return {
          masteredFlashcards: summary.total_flashcards_mastered,
          totalFlashcards: summary.total_flashcards_created,
          percentMastered: summary.progress_percentage,
          averageQuizScore: summary.average_quiz_score,
          totalStudyMinutes: summary.total_study_minutes,
          lastActivityDate: summary.last_studied_at,
        };
      } catch (error) {
        console.error('Error getting subject progress:', error);
        return null;
      }
    },
    [user, getSubjectAnalyticsSummary, updateSubjectAnalytics]
  );

  /**
   * Get all subject analytics for user
   */
  const getAllSubjectAnalytics = useCallback(
    async (): Promise<SubjectAnalyticsSummary[]> => {
      if (!user) return [];

      try {
        const { data, error } = await supabase
          .from('subject_analytics_summary')
          .select('*')
          .eq('user_id', user.id)
          .order('last_studied_at', { ascending: false, nullsFirst: false });

        if (error) throw error;

        return (data as SubjectAnalyticsSummary[]) || [];
      } catch (error) {
        console.error('Error getting all subject analytics:', error);
        return [];
      }
    },
    [user]
  );

  /**
   * Compare progress across subjects
   */
  const compareSubjectProgress = useCallback(
    async (subjectIds: string[]): Promise<Map<string, SubjectProgress>> => {
      const results = new Map<string, SubjectProgress>();

      for (const subjectId of subjectIds) {
        const progress = await getSubjectProgress(subjectId);
        if (progress) {
          results.set(subjectId, progress);
        }
      }

      return results;
    },
    [getSubjectProgress]
  );

  /**
   * Get top performing subjects
   */
  const getTopSubjects = useCallback(
    async (
      limit: number = 5,
      sortBy: 'progress' | 'time' | 'quizzes' = 'progress'
    ): Promise<SubjectAnalyticsSummary[]> => {
      if (!user) return [];

      try {
        let query = supabase
          .from('subject_analytics_summary')
          .select('*')
          .eq('user_id', user.id);

        switch (sortBy) {
          case 'progress':
            query = query.order('progress_percentage', { ascending: false });
            break;
          case 'time':
            query = query.order('total_study_minutes', { ascending: false });
            break;
          case 'quizzes':
            query = query.order('total_quizzes_taken', { ascending: false });
            break;
        }

        const { data, error } = await query.limit(limit);

        if (error) throw error;

        return (data as SubjectAnalyticsSummary[]) || [];
      } catch (error) {
        console.error('Error getting top subjects:', error);
        return [];
      }
    },
    [user]
  );

  return {
    getSubjectAnalyticsSummary,
    updateSubjectAnalytics,
    getSubjectProgress,
    getAllSubjectAnalytics,
    compareSubjectProgress,
    getTopSubjects,
  };
};
