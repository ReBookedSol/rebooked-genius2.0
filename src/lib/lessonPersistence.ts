import { supabase } from '@/integrations/supabase/client';

export interface SavedGeneratedLesson {
  id: string;
  document_id: string;
  user_id: string;
  chunk_number: number;
  content: string;
  status: 'completed' | 'processing' | 'error';
  error?: string;
  created_at: string;
  updated_at: string;
}

/**
 * Check if lessons already exist in database for this document
 */
export async function checkLessonsExist(
  userId: string,
  documentId: string
): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('generated_lessons')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('document_id', documentId)
      .limit(1);

    if (error) throw error;
    return (data?.length || 0) > 0;
  } catch (error) {
    console.error('Error checking lessons:', error);
    return false;
  }
}

/**
 * Load all lessons for a document from database
 */
export async function loadLessonsFromDB(
  userId: string,
  documentId: string
): Promise<SavedGeneratedLesson[]> {
  try {
    const { data, error } = await supabase
      .from('generated_lessons')
      .select('*')
      .eq('user_id', userId)
      .eq('document_id', documentId)
      .order('chunk_number', { ascending: true });

    if (error) throw error;
    return data as SavedGeneratedLesson[];
  } catch (error) {
    console.error('Error loading lessons from DB:', error);
    return [];
  }
}

/**
 * Save a single lesson to database
 */
export async function saveLessonToDB(
  userId: string,
  documentId: string,
  chunkNumber: number,
  content: string,
  status: 'completed' | 'processing' | 'error' = 'completed',
  error?: string
): Promise<SavedGeneratedLesson | null> {
  try {
    const { data, error: dbError } = await supabase
      .from('generated_lessons')
      .upsert({
        user_id: userId,
        document_id: documentId,
        chunk_number: chunkNumber,
        content,
        status,
        error: error || null,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id,document_id,chunk_number',
      })
      .select()
      .single();

    if (dbError) {
      console.error('Supabase error saving single lesson:', {
        message: dbError.message,
        code: dbError.code,
        details: dbError.details,
      });
      throw dbError;
    }

    console.log(`Saved lesson chunk ${chunkNumber} for document ${documentId}`);
    return data as SavedGeneratedLesson;
  } catch (error) {
    console.error('Error saving lesson to DB:', error);
    if (error instanceof Error) {
      console.error('Error message:', error.message);
    }
    return null;
  }
}

/**
 * Save multiple lessons to database
 */
export async function saveLessonsToDB(
  userId: string,
  documentId: string,
  lessons: Array<{
    chunkNumber: number;
    content: string;
    status: 'completed' | 'processing' | 'error';
    error?: string;
  }>
): Promise<boolean> {
  try {
    if (lessons.length === 0) {
      console.log('No lessons to save');
      return true;
    }

    const lessonsToSave = lessons.map((lesson) => ({
      user_id: userId,
      document_id: documentId,
      chunk_number: lesson.chunkNumber,
      content: lesson.content,
      status: lesson.status,
      error: lesson.error || null,
      updated_at: new Date().toISOString(),
    }));

    console.log('Attempting to save/update lessons:', lessonsToSave.length, 'lessons');

    const { data, error } = await supabase
      .from('generated_lessons')
      .upsert(lessonsToSave, {
        onConflict: 'user_id,document_id,chunk_number',
      });

    if (error) {
      console.error('Supabase error details:', {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code,
      });
      throw error;
    }

    console.log('Successfully saved/updated', lessonsToSave.length, 'lessons to DB');
    return true;
  } catch (error) {
    console.error('Error saving lessons to DB:', error);
    if (error instanceof Error) {
      console.error('Error message:', error.message);
    }
    return false;
  }
}

/**
 * Delete all lessons for a document
 */
export async function deleteLessonsForDocument(
  userId: string,
  documentId: string
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('generated_lessons')
      .delete()
      .eq('user_id', userId)
      .eq('document_id', documentId);

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error deleting lessons:', error);
    return false;
  }
}
