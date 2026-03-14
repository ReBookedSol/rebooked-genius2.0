import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

interface ContextData {
  [key: string]: any;
}

interface ChatContextSession {
  id: string;
  user_id: string;
  conversation_id: string;
  subject_id?: string;
  active_lesson_id?: string;
  active_document_id?: string;
  active_quiz_id?: string;
  active_flashcard_id?: string;
  context_data: ContextData;
  started_at: string;
  updated_at: string;
}

interface ContextReference {
  id: string;
  user_id: string;
  message_id: string;
  conversation_id: string;
  reference_type: 'lesson' | 'document' | 'flashcard' | 'quiz' | 'subject';
  reference_id?: string;
  excerpt?: string;
  created_at: string;
}

export const useChatContext = () => {
  const { user } = useAuth();
  const { toast } = useToast();

  /**
   * Update chat context with active lesson/document/quiz
   */
  const updateChatContext = useCallback(
    async (
      conversationId: string,
      contextData: {
        subjectId?: string;
        activeLessonId?: string;
        activeDocumentId?: string;
        activeQuizId?: string;
        activeFlashcardId?: string;
        contextData?: ContextData;
      }
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
        // Check if context session exists
        const { data: existing, error: fetchError } = await supabase
          .from('chat_context_sessions')
          .select('id')
          .eq('conversation_id', conversationId)
          .eq('user_id', user.id)
          .single();

        if (existing) {
          // Update existing
          const { error: updateError } = await supabase
            .from('chat_context_sessions')
            .update({
              subject_id: contextData.subjectId || null,
              active_lesson_id: contextData.activeLessonId || null,
              active_document_id: contextData.activeDocumentId || null,
              active_quiz_id: contextData.activeQuizId || null,
              active_flashcard_id: contextData.activeFlashcardId || null,
              context_data: contextData.contextData || {},
              updated_at: new Date().toISOString(),
            })
            .eq('conversation_id', conversationId)
            .eq('user_id', user.id);

          if (updateError) throw updateError;
        } else {
          // Create new
          const { error: insertError } = await supabase
            .from('chat_context_sessions')
            .insert({
              user_id: user.id,
              conversation_id: conversationId,
              subject_id: contextData.subjectId || null,
              active_lesson_id: contextData.activeLessonId || null,
              active_document_id: contextData.activeDocumentId || null,
              active_quiz_id: contextData.activeQuizId || null,
              active_flashcard_id: contextData.activeFlashcardId || null,
              context_data: contextData.contextData || {},
            });

          if (insertError) throw insertError;
        }

        return true;
      } catch (error) {
        console.error('Error updating chat context:', error);
        toast({
          title: 'Error',
          description: 'Failed to update chat context',
          variant: 'destructive',
        });
        return false;
      }
    },
    [user, toast]
  );

  /**
   * Get current context for a conversation
   */
  const getChatContext = useCallback(
    async (conversationId: string): Promise<ChatContextSession | null> => {
      if (!user) return null;

      try {
        const { data, error } = await supabase
          .from('chat_context_sessions')
          .select('*')
          .eq('conversation_id', conversationId)
          .eq('user_id', user.id)
          .single();

        if (error) {
          if (error.code === 'PGRST116') {
            // No rows found - return null
            return null;
          }
          throw error;
        }

        return data as ChatContextSession;
      } catch (error) {
        console.error('Error getting chat context:', error);
        return null;
      }
    },
    [user]
  );

  /**
   * Add a context reference from chat message
   */
  const addContextReference = useCallback(
    async (
      messageId: string,
      conversationId: string,
      referenceType: 'lesson' | 'document' | 'flashcard' | 'quiz' | 'subject',
      referenceId?: string,
      excerpt?: string
    ): Promise<boolean> => {
      if (!user) return false;

      try {
        const { error } = await supabase
          .from('ai_context_references')
          .insert({
            user_id: user.id,
            message_id: messageId,
            conversation_id: conversationId,
            reference_type: referenceType,
            reference_id: referenceId || null,
            excerpt: excerpt || null,
          });

        if (error) throw error;

        return true;
      } catch (error) {
        console.error('Error adding context reference:', error);
        return false;
      }
    },
    [user]
  );

  /**
   * Get context references for a message
   */
  const getContextReferences = useCallback(
    async (messageId: string): Promise<ContextReference[]> => {
      if (!user) return [];

      try {
        const { data, error } = await supabase
          .from('ai_context_references')
          .select('*')
          .eq('message_id', messageId)
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });

        if (error) throw error;

        return (data as ContextReference[]) || [];
      } catch (error) {
        console.error('Error getting context references:', error);
        return [];
      }
    },
    [user]
  );

  /**
   * Get all context references for a conversation
   */
  const getConversationReferences = useCallback(
    async (conversationId: string): Promise<ContextReference[]> => {
      if (!user) return [];

      try {
        const { data, error } = await supabase
          .from('ai_context_references')
          .select('*')
          .eq('conversation_id', conversationId)
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });

        if (error) throw error;

        return (data as ContextReference[]) || [];
      } catch (error) {
        console.error('Error getting conversation references:', error);
        return [];
      }
    },
    [user]
  );

  /**
   * Clear context for a conversation
   */
  const clearContext = useCallback(
    async (conversationId: string): Promise<boolean> => {
      if (!user) return false;

      try {
        const { error } = await supabase
          .from('chat_context_sessions')
          .delete()
          .eq('conversation_id', conversationId)
          .eq('user_id', user.id);

        if (error) throw error;

        return true;
      } catch (error) {
        console.error('Error clearing context:', error);
        return false;
      }
    },
    [user]
  );

  return {
    updateChatContext,
    getChatContext,
    addContextReference,
    getContextReferences,
    getConversationReferences,
    clearContext,
  };
};
