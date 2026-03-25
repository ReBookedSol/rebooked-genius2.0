import { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { FileText, Play, Pencil, Check, X, ChevronRight, Tag, Loader2, Trash2, Lock, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useStudyMaterialSubjects } from '@/hooks/useStudyMaterialSubjects';
import { useSubscription } from '@/hooks/useSubscription';
import { useAuth } from '@/contexts/AuthContext';

interface Subject {
  id: string;
  name: string;
}

interface RenameableItemRowProps {
  id: string;
  name: string;
  type: 'document' | 'video';
  metadata?: string;
  onRename?: (newName: string) => void;
  onDelete?: () => void;
  onClick?: () => void;
  index?: number;
  shouldAnimate?: boolean;
  isBlocked?: boolean;
}

const RenameableItemRow: React.FC<RenameableItemRowProps> = ({
  id,
  name,
  type,
  metadata,
  onRename,
  onDelete,
  onClick,
  index = 0,
  shouldAnimate = true,
  isBlocked = false,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(name);
  const [isSaving, setIsSaving] = useState(false);
  const [isEditingSubject, setIsEditingSubject] = useState(false);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [selectedSubject, setSelectedSubject] = useState<string>('');
  const [loadingSubjects, setLoadingSubjects] = useState(true);
  const [savingSubject, setSavingSubject] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const { user } = useAuth();
  const { tagMaterialWithSubject, removeSubjectTag, getMaterialSubjects } = useStudyMaterialSubjects();
  const { tier } = useSubscription();
  const isPaidUser = tier === 'tier1' || tier === 'tier2';
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  // Fetch available subjects
  useEffect(() => {
    const fetchSubjects = async () => {
      if (!supabase || !user) return;
      try {
        const [enrolledRes, profileRes, usedRes] = await Promise.all([
          supabase
            .from('user_subjects')
            .select('subjects(id, name)')
            .eq('user_id', user.id),
          supabase
            .from('profiles')
            .select('subjects')
            .eq('user_id', user.id)
            .single(),
          supabase
            .from('study_documents')
            .select('subjects(id, name)')
            .eq('user_id', user.id)
            .not('subject_id', 'is', null),
        ]);

        const enrolledSubjects = enrolledRes.data?.map((d: any) => d.subjects).filter(Boolean) || [];
        const usedSubjects = usedRes.data?.map((d: any) => d.subjects).filter(Boolean) || [];

        let combined = [...enrolledSubjects, ...usedSubjects];

        if (enrolledSubjects.length === 0 && profileRes.data?.subjects) {
          const profileSubjectNames = Array.isArray(profileRes.data.subjects) ? profileRes.data.subjects : [];
          if (profileSubjectNames.length > 0) {
            const { data: subjectRows } = await supabase
              .from('subjects')
              .select('id, name')
              .in('name', profileSubjectNames);
            if (subjectRows?.length) {
              combined = [...combined, ...subjectRows];
            }
          }
        }

        const uniqueSubjects = Array.from(new Map(combined.map(s => [s.id, s])).values());
        setSubjects(uniqueSubjects);
      } catch (error: any) {
        console.error('Error fetching subjects:', error?.message || error);
        setSubjects([]);
      } finally {
        setLoadingSubjects(false);
      }
    };

    fetchSubjects();
  }, []);

  // Fetch current material's subject
  useEffect(() => {
    const fetchMaterialSubject = async () => {
      try {
        const materialSubjects = await getMaterialSubjects(id);
        if (materialSubjects && materialSubjects.length > 0) {
          setSelectedSubject(materialSubjects[0].subject_id);
        } else {
          // If no subjects, default to "general-studies" for UI consistency
          setSelectedSubject('general-studies');
        }
      } catch (error) {
        console.error('Error fetching material subject:', error);
      }
    };

    fetchMaterialSubject();
  }, [id, getMaterialSubjects]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleStartEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsEditing(true);
    setEditName(name);
  };

  const handleSave = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!editName.trim() || editName === name) {
      setIsEditing(false);
      return;
    }

    setIsSaving(true);
    try {
      // Notify parent to handle database persistence
      onRename?.(editName.trim());

      setIsEditing(false);
    } catch (error: any) {
      console.error('Error renaming:', error);
      toast({
        title: 'Error',
        description: 'Failed to rename. Please try again.',
        variant: 'destructive',
      });
      setEditName(name);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsEditing(false);
    setEditName(name);
  };

  const handleSaveSubject = async (newSubjectId: string) => {
    setSavingSubject(true);
    try {
      // If there was a previous subject, remove it
      if (selectedSubject) {
        await removeSubjectTag(id, selectedSubject);
      }

      // Add new subject tag if selected
      if (newSubjectId) {
        await tagMaterialWithSubject(id, newSubjectId);
      }

      setSelectedSubject(newSubjectId);
      setIsEditingSubject(false);

      const subjectName = subjects.find(s => s.id === newSubjectId)?.name || 'No subject';
      toast({
        title: 'Subject updated',
        description: `${type === 'document' ? 'Document' : 'Video'} assigned to: ${subjectName}`,
      });
    } catch (error: any) {
      console.error('Error saving subject:', error);
      toast({
        title: 'Error',
        description: 'Failed to update subject',
        variant: 'destructive',
      });
    } finally {
      setSavingSubject(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSave(e as any);
    } else if (e.key === 'Escape') {
      handleCancel(e as any);
    }
  };

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();

    if (!isPaidUser) {
      toast({
        title: 'Premium Feature',
        description: 'Deleting lessons is only available for Pro users.',
        variant: 'destructive',
      });
      return;
    }

    setShowDeleteDialog(true);
  };

  const handleConfirmDelete = async () => {
    setShowDeleteDialog(false);
    setIsDeleting(true);
    try {
      if (type === 'document') {
        // Delete generated_lessons that reference this study_document first
        await supabase
          .from('generated_lessons')
          .delete()
          .eq('document_id', id);

        // Delete from study_documents
        const { error: docError } = await supabase
          .from('study_documents')
          .delete()
          .eq('id', id);

        if (docError) throw docError;
      } else {
        // For videos: first delete generated_lessons referencing study_documents for this knowledge_base
        if (user) {
          // Find study_documents that reference this knowledge_base item
          const { data: relatedDocs } = await supabase
            .from('study_documents')
            .select('id')
            .eq('user_id', user.id)
            .eq('knowledge_id', id);

          // Delete generated_lessons for each related study_document
          if (relatedDocs && relatedDocs.length > 0) {
            const docIds = relatedDocs.map(d => d.id);
            await supabase
              .from('generated_lessons')
              .delete()
              .in('document_id', docIds);
          }

          // Delete study_documents
          await supabase
            .from('study_documents')
            .delete()
            .eq('user_id', user.id)
            .eq('knowledge_id', id);
        }

        // Then delete from knowledge_base
        const { error: kbError } = await supabase
          .from('knowledge_base')
          .delete()
          .eq('id', id);

        if (kbError) throw kbError;
      }

      toast({
        title: 'Deleted successfully',
        description: 'The item has been removed.',
      });

      // Refresh the parent UI
      onDelete?.();
    } catch (error: any) {
      console.error('Error deleting:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <motion.div
      initial={shouldAnimate ? { opacity: 0, y: 10 } : { opacity: 1, y: 0 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: shouldAnimate ? index * 0.05 : 0 }}
      onClick={isBlocked ? (e) => { e.stopPropagation(); toast({ title: "Upgrade required", description: "This document is locked because you've reached your free tier limit. Upgrade to unlock." }); } : onClick}
      className={`w-full flex flex-col items-start gap-3 p-4 bg-card border border-border rounded-lg hover:border-primary hover:bg-primary/5 hover:shadow-md transition-all group text-left relative cursor-pointer ${isBlocked ? 'opacity-60 grayscale' : ''}`}
    >
      <div className="flex items-start gap-3 w-full">
        {/* Icon */}
        <div className="w-10 h-10 rounded-lg bg-primary/15 flex items-center justify-center flex-shrink-0 mt-0">
          {isBlocked ? (
            <Lock className="w-5 h-5 text-muted-foreground" />
          ) : type === 'document' ? (
            <FileText className="w-5 h-5 text-primary" />
          ) : (
            <Play className="w-5 h-5 text-primary" />
          )}
        </div>

        {/* Name and Metadata */}
        <div className="flex-1 min-w-0 text-left overflow-hidden pr-28 sm:pr-32">
          {isEditing ? (
            <div
              className="space-y-2"
              onClick={(e) => e.stopPropagation()}
            >
              <Input
                ref={inputRef}
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={`Enter ${type === 'document' ? 'document' : 'video'} name...`}
                disabled={isSaving}
                className="h-9 text-sm"
              />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs"
                  onClick={handleSave}
                  disabled={isSaving || !editName.trim()}
                >
                  <Check className="w-3.5 h-3.5 mr-1" />
                  Save
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 text-xs"
                  onClick={handleCancel}
                  disabled={isSaving}
                >
                  <X className="w-3.5 h-3.5 mr-1" />
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <>
              <h3 className="font-semibold text-base text-foreground group-hover:text-primary transition-colors line-clamp-2 break-words">
                {name} {isBlocked && <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground ml-2">LOCKED</span>}
              </h3>
              {isBlocked ? (
                <p className="text-xs text-destructive mt-1 font-medium">
                  Soon to be deleted. Upgrade to keep.
                </p>
              ) : (
                <>
                  {metadata && (
                    <p className="text-xs md:text-sm text-muted-foreground mt-1">
                      {metadata}
                    </p>
                  )}
                </>
              )}
              {/* Subject Selector */}
              {isEditingSubject && (
                <div className="mt-2" onClick={(e) => e.stopPropagation()}>
                  <Select
                    value={selectedSubject || "none"}
                    onValueChange={(value) => handleSaveSubject(value === "none" ? "" : value)}
                    disabled={savingSubject || loadingSubjects}
                  >
                    <SelectTrigger className="h-7 text-xs">
                      <SelectValue placeholder="Select a subject" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No subject</SelectItem>
                      {subjects.map((subject) => (
                        <SelectItem key={subject.id} value={subject.id}>
                          {subject.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Actions - Fixed positioning to prevent blocking text */}
      {!isEditing && !isBlocked && (
        <div className="absolute top-3 right-3 flex items-center gap-1.5 sm:gap-2 lg:opacity-0 lg:pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-opacity z-10 bg-background/80 backdrop-blur-sm shadow-sm border border-border/50 px-2 py-1 rounded-md">
          <motion.div
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={(e) => {
              e.stopPropagation();
              setIsEditingSubject(!isEditingSubject);
            }}
            className="p-1.5 hover:bg-secondary rounded transition-colors cursor-pointer"
            title="Edit subject"
          >
            {savingSubject ? (
              <Loader2 className="w-4 h-4 text-muted-foreground animate-spin" />
            ) : (
              <Tag className="w-4 h-4 text-muted-foreground hover:text-primary transition-colors" />
            )}
          </motion.div>
          <motion.div
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={handleStartEdit}
            className="p-1.5 hover:bg-secondary rounded transition-colors cursor-pointer"
            title="Rename"
          >
            <Pencil className="w-4 h-4 text-muted-foreground hover:text-primary transition-colors" />
          </motion.div>
          {isPaidUser && (
            <motion.div
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={handleDeleteClick}
              className="p-1.5 hover:bg-secondary rounded transition-colors cursor-pointer"
              title="Delete"
            >
              {isDeleting ? (
                <Loader2 className="w-4 h-4 text-destructive animate-spin" />
              ) : (
                <Trash2 className="w-4 h-4 text-muted-foreground hover:text-destructive transition-colors" />
              )}
            </motion.div>
          )}
          <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
        </div>
      )}
      {isBlocked && (
        <div className="absolute top-3 right-3 z-10">
           <Button variant="ghost" size="sm" className="h-8 text-xs text-primary hover:bg-primary/10" onClick={(e) => {
             e.stopPropagation();
             // Open upgrade modal logic here
             window.dispatchEvent(new CustomEvent('openUpgradeModal'));
           }}>
             Upgrade
           </Button>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={(open) => { if (!open) setShowDeleteDialog(false); }}>
        <DialogContent className="sm:max-w-[400px] p-0 overflow-hidden border-none shadow-2xl" onClick={(e) => e.stopPropagation()}>
          <div className="bg-destructive px-6 py-4 flex items-center gap-3">
            <div className="bg-white/20 p-2 rounded-lg">
              <AlertTriangle className="w-5 h-5 text-white" />
            </div>
            <div>
              <DialogTitle className="text-white text-lg">Delete {type === 'document' ? 'Document' : 'Video'}</DialogTitle>
              <DialogDescription className="text-white/80 text-xs">
                This action cannot be undone
              </DialogDescription>
            </div>
          </div>
          <div className="p-6 bg-background">
            <p className="text-sm text-muted-foreground">
              Are you sure you want to delete <span className="font-bold text-foreground">"{name}"</span>? All associated lessons, quizzes, and flashcards will also be removed.
            </p>
          </div>
          <DialogFooter className="p-4 bg-muted/30 border-t flex flex-row gap-2 sm:justify-end">
            <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); setShowDeleteDialog(false); }} className="text-xs">
              Cancel
            </Button>
            <Button variant="destructive" size="sm" onClick={(e) => { e.stopPropagation(); handleConfirmDelete(); }} className="text-xs px-6 shadow-sm">
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
};

export default RenameableItemRow;
