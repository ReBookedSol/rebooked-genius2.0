import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useLessonGeneration } from '@/contexts/LessonGenerationContext';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, Loader2, Tag, Pencil, Check, X, ChevronLeft, ChevronRight, Sparkles, BookOpen, Brain, Target, ClipboardList, FileText, FileDown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useSubscription } from '@/hooks/useSubscription';
import { exportAllLessonsToPDF } from '@/lib/lessonPDFExport';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useStudyMaterialSubjects } from '@/hooks/useStudyMaterialSubjects';
import { useAIContext } from '@/contexts/AIContext';
import { useSidebar } from '@/contexts/SidebarContext';
import ProcessedContentPanel from '@/components/study/ProcessedContentPanel';
import { DocumentLessonView } from '@/components/study/DocumentLessonView';
import { PdfViewer } from '@/components/PdfViewer';
import DocumentFlashcardsView from '@/components/study/DocumentFlashcardsView';
import DocumentQuizzesView from '@/components/study/DocumentQuizzesView';
import DocumentExamsView from '@/components/study/DocumentExamsView';
import QuizTakingView from '@/components/study/QuizTakingView';
import FlashcardStudyView from '@/components/study/FlashcardStudyView';
import { YoutubeViewer } from '@/components/YoutubeViewer';
import { recordStudyActivity } from '@/utils/streak';
import { extractMarkdownSections, type MarkdownSection } from '@/lib/markdownUtils';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';

interface StudyDocument {
  id: string;
  user_id: string;
  knowledge_id: string;
  file_name: string;
  file_type: string | null;
  file_size: number | null;
  num_pages: number | null;
  extraction_status: string | null;
  summary: string | null;
  processed_content: string | null;
  key_concepts: string[] | null;
  created_at: string | null;
  updated_at: string | null;
  extracted_sections: any | null;
  processing_error: string | null;
  subject_id?: string | null;
  knowledge_base?: {
    id: string;
    title: string;
    source_file_url: string | null;
    content: string;
  };
}

interface DocumentViewProps {
  documentId: string;
  onBack: () => void;
}

interface Subject {
  id: string;
  name: string;
}

type TabId = 'lessons' | 'flashcards' | 'quizzes' | 'exams' | 'document';

const DocumentView: React.FC<DocumentViewProps> = ({ documentId, onBack }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { tagMaterialWithSubject, removeSubjectTag, getMaterialSubjects } = useStudyMaterialSubjects();
  const { setAiContext } = useAIContext();
  const { isChatExpanded, chatWidth, setIsStudyView } = useSidebar();
  const isMobile = useIsMobile();
  const { isGenerating: isLessonGenerating } = useLessonGeneration();

  const [document, setDocument] = useState<StudyDocument | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(!isMobile);

  useEffect(() => {
    setIsSidebarExpanded(!isMobile);
  }, [isMobile]);

  const initialTab = searchParams.get('tab') as TabId | null;
  const initialQuizId = searchParams.get('quizId');
  const initialDeckId = searchParams.get('deckId');

  const [activeTab, setActiveTab] = useState<TabId>(initialTab || 'lessons');
  const [lessonContent, setLessonContent] = useState<string>('');
  const [lessonId, setLessonId] = useState<string | undefined>();
  const [lessonSections, setLessonSections] = useState<MarkdownSection[]>([]);
  const [selectedSectionId, setSelectedSectionId] = useState<string | undefined>();
  const [takingQuizId, setTakingQuizId] = useState<string | null>(initialQuizId);
  const [takingFlashcardDeckId, setTakingFlashcardDeckId] = useState<string | null>(initialDeckId);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [selectedSubject, setSelectedSubject] = useState<string>('');
  const [savingSubject, setSavingSubject] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [newName, setNewName] = useState('');
  const [isSavingName, setIsSavingName] = useState(false);
  const [isAnyGenerating, setIsAnyGenerating] = useState(false);
  const { tier } = useSubscription();
  const isFreeTier = tier === 'free';

  // Hide the mobile bottom nav when inside study material (all tabs)
  useEffect(() => {
    setIsStudyView(true);
    return () => setIsStudyView(false);
  }, [setIsStudyView]);

  // Block hardware back button during generation on mobile
  useEffect(() => {
    const handlePopState = (e: PopStateEvent) => {
      if (isLessonGenerating || isAnyGenerating) {
        // Stop the back navigation
        window.history.pushState(null, '', window.location.href);
        toast({
          title: 'Generation in progress',
          description: 'Please wait for the current generation to finish before navigating away.',
          variant: 'destructive'
        });
      }
    };

    if (isLessonGenerating || isAnyGenerating) {
      window.history.pushState(null, '', window.location.href);
      window.addEventListener('popstate', handlePopState);
    }

    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [isLessonGenerating, isAnyGenerating, toast]);

  // Close sidebar on mobile when tab changes
  useEffect(() => {
    if (isMobile) {
      setIsSidebarExpanded(false);
    }
  }, [activeTab, isMobile]);

  const tabs = [
    { id: 'lessons' as TabId, label: 'Lesson', icon: <BookOpen className="w-4 h-4" />, description: 'Core study notes' },
    { id: 'quizzes' as TabId, label: 'Quizzes', icon: <Target className="w-4 h-4" />, description: 'Topic practice' },
    { id: 'exams' as TabId, label: 'Exams', icon: <ClipboardList className="w-4 h-4" />, description: 'Timed assessments' },
    { id: 'flashcards' as TabId, label: 'Flashcards', icon: <Brain className="w-4 h-4" />, description: 'Quick recall' },
    { id: 'document' as TabId, label: 'Resources', icon: <FileText className="w-4 h-4" />, description: 'Source materials' },
  ];

  // Track reading progress
  useEffect(() => {
    // Reading progress tracking removed as per requirements
  }, [activeTab, document]);

  // Fetch available subjects (include profile subjects fallback)
  useEffect(() => {
    const fetchSubjects = async () => {
      if (!user) return;
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

        // Fallback to profile subjects if no enrolled subjects
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
            // Synthetic fallback: add profile subjects that have no DB match
            const matchedNames = new Set((subjectRows || []).map((s: any) => s.name));
            const unmatchedNames = profileSubjectNames.filter((n: string) => !matchedNames.has(n));
            for (const name of unmatchedNames) {
              combined.push({ id: `profile-${name}`, name });
            }
          }
        }

        const uniqueSubjects = Array.from(new Map(combined.map(s => [s.id, s])).values());

        setSubjects(uniqueSubjects);
      } catch (error: any) {
        console.error('Error fetching subjects:', error?.message || error);
        setSubjects([]);
      }
    };

    fetchSubjects();
  }, [user]);

  // Fetch document's current subject
  useEffect(() => {
    const fetchDocumentSubject = async () => {
      if (!documentId || !user) return;
      try {
        // Directly query the study_documents table for the subject_id
        const { data: docData } = await supabase
          .from('study_documents')
          .select('subject_id')
          .eq('id', documentId)
          .eq('user_id', user.id)
          .maybeSingle();

        if (docData?.subject_id) {
          setSelectedSubject(docData.subject_id);
        } else {
          setSelectedSubject('');
        }
      } catch (error) {
        console.error('Error fetching document subject:', error);
      }
    };

    fetchDocumentSubject();
  }, [documentId, user]);

  useEffect(() => {
    const fetchDocument = async () => {
      if (!user || !documentId) return;

      try {
        setLoading(true);
        const { data, error } = await supabase
          .from('study_documents')
          .select(`
            id, user_id, knowledge_id, file_name, file_size, file_type, num_pages,
            extraction_status, processed_content, summary, key_concepts,
            created_at, updated_at, extracted_sections, processing_error, subject_id,
            knowledge_base(id, title, source_file_url, content)
          `)
          .eq('id', documentId)
          .eq('user_id', user.id)
          .single();

        if (error) {
          if ((error as any).code === 'PGRST116') {
            throw new Error('Document not found or you do not have access to it');
          }
          throw error;
        }

        const typedData = data as StudyDocument;
        setDocument(typedData);
        setNewName(typedData.file_name);

        try {
          await recordStudyActivity(user.id, 'document_view', typedData.subject_id || null);
        } catch (activityError) {
          console.warn('Could not record study activity:', activityError);
        }
      } catch (error) {
        console.error('Error fetching document:', error);
        const errorMessage = error instanceof Error ? error.message : 'Failed to load document';
        toast({ title: 'Error', description: errorMessage, variant: 'destructive' });
        onBack();
      } finally {
        setLoading(false);
      }
    };

    fetchDocument();
  }, [user, documentId, onBack, toast]);

  // Update AI context - include lesson content when on lessons tab
  useEffect(() => {
    if (document) {
      const subjectName = subjects.find(s => s.id === selectedSubject)?.name;
      // When on the lessons tab, share lesson content for AI context
      const contextContent = activeTab === 'lessons' && lessonContent
        ? lessonContent.substring(0, 5000)
        : document.processed_content?.substring(0, 3000);
      
      setAiContext({
        currentPage: 'study',
        location: `Studying document: ${document.file_name} (${activeTab} view)`,
        activeDocument: {
          id: document.id,
          name: document.file_name,
          subject: subjectName,
          type: document.file_type || 'Study Document',
          content: contextContent,
          is_past_paper: (document as any).is_past_paper || document.file_name.toLowerCase().includes('paper')
        },
        activePaper: null,
        activeAnalytics: null
      });
    }
  }, [document, activeTab, selectedSubject, subjects, setAiContext, lessonContent]);

  // Load saved lessons
  useEffect(() => {
    const loadSavedLessonsIntoContent = async () => {
      if (!user || !document?.id || lessonContent) return;
      try {
        const { data, error } = await supabase
          .from('generated_lessons')
          .select('*')
          .eq('user_id', user.id)
          .eq('document_id', document.id)
          .order('chunk_number', { ascending: true });

        if (error) { console.warn('Could not load saved lessons:', error); return; }
        if (data && data.length > 0) {
          const completedLessons = data.filter((l: any) => l.status === 'completed' && l.content);
          if (completedLessons.length > 0) {
            const combinedContent = completedLessons.map((l: any) => l.content).join('\n\n---\n\n');
            setLessonContent(combinedContent);
          }
        }
      } catch (error) {
        console.warn('Error loading saved lessons into content:', error);
      }
    };

    loadSavedLessonsIntoContent();
  }, [user, document?.id, lessonContent]);

  const handleSubjectChange = async (newSubjectId: string) => {
    if (!documentId || !user) return;
    setSavingSubject(true);
    try {
      if (selectedSubject) await removeSubjectTag(documentId, selectedSubject);
      if (newSubjectId) await tagMaterialWithSubject(documentId, newSubjectId);
      setSelectedSubject(newSubjectId);
      setDocument(prev => prev ? { ...prev, subject_id: newSubjectId } : null);

      const dbSubjectId = newSubjectId === 'general-studies' ? null : newSubjectId;

      // Update subject_id on existing quizzes for this document
      const { data: docData } = await supabase
        .from('study_documents')
        .select('knowledge_id')
        .eq('id', documentId)
        .maybeSingle();

      if (docData?.knowledge_id) {
        // Update quizzes linked to this document's knowledge_id
        await supabase
          .from('quizzes')
          .update({ subject_id: dbSubjectId })
          .eq('user_id', user.id)
          .eq('source_knowledge_id', docData.knowledge_id);

        // Update quiz_performance_analytics for existing entries
        await supabase
          .from('quiz_performance_analytics')
          .update({ subject_id: dbSubjectId })
          .eq('user_id', user.id)
          .eq('knowledge_id', docData.knowledge_id);

        // Update flashcard decks linked to this document
        await supabase
          .from('flashcard_decks')
          .update({ subject_id: dbSubjectId })
          .eq('user_id', user.id)
          .eq('source_knowledge_id', docData.knowledge_id);

        // Update study_exams linked to this document
        await supabase
          .from('study_exams')
          .update({ subject_id: dbSubjectId } as any)
          .eq('user_id', user.id)
          .eq('document_id', documentId);
      }


      const subjectName = subjects.find(s => s.id === newSubjectId)?.name || 'No subject';
      toast({ title: 'Subject updated', description: `Document assigned to: ${subjectName}` });
    } catch (error: any) {
      console.error('Error saving subject:', error);
      toast({ title: 'Error', description: 'Failed to update subject', variant: 'destructive' });
    } finally {
      setSavingSubject(false);
    }
  };

  const handleRename = async () => {
    if (!document || !newName.trim() || newName === document.file_name) {
      setIsRenaming(false);
      setNewName(document?.file_name || '');
      return;
    }
    setIsSavingName(true);
    try {
      const { error: docError } = await supabase
        .from('study_documents')
        .update({ file_name: newName.trim() })
        .eq('id', document.id);
      if (docError) throw docError;
      await supabase
        .from('knowledge_base')
        .update({ title: newName.trim() })
        .eq('id', document.knowledge_id);
      setDocument(prev => prev ? { ...prev, file_name: newName.trim() } : null);
      setIsRenaming(false);
      toast({ title: 'Renamed successfully', description: 'Document name updated.' });
    } catch (error: any) {
      console.error('Error renaming document:', error);
      toast({ title: 'Error', description: 'Failed to rename document.', variant: 'destructive' });
    } finally {
      setIsSavingName(false);
    }
  };

  const handleLessonContentUpdate = useCallback((content: string, id?: string) => {
    setLessonContent(content);
    if (id) setLessonId(id);
    const sections = extractMarkdownSections(content);
    setLessonSections(sections);
    if (sections.length > 0) setSelectedSectionId(sections[0].id);
  }, []);

  // Handle Ask AI from lesson - if expanded chat is open, send there; otherwise dispatch event
  const handleAskAIFromLesson = useCallback((selectedText: string, _lessonContext: string) => {
    const prompt = `Can you please further elaborate on this?\n\n"${selectedText}"`;
    if (isChatExpanded) {
      // Chat sidebar is already expanded - dispatch event to send message in current conversation
      window.dispatchEvent(new CustomEvent('sendChatMessage', { detail: { prompt } }));
    } else {
      // Open the floating panel
      window.dispatchEvent(new CustomEvent('openFlashcardExplanation', { detail: { prompt } }));
    }
  }, [isChatExpanded]);

  // Skeleton loading state
  if (loading) {
    return (
      <div className="fixed inset-0 z-50 bg-background flex flex-col lg:flex-row">
        {/* Sidebar skeleton */}
        <div className="bg-secondary/30 border-b lg:border-r border-border w-full lg:w-80 shrink-0 flex flex-col">
          <div className="p-6 border-b border-border/50">
            <Skeleton className="h-8 w-24 mb-4" />
            <div className="flex items-center gap-3">
              <Skeleton className="w-10 h-10 rounded-xl" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-5 w-40" />
              </div>
            </div>
          </div>
          <div className="p-4 border-b border-border/50 space-y-2">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-8 w-full" />
          </div>
          <nav className="flex-1 p-3 space-y-1">
            {[1, 2, 3, 4, 5].map(i => (
              <Skeleton key={i} className="h-12 w-full rounded-xl" />
            ))}
          </nav>
        </div>
        {/* Content skeleton */}
        <div className="flex-1 p-6 lg:p-10 space-y-6">
          <div className="max-w-3xl mx-auto space-y-6">
            <div className="flex items-center gap-2">
              <Skeleton className="h-6 w-20 rounded-full" />
              <Skeleton className="h-6 w-16 rounded-full" />
            </div>
            <Skeleton className="h-10 w-3/4" />
            <div className="space-y-4">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
              <Skeleton className="h-4 w-4/5" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </div>
            <Skeleton className="h-32 w-full rounded-xl" />
            <div className="space-y-4">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
              <Skeleton className="h-4 w-4/5" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!document) {
    return (
      <div className="fixed inset-0 z-50 bg-background flex flex-col items-center justify-center">
        <p className="text-muted-foreground mb-4">Document not found</p>
        <Button onClick={onBack} variant="outline">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Study
        </Button>
      </div>
    );
  }

  const renderContent = () => {
    switch (activeTab) {
      case 'lessons':
        return (
          <div id="study-content-scroll" className="h-full overflow-y-auto">
            <DocumentLessonView
              document={document}
              onLessonContentUpdate={handleLessonContentUpdate}
              onAskAI={handleAskAIFromLesson}
            />
          </div>
        );
      case 'document':
        const isYoutube = document?.file_type === 'video/youtube' ||
                         (document?.knowledge_base as any)?.content_type === 'youtube_lesson';

        return (
          <div className="w-full h-full flex flex-col">
            <div className="flex-1 overflow-auto bg-muted/30">
              {isYoutube && document?.knowledge_base?.source_file_url ? (
                <YoutubeViewer videoUrl={document.knowledge_base.source_file_url} />
              ) : document?.knowledge_base?.source_file_url ? (
                <PdfViewer fileUrl={document.knowledge_base.source_file_url} />
              ) : (
                <div className="flex items-center justify-center h-full">
                  <p className="text-muted-foreground">No source file available</p>
                </div>
              )}
            </div>
          </div>
        );
      case 'flashcards':
        if (takingFlashcardDeckId) {
          return (
            <FlashcardStudyView
              deckId={takingFlashcardDeckId}
              onBack={() => setTakingFlashcardDeckId(null)}
            />
          );
        }
        return (
          <DocumentFlashcardsView
            document={document}
            lessonContent={lessonContent}
            lessonSections={lessonSections}
            onDeckSelect={setTakingFlashcardDeckId}
            onGeneratingChange={(g) => setIsAnyGenerating(g)}
            subjectId={selectedSubject}
          />
        );
      case 'quizzes':
        if (takingQuizId) {
          return (
            <QuizTakingView
              quizId={takingQuizId}
              onBack={() => setTakingQuizId(null)}
              subjectId={selectedSubject}
            />
          );
        }
        return (
          <DocumentQuizzesView
            document={document}
            lessonContent={lessonContent}
            lessonSections={lessonSections}
            onQuizSelect={setTakingQuizId}
            subjectId={selectedSubject}
            onGeneratingChange={(g) => setIsAnyGenerating(g)}
          />
        );
      case 'exams':
        return (
          <DocumentExamsView
            document={{ ...document, subject_id: selectedSubject || document.subject_id }}
            lessonContent={lessonContent}
            onGeneratingChange={(g) => setIsAnyGenerating(g)}
          />
        );
      default:
        return null;
    }
  };

  const sidebarWidth = isMobile ? (isSidebarExpanded ? '100%' : '0px') : (isSidebarExpanded ? '320px' : '72px');

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col lg:flex-row overflow-hidden">
      {/* Mobile overlay backdrop */}
      {isMobile && isSidebarExpanded && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setIsSidebarExpanded(false)}
        />
      )}

      {/* Sidebar Navigation */}
      <div
        className={cn(
          "bg-secondary/30 border-r border-border shrink-0 flex flex-col z-50 transition-[width,opacity] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]",
          isMobile ? "fixed inset-y-0 left-0 overflow-hidden" : "relative overflow-visible"
        )}
        style={{
          width: isMobile ? (isSidebarExpanded ? 300 : 0) : (isSidebarExpanded ? 320 : 72),
          opacity: isMobile && !isSidebarExpanded ? 0 : 1,
        }}
      >
        {/* Sidebar Header */}
        <div className={cn(
          "p-4 lg:p-6 border-b border-border/50 relative",
          !isSidebarExpanded && !isMobile && "flex flex-col items-center"
        )}>
          {(isSidebarExpanded || isMobile) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                if (isLessonGenerating || isAnyGenerating) {
                  toast({ title: 'Generation in progress', description: 'Please wait for the current generation to finish before navigating away.', variant: 'destructive' });
                  return;
                }
                onBack();
              }}
              disabled={isLessonGenerating || isAnyGenerating}
              className={cn("mb-3 -ml-2", (isLessonGenerating || isAnyGenerating) ? "text-muted-foreground/50 cursor-not-allowed pointer-events-auto" : "text-muted-foreground hover:text-foreground")}
            >
              <ChevronLeft className="w-4 h-4 mr-1" />
              Back to Hub
            </Button>
          )}
          <div className={cn(
            "flex items-center gap-3",
            !isSidebarExpanded && !isMobile && "justify-center"
          )}>
            <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center shadow-lg shadow-primary/20 flex-shrink-0">
              <Sparkles className="w-6 h-6 text-primary-foreground" />
            </div>
            {(isSidebarExpanded || isMobile) && (
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider leading-none mb-1">Study Guide</p>
                {isRenaming ? (
                  <div className="flex items-center gap-1">
                    <Input
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleRename();
                        if (e.key === 'Escape') { setIsRenaming(false); setNewName(document.file_name); }
                      }}
                      className="h-7 text-sm"
                      autoFocus
                    />
                    <Button size="icon" variant="ghost" className="h-6 w-6 text-green-600" onClick={handleRename} disabled={isSavingName}>
                      {isSavingName ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                    </Button>
                    <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive" onClick={() => { setIsRenaming(false); setNewName(document.file_name); }}>
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-1">
                    <p className="font-black text-base lg:text-lg leading-tight truncate max-w-[160px]">{document.file_name}</p>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => { setIsRenaming(true); setNewName(document.file_name); }}
                      className="h-6 w-6 text-muted-foreground hover:text-primary shrink-0"
                    >
                      <Pencil className="w-3 h-3" />
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Toggle Button - desktop only */}
          <button
            onClick={() => setIsSidebarExpanded(!isSidebarExpanded)}
            className="absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-primary text-primary-foreground hidden lg:flex items-center justify-center shadow-lg hover:scale-110 transition-transform z-10"
          >
            {isSidebarExpanded ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </button>
        </div>

        {/* Subject Selector in Sidebar */}
        {(isSidebarExpanded || isMobile) && (
          <div className="p-4 border-b border-border/50">
            <div className="flex items-center gap-2 mb-2">
              <Tag className="w-3 h-3 text-muted-foreground" />
              <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Subject</span>
            </div>
            <Select
              value={selectedSubject || "none"}
              onValueChange={(value) => handleSubjectChange(value === "none" ? "" : value)}
              disabled={savingSubject}
            >
              <SelectTrigger className="w-full h-8 text-xs">
                <SelectValue placeholder="Select subject" />
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


        {/* Export PDF Button */}
        {(isSidebarExpanded || isMobile) && lessonContent && (
          <div className="p-4 border-b border-border/50">
            <Button
              variant="outline"
              size="sm"
              className="w-full gap-2 rounded-xl"
              onClick={async () => {
                if (!document || !lessonContent) return;
                try {
                  toast({ title: 'Generating PDF...', description: 'Please wait...' });
                  const lessonChunks = lessonContent.split('\n\n---\n\n').map((content, i) => ({
                    chunkNumber: i,
                    content,
                    status: 'completed' as const,
                    error: '',
                  }));
                  await exportAllLessonsToPDF(lessonChunks, `${document.file_name}-lesson.pdf`);
                  toast({ title: 'PDF Downloaded', description: 'Lesson exported successfully.' });
                } catch {
                  toast({ title: 'Export Failed', description: 'Please try again.', variant: 'destructive' });
                }
              }}
            >
              <FileDown className="w-4 h-4" />
              Export PDF
            </Button>
          </div>
        )}

        {/* Sidebar Tabs */}
        <nav className="flex-1 p-3 overflow-y-auto">
          <div className="flex flex-col gap-1">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id);
                  if (isMobile) setIsSidebarExpanded(false);
                }}
                className={cn(
                  "w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all",
                  activeTab === tab.id
                    ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground",
                  !isSidebarExpanded && !isMobile && "justify-center px-2"
                )}
              >
                {tab.icon}
                {(isSidebarExpanded || isMobile) && (
                  <div>
                    <p className="font-bold text-sm">{tab.label}</p>
                    <p className={cn(
                      "text-[10px] uppercase tracking-widest",
                      activeTab === tab.id ? "text-primary-foreground/70" : "text-muted-foreground"
                    )}>
                      {tab.description}
                    </p>
                  </div>
                )}
              </button>
            ))}
          </div>
        </nav>
      </div>

      {/* Mobile header bar */}
      {isMobile && (
        <div className="flex items-center justify-between px-2 sm:px-4 py-2 sm:py-3 border-b border-border bg-background shrink-0 w-full overflow-hidden gap-2">
          <div className="flex items-center gap-1 sm:gap-2 min-w-0 shrink-1">
            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => {
                if (isLessonGenerating || isAnyGenerating) {
                  toast({ title: 'Generation in progress', description: 'Please wait for generation to finish.', variant: 'destructive' });
                  return;
                }
                onBack();
              }}>
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <p className="font-bold text-sm truncate max-w-[120px] sm:max-w-[200px]">{document.file_name}</p>
          </div>
          <div className="flex items-center gap-0.5 sm:gap-1 overflow-x-auto hide-scrollbar shrink-0 px-1">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "p-1.5 sm:p-2 rounded-lg transition-colors shrink-0 flex items-center justify-center",
                  activeTab === tab.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary/50"
                )}
                title={tab.label}
              >
                {tab.icon}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Main Content */}
      <div
        className="flex-1 overflow-hidden transition-all duration-300 ease-in-out"
        style={{
          marginRight: (!isMobile && isChatExpanded) ? `${chatWidth}px` : '0px'
        }}
      >
        <motion.div
          key={activeTab}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.12 }}
          className="h-full"
        >
          {renderContent()}
        </motion.div>
      </div>
    </div>
  );
};

export default DocumentView;
