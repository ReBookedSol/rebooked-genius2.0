import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

type PracticeTest = Database['public']['Tables']['nbt_practice_tests']['Row'];
type TestAttempt = Database['public']['Tables']['nbt_test_attempts']['Row'];
type TestQuestion = Database['public']['Tables']['nbt_test_questions']['Row'];

interface UseNBTPracticeTestsOptions {
  section?: 'AQL' | 'MAT' | 'QL' | 'FULL';
  onlyPublished?: boolean;
}

export const useNBTPracticeTests = (options: UseNBTPracticeTestsOptions = {}) => {
  const { user } = useAuth();
  const [tests, setTests] = useState<PracticeTest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) { setLoading(false); return; }

    const fetchTests = async () => {
      try {
        setLoading(true);
        let query = supabase
          .from('nbt_practice_tests')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });

        if (options.onlyPublished) {
          query = query.eq('is_published', true);
        }

        if (options.section) {
          query = query.eq('section', options.section);
        }

        const { data, error: fetchError } = await query;

        if (fetchError) throw fetchError;
        setTests(data || []);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch tests');
        setTests([]);
      } finally {
        setLoading(false);
      }
    };

    fetchTests();
  }, [user, options.section, options.onlyPublished]);

  const createTest = async (test: Omit<PracticeTest, 'id' | 'created_at' | 'updated_at'>) => {
    if (!user) throw new Error('User not authenticated');

    const { data, error: createError } = await supabase
      .from('nbt_practice_tests')
      .insert([{ ...test, user_id: user.id }])
      .select()
      .single();

    if (createError) throw createError;
    setTests([...tests, data]);
    return data;
  };

  return {
    tests,
    loading,
    error,
    createTest,
  };
};

export const useNBTTestAttempts = (testId?: string) => {
  const { user } = useAuth();
  const [attempts, setAttempts] = useState<TestAttempt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;

    const fetchAttempts = async () => {
      try {
        setLoading(true);
        let query = supabase
          .from('nbt_test_attempts')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });

        if (testId) {
          query = query.eq('test_id', testId);
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
  }, [user, testId]);

  const createAttempt = async (attempt: Omit<TestAttempt, 'id' | 'created_at'>) => {
    if (!user) throw new Error('User not authenticated');

    const { data, error: insertError } = await supabase
      .from('nbt_test_attempts')
      .insert([{ ...attempt, user_id: user.id }])
      .select()
      .single();

    if (insertError) throw insertError;
    setAttempts([data, ...attempts]);
    return data;
  };

  const updateAttempt = async (id: string, updates: Partial<TestAttempt>) => {
    const { data, error: updateError } = await supabase
      .from('nbt_test_attempts')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (updateError) throw updateError;
    setAttempts(attempts.map(a => a.id === id ? data : a));
    return data;
  };

  return {
    attempts,
    loading,
    error,
    createAttempt,
    updateAttempt,
  };
};

export const useNBTUserProgress = () => {
  const { user } = useAuth();
  const [progress, setProgress] = useState<Database['public']['Tables']['nbt_user_progress']['Row'] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;

    const fetchProgress = async () => {
      try {
        setLoading(true);
        const { data, error: fetchError } = await supabase
          .from('nbt_user_progress')
          .select('*')
          .eq('user_id', user.id)
          .single();

        if (fetchError && fetchError.code !== 'PGRST116') throw fetchError;
        setProgress(data || null);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch progress');
      } finally {
        setLoading(false);
      }
    };

    fetchProgress();
  }, [user]);

  return {
    progress,
    loading,
    error,
  };
};
