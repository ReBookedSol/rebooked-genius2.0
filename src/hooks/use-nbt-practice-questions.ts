import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

type PracticeQuestion = Database['public']['Tables']['nbt_practice_questions']['Row'];
type PracticeAttempt = Database['public']['Tables']['nbt_practice_attempts']['Row'];

interface UseNBTPracticeQuestionsOptions {
  section?: 'AQL' | 'MAT' | 'QL';
  topic?: string;
  difficulty?: 'easy' | 'medium' | 'hard';
  onlyPublished?: boolean;
  limit?: number;
}

export const useNBTPracticeQuestions = (options: UseNBTPracticeQuestionsOptions = {}) => {
  const { user } = useAuth();
  const [questions, setQuestions] = useState<PracticeQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchQuestions = async () => {
      try {
        setLoading(true);
        let query = supabase
          .from('nbt_practice_questions')
          .select('*')
          .order('order_index', { ascending: true })
          .order('created_at', { ascending: false });

        if (options.onlyPublished) {
          query = query.eq('is_published', true);
        }

        if (options.section) {
          query = query.eq('section', options.section);
        }

        if (options.topic) {
          query = query.eq('topic', options.topic);
        }

        if (options.difficulty) {
          query = query.eq('difficulty', options.difficulty);
        }

        if (options.limit) {
          query = query.limit(options.limit);
        }

        const { data, error: fetchError } = await query;

        if (fetchError) throw fetchError;
        setQuestions(data || []);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch questions');
        setQuestions([]);
      } finally {
        setLoading(false);
      }
    };

    fetchQuestions();
  }, [options.section, options.topic, options.difficulty, options.onlyPublished, options.limit]);

  const createQuestion = async (question: Omit<PracticeQuestion, 'id' | 'created_at' | 'updated_at'>) => {
    if (!user) throw new Error('User not authenticated');

    const { data, error: createError } = await supabase
      .from('nbt_practice_questions')
      .insert([{ ...question, user_id: user.id }])
      .select()
      .single();

    if (createError) throw createError;
    setQuestions([...questions, data]);
    return data;
  };

  const updateQuestion = async (id: string, updates: Partial<PracticeQuestion>) => {
    const { data, error: updateError } = await supabase
      .from('nbt_practice_questions')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (updateError) throw updateError;
    setQuestions(questions.map(q => q.id === id ? data : q));
    return data;
  };

  const deleteQuestion = async (id: string) => {
    const { error: deleteError } = await supabase
      .from('nbt_practice_questions')
      .delete()
      .eq('id', id);

    if (deleteError) throw deleteError;
    setQuestions(questions.filter(q => q.id !== id));
  };

  return {
    questions,
    loading,
    error,
    createQuestion,
    updateQuestion,
    deleteQuestion,
  };
};

export const useNBTPracticeAttempts = (questionId?: string) => {
  const { user } = useAuth();
  const [attempts, setAttempts] = useState<PracticeAttempt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;

    const fetchAttempts = async () => {
      try {
        setLoading(true);
        let query = supabase
          .from('nbt_practice_attempts')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });

        if (questionId) {
          query = query.eq('question_id', questionId);
        }

        const { data, error: fetchError } = await query;

        if (fetchError) throw fetchError;
        setAttempts(data || []);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch attempts');
        setAttempts([]);
      } finally {
        setLoading(false);
      }
    };

    fetchAttempts();
  }, [user, questionId]);

  const recordAttempt = async (attempt: Omit<PracticeAttempt, 'id' | 'created_at'>) => {
    if (!user) throw new Error('User not authenticated');

    const { data, error: insertError } = await supabase
      .from('nbt_practice_attempts')
      .insert([{ ...attempt, user_id: user.id }])
      .select()
      .single();

    if (insertError) throw insertError;
    setAttempts([data, ...attempts]);
    return data;
  };

  return {
    attempts,
    loading,
    error,
    recordAttempt,
  };
};
