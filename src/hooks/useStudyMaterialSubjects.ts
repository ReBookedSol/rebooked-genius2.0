import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

interface SubjectTag {
  id: string;
  subject_id: string;
}

interface MaterialWithSubjects {
  document_id: string;
  file_name: string;
  subject_id?: string;
  subjects: SubjectTag[];
}

export const useStudyMaterialSubjects = () => {
  const { user } = useAuth();
  const { toast } = useToast();

  /**
   * Tag a study material with a subject
   */
  const tagMaterialWithSubject = useCallback(
    async (documentId: string, subjectId: string): Promise<boolean> => {
      if (!user) {
        toast({
          title: 'Error',
          description: 'User not authenticated',
          variant: 'destructive',
        });
        return false;
      }

      // Handle UI-only placeholders
      const dbSubjectId = subjectId === 'general-studies' || !subjectId ? null : subjectId;

      try {
        let knowledgeId: string | null = null;

        // 1. Try to update study_documents
        const { data: docData, error: documentError } = await supabase
          .from('study_documents')
          .update({ subject_id: dbSubjectId })
          .eq('id', documentId)
          .eq('user_id', user.id)
          .select('knowledge_id')
          .maybeSingle();

        if (documentError) throw documentError;

        if (docData) {
          knowledgeId = docData.knowledge_id;
        } else {
          // If not found in study_documents, documentId might be a knowledge_id (e.g. for videos)
          knowledgeId = documentId;
        }

        // 2. Update knowledge_base if we have a knowledgeId
        if (knowledgeId) {
          const { error: kbError } = await supabase
            .from('knowledge_base')
            .update({ subject_id: dbSubjectId })
            .eq('id', knowledgeId)
            .eq('user_id', user.id);

          if (kbError) console.warn('Could not update subject_id on knowledge_base:', kbError);
        }

        // 3. Update junction table if it's a study_document (only if dbSubjectId is not null)
        if (dbSubjectId && docData) {
          const { error: junctionError } = await supabase
            .from('study_material_subjects')
            .insert({
              user_id: user.id,
              study_document_id: documentId,
              subject_id: dbSubjectId,
            })
            .select()
            .single();

          // Handle unique constraint (duplicate) gracefully
          if (junctionError && !junctionError.message.includes('duplicate')) {
            throw junctionError;
          }
        }

        toast({
          title: 'Subject assigned',
          description: 'Study material tagged with subject',
        });

        return true;
      } catch (error) {
        console.error('Error tagging material with subject:', error);
        toast({
          title: 'Error',
          description: 'Failed to assign subject',
          variant: 'destructive',
        });
        return false;
      }
    },
    [user, toast]
  );

  /**
   * Remove a subject tag from a material
   */
  const removeSubjectTag = useCallback(
    async (documentId: string, subjectId: string): Promise<boolean> => {
      if (!user) return false;

      // Handle UI-only placeholders
      const dbSubjectId = subjectId === 'general-studies' || !subjectId ? null : subjectId;

      try {
        // 1. Clear from study_documents
        const { data: docData } = await supabase
          .from('study_documents')
          .update({ subject_id: null })
          .eq('id', documentId)
          .eq('user_id', user.id)
          .select('knowledge_id')
          .maybeSingle();

        // 2. Clear from knowledge_base
        const knowledgeId = docData?.knowledge_id || documentId;
        await supabase
          .from('knowledge_base')
          .update({ subject_id: null })
          .eq('id', knowledgeId)
          .eq('user_id', user.id);

        // If it was a placeholder, we're done
        if (!dbSubjectId) {
          toast({
            title: 'Subject removed',
            description: 'Study material untagged',
          });
          return true;
        }

        // 3. Remove from junction table
        const { error: junctionError } = await supabase
          .from('study_material_subjects')
          .delete()
          .eq('study_document_id', documentId)
          .eq('subject_id', dbSubjectId)
          .eq('user_id', user.id);

        if (junctionError) {
          // If delete failed, it might be because documentId was a knowledgeId
          console.warn('Could not delete from study_material_subjects:', junctionError);
        }

        // 4. Check if there are other subjects remaining (only if it was a study_document)
        if (docData) {
          const { count, error: countError } = await supabase
            .from('study_material_subjects')
            .select('*', { count: 'exact', head: true })
            .eq('study_document_id', documentId)
            .eq('user_id', user.id);

          if (!countError && count === 0) {
            // Clear primary subject_id again to be sure (already done above but good for logic)
            await supabase
              .from('study_documents')
              .update({ subject_id: null })
              .eq('id', documentId)
              .eq('user_id', user.id);
          }
        }

        toast({
          title: 'Subject removed',
          description: 'Study material untagged',
        });

        return true;
      } catch (error) {
        console.error('Error removing subject tag:', error);
        toast({
          title: 'Error',
          description: 'Failed to remove subject',
          variant: 'destructive',
        });
        return false;
      }
    },
    [user, toast]
  );

  /**
   * Get all materials under a subject
   */
  const getMaterialsBySubject = useCallback(
    async (subjectId: string) => {
      if (!user) return [];

      try {
        const { data, error } = await supabase
          .from('study_documents')
          .select('*')
          .eq('user_id', user.id)
          .eq('subject_id', subjectId)
          .order('created_at', { ascending: false });

        if (error) throw error;

        return data || [];
      } catch (error) {
        console.error('Error getting materials by subject:', error);
        return [];
      }
    },
    [user]
  );

  /**
   * Get all subjects assigned to a material
   */
  const getMaterialSubjects = useCallback(
    async (documentId: string): Promise<SubjectTag[]> => {
      if (!user) return [];

      try {
        // First check primary subject_id in study_documents
        const { data: docData, error: docError } = await supabase
          .from('study_documents')
          .select('subject_id, knowledge_id')
          .eq('id', documentId)
          .maybeSingle();

        let primarySubjectId: string | null = null;
        let knowledgeId: string | null = null;

        if (!docError && docData) {
          primarySubjectId = docData.subject_id;
          knowledgeId = docData.knowledge_id;
        } else {
          // Might be a knowledgeId
          knowledgeId = documentId;
        }

        // Check knowledge_base for subject_id if not found yet
        if (!primarySubjectId && knowledgeId) {
          const { data: kbData } = await supabase
            .from('knowledge_base')
            .select('subject_id')
            .eq('id', knowledgeId)
            .maybeSingle();

          if (kbData?.subject_id) {
            primarySubjectId = kbData.subject_id;
          }
        }

        // Then check junction table
        const { data, error } = await supabase
          .from('study_material_subjects')
          .select('subject_id')
          .eq('study_document_id', documentId)
          .eq('user_id', user.id);

        if (error) throw error;

        const subjects: SubjectTag[] = (data as any[])?.map((item) => ({
          id: item.subject_id,
          subject_id: item.subject_id,
        })) || [];

        // If primary subject exists and is not in the list, add it
        if (primarySubjectId && !subjects.find(s => s.subject_id === primarySubjectId)) {
          subjects.unshift({
            id: primarySubjectId,
            subject_id: primarySubjectId
          });
        }

        // If primary is null, but we want to show it as "general-studies" in UI
        // we handle that in the components, or we can add a virtual tag here.
        // For now, let's keep it clean and let the components decide how to handle null.

        return subjects;
      } catch (error) {
        console.error('Error getting material subjects:', error);
        return [];
      }
    },
    [user]
  );

  /**
   * Get material with all its subject tags
   */
  const getMaterialWithSubjects = useCallback(
    async (documentId: string): Promise<MaterialWithSubjects | null> => {
      if (!user) return null;

      try {
        const { data: document, error: docError } = await supabase
          .from('study_documents')
          .select('*')
          .eq('id', documentId)
          .eq('user_id', user.id)
          .single();

        if (docError) throw docError;

        const subjects = await getMaterialSubjects(documentId);

        return {
          document_id: document.id,
          file_name: document.file_name,
          subject_id: document.subject_id,
          subjects,
        };
      } catch (error) {
        console.error('Error getting material with subjects:', error);
        return null;
      }
    },
    [user, getMaterialSubjects]
  );

  /**
   * Bulk update subject tags for a material
   */
  const updateMaterialSubjects = useCallback(
    async (documentId: string, subjectIds: string[]): Promise<boolean> => {
      if (!user) return false;

      try {
        // Get existing subjects
        const existing = await getMaterialSubjects(documentId);
        const existingIds = existing.map((s) => s.subject_id);

        // Remove subjects that are no longer needed
        for (const existingId of existingIds) {
          if (!subjectIds.includes(existingId)) {
            await removeSubjectTag(documentId, existingId);
          }
        }

        // Add new subjects
        for (const subjectId of subjectIds) {
          if (!existingIds.includes(subjectId)) {
            await tagMaterialWithSubject(documentId, subjectId);
          }
        }

        return true;
      } catch (error) {
        console.error('Error updating material subjects:', error);
        return false;
      }
    },
    [user, getMaterialSubjects, removeSubjectTag, tagMaterialWithSubject]
  );

  return {
    tagMaterialWithSubject,
    removeSubjectTag,
    getMaterialsBySubject,
    getMaterialSubjects,
    getMaterialWithSubjects,
    updateMaterialSubjects,
  };
};
