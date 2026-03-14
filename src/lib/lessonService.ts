import { supabase } from '@/integrations/supabase/client';

export interface SavedLesson {
  id: string;
  user_id: string;
  title: string;
  description?: string;
  content: string;
  topic: string;
  material_type: 'notes';
  section?: 'AQL' | 'MAT' | 'QL';
  source_document_id?: string;
  created_at: string;
  updated_at: string;
}

/**
 * Save or update a lesson in the database
 */
export async function saveLesson(
  userId: string,
  lesson: {
    title: string;
    content: string;
    description?: string;
    topic?: string;
    section?: 'AQL' | 'MAT' | 'QL';
    documentId?: string;
    lessonId?: string; // If updating existing lesson
  }
): Promise<SavedLesson | null> {
  try {
    const lessonData = {
      user_id: userId,
      title: lesson.title,
      description: lesson.description || '',
      content: lesson.content,
      topic: lesson.topic || 'General',
      material_type: 'notes' as const,
      section: lesson.section || ('MAT' as const),
      updated_at: new Date().toISOString(),
    };

    let result;

    if (lesson.lessonId) {
      // Update existing lesson
      result = await supabase
        .from('nbt_study_materials')
        .update(lessonData)
        .eq('id', lesson.lessonId)
        .eq('user_id', userId)
        .select()
        .single();
    } else {
      // Create new lesson
      result = await supabase
        .from('nbt_study_materials')
        .insert([lessonData])
        .select()
        .single();
    }

    if (result.error) throw result.error;
    return result.data as SavedLesson;
  } catch (error) {
    console.error('Error saving lesson:', error);
    throw error;
  }
}

/**
 * Load a lesson by ID
 */
export async function loadLesson(userId: string, lessonId: string): Promise<SavedLesson | null> {
  try {
    const { data, error } = await supabase
      .from('nbt_study_materials')
      .select('*')
      .eq('id', lessonId)
      .eq('user_id', userId)
      .eq('material_type', 'notes')
      .single();

    if (error) throw error;
    return data as SavedLesson;
  } catch (error) {
    console.error('Error loading lesson:', error);
    return null;
  }
}

/**
 * Load all lessons for a user
 */
export async function loadUserLessons(userId: string): Promise<SavedLesson[]> {
  try {
    const { data, error } = await supabase
      .from('nbt_study_materials')
      .select('*')
      .eq('user_id', userId)
      .eq('material_type', 'notes')
      .order('updated_at', { ascending: false });

    if (error) throw error;
    return data as SavedLesson[];
  } catch (error) {
    console.error('Error loading lessons:', error);
    return [];
  }
}

/**
 * Delete a lesson
 */
export async function deleteLesson(userId: string, lessonId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('nbt_study_materials')
      .delete()
      .eq('id', lessonId)
      .eq('user_id', userId);

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error deleting lesson:', error);
    return false;
  }
}
