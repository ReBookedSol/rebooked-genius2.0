import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

type ExplanationStyle = 'simple' | 'detailed' | 'analogy' | 'visual';

interface ExplanationRecord {
  id: string;
  user_id: string;
  flashcard_id: string;
  explanation_style: ExplanationStyle;
  explanation_text: string;
  rating?: number;
  user_feedback?: string;
  usage_count: number;
  created_at: string;
  updated_at: string;
}

interface ExplanationResult {
  cached: boolean;
  explanation: string;
  style: ExplanationStyle;
  rating?: number;
  usageCount: number;
}

export const useFlashcardExplanation = () => {
  const { user } = useAuth();
  const { toast } = useToast();

  /**
   * Get or generate explanation for a flashcard
   * Returns cached explanation if available, null if needs generation
   */
  const getOrGenerateExplanation = useCallback(
    async (flashcardId: string, style: ExplanationStyle = 'simple'): Promise<ExplanationResult | null> => {
      if (!user) {
        toast({
          title: 'Error',
          description: 'User not authenticated',
          variant: 'destructive',
        });
        return null;
      }

      try {
        // Check cache first
        const { data: cached, error: cacheError } = await supabase
          .from('flashcard_ai_explanations')
          .select('*')
          .eq('flashcard_id', flashcardId)
          .eq('user_id', user.id)
          .eq('explanation_style', style)
          .single();

        if (cached && !cacheError) {
          // Increment usage count
          await supabase
            .from('flashcard_ai_explanations')
            .update({
              usage_count: (cached.usage_count || 0) + 1,
              updated_at: new Date().toISOString(),
            })
            .eq('id', cached.id);

          return {
            cached: true,
            explanation: cached.explanation_text,
            style: cached.explanation_style as ExplanationStyle,
            rating: cached.rating,
            usageCount: (cached.usage_count || 0) + 1,
          };
        }

        // Not cached - return null to indicate generation needed
        return null;
      } catch (error) {
        console.error('Error getting explanation:', error);
        return null;
      }
    },
    [user, toast]
  );

  /**
   * Cache an explanation for a flashcard
   */
  const cacheExplanation = useCallback(
    async (
      flashcardId: string,
      explanation: string,
      style: ExplanationStyle = 'simple'
    ): Promise<ExplanationRecord | null> => {
      if (!user) return null;

      try {
        // Check if explanation already exists
        const { data: existing, error: checkError } = await supabase
          .from('flashcard_ai_explanations')
          .select('*')
          .eq('flashcard_id', flashcardId)
          .eq('user_id', user.id)
          .eq('explanation_style', style)
          .single();

        if (existing && !checkError) {
          // Update existing
          const { data: updated, error: updateError } = await supabase
            .from('flashcard_ai_explanations')
            .update({
              explanation_text: explanation,
              updated_at: new Date().toISOString(),
            })
            .eq('id', existing.id)
            .select()
            .single();

          if (updateError) throw updateError;
          return updated as ExplanationRecord;
        }

        // Create new
        const { data: created, error: createError } = await supabase
          .from('flashcard_ai_explanations')
          .insert({
            user_id: user.id,
            flashcard_id: flashcardId,
            explanation_style: style,
            explanation_text: explanation,
            usage_count: 0,
          })
          .select()
          .single();

        if (createError) throw createError;

        return created as ExplanationRecord;
      } catch (error) {
        console.error('Error caching explanation:', error);
        toast({
          title: 'Error',
          description: 'Failed to cache explanation',
          variant: 'destructive',
        });
        return null;
      }
    },
    [user, toast]
  );

  /**
   * Rate an explanation
   */
  const rateExplanation = useCallback(
    async (
      explanationId: string,
      rating: number,
      feedback?: string
    ): Promise<boolean> => {
      if (!user) return false;

      try {
        if (rating < 1 || rating > 5) {
          throw new Error('Rating must be between 1 and 5');
        }

        const { error } = await supabase
          .from('flashcard_ai_explanations')
          .update({
            rating,
            user_feedback: feedback || null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', explanationId)
          .eq('user_id', user.id);

        if (error) throw error;

        toast({
          title: 'Rating saved',
          description: 'Thank you for your feedback',
        });

        return true;
      } catch (error) {
        console.error('Error rating explanation:', error);
        toast({
          title: 'Error',
          description: 'Failed to save rating',
          variant: 'destructive',
        });
        return false;
      }
    },
    [user, toast]
  );

  /**
   * Get all explanations for a flashcard
   */
  const getFlashcardExplanations = useCallback(
    async (flashcardId: string): Promise<ExplanationRecord[]> => {
      if (!user) return [];

      try {
        const { data, error } = await supabase
          .from('flashcard_ai_explanations')
          .select('*')
          .eq('flashcard_id', flashcardId)
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });

        if (error) throw error;

        return (data as ExplanationRecord[]) || [];
      } catch (error) {
        console.error('Error getting flashcard explanations:', error);
        return [];
      }
    },
    [user]
  );

  /**
   * Delete an explanation
   */
  const deleteExplanation = useCallback(
    async (explanationId: string): Promise<boolean> => {
      if (!user) return false;

      try {
        const { error } = await supabase
          .from('flashcard_ai_explanations')
          .delete()
          .eq('id', explanationId)
          .eq('user_id', user.id);

        if (error) throw error;

        toast({
          title: 'Explanation deleted',
          description: 'The explanation has been removed',
        });

        return true;
      } catch (error) {
        console.error('Error deleting explanation:', error);
        toast({
          title: 'Error',
          description: 'Failed to delete explanation',
          variant: 'destructive',
        });
        return false;
      }
    },
    [user, toast]
  );

  /**
   * Get highest-rated explanations for stats/analytics
   */
  const getTopExplanations = useCallback(
    async (limit: number = 10): Promise<ExplanationRecord[]> => {
      if (!user) return [];

      try {
        const { data, error } = await supabase
          .from('flashcard_ai_explanations')
          .select('*')
          .eq('user_id', user.id)
          .not('rating', 'is', null)
          .order('rating', { ascending: false })
          .order('usage_count', { ascending: false })
          .limit(limit);

        if (error) throw error;

        return (data as ExplanationRecord[]) || [];
      } catch (error) {
        console.error('Error getting top explanations:', error);
        return [];
      }
    },
    [user]
  );

  return {
    getOrGenerateExplanation,
    cacheExplanation,
    rateExplanation,
    getFlashcardExplanations,
    deleteExplanation,
    getTopExplanations,
  };
};
