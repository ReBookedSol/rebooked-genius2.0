import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

interface MasteryHistoryRecord {
  id: string;
  user_id: string;
  flashcard_id: string;
  deck_id: string;
  action: 'mastered' | 'unmastered';
  reason?: string;
  previous_state: boolean;
  new_state: boolean;
  created_at: string;
}

interface MasteryStats {
  masteredCount: number;
  unmasteredCount: number;
  totalCount: number;
}

export const useFlashcardMastery = () => {
  const { user } = useAuth();
  const { toast } = useToast();

  /**
   * Mark a flashcard as mastered
   */
  const markFlashcardMastered = useCallback(
    async (
      flashcardId: string,
      deckId: string,
      subjectId?: string
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
        // Get current mastery state
        const { data: flashcard, error: fetchError } = await supabase
          .from('flashcards')
          .select('is_mastered')
          .eq('id', flashcardId)
          .single();

        if (fetchError) throw fetchError;

        // Record mastery history
        const { error: historyError } = await supabase
          .from('flashcard_mastery_history')
          .insert({
            user_id: user.id,
            flashcard_id: flashcardId,
            deck_id: deckId,
            action: 'mastered',
            previous_state: flashcard?.is_mastered || false,
            new_state: true,
          });

        if (historyError) throw historyError;

        // Update flashcard mastered status
        const { error: updateError } = await supabase
          .from('flashcards')
          .update({ is_mastered: true })
          .eq('id', flashcardId);

        if (updateError) throw updateError;

        return true;
      } catch (error) {
        console.error('Error marking flashcard as mastered:', error);
        toast({
          title: 'Error',
          description: 'Failed to update mastery status',
          variant: 'destructive',
        });
        return false;
      }
    },
    [user, toast]
  );

  /**
   * Mark a flashcard as unmastered
   */
  const markFlashcardUnmastered = useCallback(
    async (flashcardId: string, deckId: string, reason?: string): Promise<boolean> => {
      if (!user) {
        toast({
          title: 'Error',
          description: 'User not authenticated',
          variant: 'destructive',
        });
        return false;
      }

      try {
        // Get current mastery state
        const { data: flashcard, error: fetchError } = await supabase
          .from('flashcards')
          .select('is_mastered')
          .eq('id', flashcardId)
          .single();

        if (fetchError) throw fetchError;

        // Record mastery history
        const { error: historyError } = await supabase
          .from('flashcard_mastery_history')
          .insert({
            user_id: user.id,
            flashcard_id: flashcardId,
            deck_id: deckId,
            action: 'unmastered',
            reason,
            previous_state: flashcard?.is_mastered || false,
            new_state: false,
          });

        if (historyError) throw historyError;

        // Update flashcard mastered status
        const { error: updateError } = await supabase
          .from('flashcards')
          .update({ is_mastered: false })
          .eq('id', flashcardId);

        if (updateError) throw updateError;

        // Note: No notification shown to avoid notification fatigue when marking cards for practice
        return true;
      } catch (error) {
        console.error('Error marking flashcard as unmastered:', error);
        toast({
          title: 'Error',
          description: 'Failed to update mastery status',
          variant: 'destructive',
        });
        return false;
      }
    },
    [user, toast]
  );

  /**
   * Get count of mastered flashcards in a deck
   */
  const getMasteredCount = useCallback(
    async (deckId: string): Promise<number> => {
      if (!user) return 0;

      try {
        const { count, error } = await supabase
          .from('flashcards')
          .select('*', { count: 'exact', head: true })
          .eq('deck_id', deckId)
          .eq('user_id', user.id)
          .eq('is_mastered', true);

        if (error) throw error;
        return count || 0;
      } catch (error) {
        console.error('Error getting mastered count:', error);
        return 0;
      }
    },
    [user]
  );

  /**
   * Get mastery history for a flashcard
   */
  const getMasteryHistory = useCallback(
    async (flashcardId: string): Promise<MasteryHistoryRecord[]> => {
      if (!user) return [];

      try {
        const { data, error } = await supabase
          .from('flashcard_mastery_history')
          .select('*')
          .eq('flashcard_id', flashcardId)
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });

        if (error) throw error;
        return (data as MasteryHistoryRecord[]) || [];
      } catch (error) {
        console.error('Error getting mastery history:', error);
        return [];
      }
    },
    [user]
  );

  /**
   * Get mastery statistics for a deck
   */
  const getMasteryStats = useCallback(
    async (deckId: string): Promise<MasteryStats> => {
      if (!user) {
        return { masteredCount: 0, unmasteredCount: 0, totalCount: 0 };
      }

      try {
        const { data, error } = await supabase
          .from('flashcards')
          .select('is_mastered')
          .eq('deck_id', deckId)
          .eq('user_id', user.id);

        if (error) throw error;

        const masteredCount = (data || []).filter((f) => f.is_mastered).length;
        const totalCount = data?.length || 0;

        return {
          masteredCount,
          unmasteredCount: totalCount - masteredCount,
          totalCount,
        };
      } catch (error) {
        console.error('Error getting mastery stats:', error);
        return { masteredCount: 0, unmasteredCount: 0, totalCount: 0 };
      }
    },
    [user]
  );

  return {
    markFlashcardMastered,
    markFlashcardUnmastered,
    getMasteredCount,
    getMasteryHistory,
    getMasteryStats,
  };
};
