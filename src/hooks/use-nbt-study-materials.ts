import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

type StudyMaterial = Database['public']['Tables']['nbt_study_materials']['Row'];

interface UseNBTStudyMaterialsOptions {
  section?: 'AQL' | 'MAT' | 'QL';
  topic?: string;
  onlyPublished?: boolean;
}

export const useNBTStudyMaterials = (options: UseNBTStudyMaterialsOptions = {}) => {
  const { user } = useAuth();
  const [materials, setMaterials] = useState<StudyMaterial[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [refreshKey, setRefreshKey] = useState(0);

  const refresh = () => setRefreshKey(prev => prev + 1);

  useEffect(() => {
    const fetchMaterials = async () => {
      try {
        setLoading(true);
        let query = supabase
          .from('nbt_study_materials')
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

        const { data, error: fetchError } = await query;

        if (fetchError) throw fetchError;
        setMaterials(data || []);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch materials');
        setMaterials([]);
      } finally {
        setLoading(false);
      }
    };

    fetchMaterials();
  }, [options.section, options.topic, options.onlyPublished, refreshKey]);

  const createMaterial = async (material: Omit<StudyMaterial, 'id' | 'created_at' | 'updated_at'>) => {
    if (!user) throw new Error('User not authenticated');

    const { data, error: createError } = await supabase
      .from('nbt_study_materials')
      .insert([{ ...material, user_id: user.id }])
      .select()
      .single();

    if (createError) throw createError;
    setMaterials([...materials, data]);
    return data;
  };

  const updateMaterial = async (id: string, updates: Partial<StudyMaterial>) => {
    const { data, error: updateError } = await supabase
      .from('nbt_study_materials')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (updateError) throw updateError;
    setMaterials(materials.map(m => m.id === id ? data : m));
    return data;
  };

  const deleteMaterial = async (id: string) => {
    const { error: deleteError } = await supabase
      .from('nbt_study_materials')
      .delete()
      .eq('id', id);

    if (deleteError) throw deleteError;
    setMaterials(materials.filter(m => m.id !== id));
  };

  return {
    materials,
    loading,
    error,
    createMaterial,
    updateMaterial,
    deleteMaterial,
    refresh
  };
};
