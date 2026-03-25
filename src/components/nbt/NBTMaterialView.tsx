import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import DOMPurify from 'dompurify';
import { 
  BookOpen, 
  Target, 
  Award, 
  Brain, 
  ChevronLeft, 
  ChevronRight, 
  ChevronDown, 
  MessageSquarePlus, 
  Sparkles, 
  Zap, 
  Clock, 
  ArrowLeft, 
  Loader2, 
  FileText, 
  FileDown, 
  Pencil, 
  Check, 
  X, 
  Play, 
  AlertTriangle,
  RotateCcw,
  Lightbulb,
  Sparkle,
  Plus,
  CheckCircle2,
  XCircle,
  Trophy,
  Info,
  Lock,
  History,
  ClipboardCheck,
  Layers
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { extractMarkdownSections } from '@/lib/markdownUtils';
import { useAuth } from '@/contexts/AuthContext';
import { useSidebar } from '@/contexts/SidebarContext';
import { useAIContext } from '@/contexts/AIContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { exportContentToPDF } from '@/lib/lessonPDFExport';
import { extractTextFromPDFInBatches } from '@/lib/pdfExtractor';
import { fetchPDFWithFreshSignedUrl, extractStoragePathFromSignedUrl } from '@/lib/pdfUrlManager';

import { YoutubeViewer } from '@/components/YoutubeViewer';
import { PdfViewer } from '@/components/PdfViewer';
import TextSelectionToolbar from '@/components/study/TextSelectionToolbar';
import InlineCommentPopover from '@/components/study/InlineCommentPopover';
import { highlightSelectedText } from '@/lib/textSelectionUtils';

interface NBTMaterialViewProps {
  material: {
    id: string;
    title: string;
    content: string;
    section: string;
    material_type: string;
    topic: string;
    isUserUpload?: boolean;
    document?: any;
    knowledge_id?: string;
  };
  onClose: () => void;
  onRefresh?: () => void;
}

const NBTMaterialView = ({ material, onClose, onRefresh }: NBTMaterialViewProps) => {
  const { user } = useAuth();
  const { setAiContext } = useAIContext();
  const { isChatExpanded, chatWidth, setIsStudyView } = useSidebar();
  const { toast } = useToast();
  
  const [activeTab, setActiveTab] = useState('lesson');
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(() => {
    return typeof window !== 'undefined' && window.innerWidth >= 1024;
  });

  const [isRenaming, setIsRenaming] = useState(false);
  const [newName, setNewName] = useState(material.title);
  const [isSavingName, setIsSavingName] = useState(false);
  const [materialTitle, setMaterialTitle] = useState(material.title);
  const [isGenerating, setIsGenerating] = useState(false);
  const [localContent, setLocalContent] = useState(material.content);
  const [nbtLessonId, setNbtLessonId] = useState<string | null>(null);
  
  const [isGeneratingQuiz, setIsGeneratingQuiz] = useState(false);
  const [isGeneratingExam, setIsGeneratingExam] = useState(false);
  const [isGeneratingFlashcards, setIsGeneratingFlashcards] = useState(false);
  
  const [existingQuizzes, setExistingQuizzes] = useState<any[]>([]);
  const [existingExams, setExistingExams] = useState<any[]>([]);
  const [existingFlashcards, setExistingFlashcards] = useState<any[]>([]);
  const [loadingExisting, setLoadingExisting] = useState(true);

  // Quiz State
  const [activeQuizId, setActiveQuizId] = useState<string | null>(null);
  const [activeQuizIndex, setActiveQuizIndex] = useState<number | null>(null);
  const [quizAnswers, setQuizAnswers] = useState<Record<string, string>>({});
  const [showQuizResults, setShowQuizResults] = useState(false);
  const [quizQuestionCount, setQuizQuestionCount] = useState(10);
  const [quizTotalMarks, setQuizTotalMarks] = useState(10);
  const [selectedQuizTopicIds, setSelectedQuizTopicIds] = useState<string[]>([]);
  const [quizLastScores, setQuizLastScores] = useState<Record<string, number>>({});

  // Exam State
  const [activeExamId, setActiveExamId] = useState<string | null>(null);
  const [activeExamIndex, setActiveExamIndex] = useState(0);
  const [examAnswers, setExamAnswers] = useState<Record<string, string>>({});
  const [showExamResults, setShowExamResults] = useState(false);
  const [examDifficulty, setExamDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium');
  const [examQuestionCount, setExamQuestionCount] = useState(20);
  const [selectedExamTopicIds, setSelectedExamTopicIds] = useState<string[]>([]);
  const [selectedExamQuestionTypes, setSelectedExamQuestionTypes] = useState<string[]>(['multipleChoice', 'trueFalse', 'fillInBlank']);

  // Flashcards State
  const [activeDeckId, setActiveDeckId] = useState<string | null>(null);
  const [activeDeckCardIndex, setActiveDeckCardIndex] = useState(0);
  const [showFlashcardBack, setShowFlashcardBack] = useState(false);
  const [flashcardCount, setFlashcardCount] = useState(20);
  const [selectedFlashcardTopicIds, setSelectedFlashcardTopicIds] = useState<string[]>([]);
  
  // Timer State for Exams
  const [examTimeLeft, setExamTimeLeft] = useState<number | null>(null);

  const [materialSection, setMaterialSection] = useState(material.section);
  const [isSavingSection, setIsSavingSection] = useState(false);

  // Always hide the mobile bottom nav when inside NBT study material
  useEffect(() => {
    setIsStudyView(true);
    return () => setIsStudyView(false);
  }, [setIsStudyView]);

  // Track whether any generation is in progress (used to disable close button)
  const isAnyGenerating = isGenerating || isGeneratingQuiz || isGeneratingExam || isGeneratingFlashcards;

  // Timer effect for Exams
  useEffect(() => {
    let timerId: NodeJS.Timeout;
    if (examTimeLeft !== null && examTimeLeft > 0 && activeExamId && !showExamResults) {
      timerId = setTimeout(() => setExamTimeLeft(examTimeLeft - 1), 1000);
    }
    return () => {
      if (timerId) clearTimeout(timerId);
    };
  }, [examTimeLeft, activeExamId, showExamResults]);

  useEffect(() => {
    const handleResize = () => {
      setIsSidebarExpanded(window.innerWidth >= 1024);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Comment state
  const [commentPopover, setCommentPopover] = useState<{
    visible: boolean;
    x: number;
    y: number;
    comment: string;
    highlightedText: string;
  }>({ visible: false, x: 0, y: 0, comment: '', highlightedText: '' });
  const [isCommentModalOpen, setIsCommentModalOpen] = useState(false);
  const [commentInputValue, setCommentInputValue] = useState('');
  const [pendingCommentText, setPendingCommentText] = useState('');

  // Update AI Context during quizzes
  useEffect(() => {
    if (activeTab === 'quizzes' && activeQuizId && activeQuizIndex !== null && !showQuizResults) {
      const currentQuiz = existingQuizzes.find(q => q.id === activeQuizId);
      const questions = currentQuiz?.nbt_practice_questions || [];
      const q = questions[activeQuizIndex];
      if (q) {
        setAiContext({
          activeNbtTest: {
            id: currentQuiz.id,
            section: currentQuiz.title || 'NBT Quiz',
            question: q.question_text,
            options: Array.isArray(q.options) ? q.options : [],
            index: activeQuizIndex,
            total: questions.length
          }
        });
      }
    } else {
      setAiContext({ activeNbtTest: null });
    }
  }, [activeTab, activeQuizIndex, showQuizResults, existingQuizzes, activeQuizId, setAiContext]);

  // Check for existing generated lesson
  useEffect(() => {
    const checkExistingLesson = async () => {
      if (!user) return;
      try {
        let query = supabase
          .from('nbt_generated_lessons')
          .select('id, content, title, section')
          .eq('user_id', user.id);

        if (material.isUserUpload && material.id) {
          query = query.eq('source_document_id', material.id);
        } else if (material.id && !material.id.startsWith('demo-')) {
          query = query.eq('source_material_id', material.id);
        }

        const { data: existingLesson } = await query
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (existingLesson) {
          setNbtLessonId(existingLesson.id);
          setLocalContent(existingLesson.content);
        }
      } catch (err) {
        console.error('Error checking existing lesson:', err);
      }
    };
    checkExistingLesson();
  }, [user, material.id, material.isUserUpload]);

  // Fetch existing quizzes/exams/flashcards
  const refreshExistingContent = async () => {
    if (!user) return;
    setLoadingExisting(true);
    try {
      let collectionsQuery = supabase
        .from('nbt_question_collections')
        .select('*, nbt_practice_questions(*)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (nbtLessonId) {
        collectionsQuery = collectionsQuery.eq('nbt_lesson_id', nbtLessonId);
      } else {
        collectionsQuery = collectionsQuery.eq('section', materialSection).is('nbt_lesson_id', null);
      }

      const { data: collections } = await collectionsQuery;
      if (collections) {
        setExistingQuizzes(collections.filter((c: any) => c.title?.toLowerCase().includes('quiz')));
        setExistingExams(collections.filter((c: any) => !c.title?.toLowerCase().includes('quiz')));
      }

      let flashcardsQuery = supabase
        .from('flashcard_decks')
        .select('*, flashcards(*)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (nbtLessonId) {
        flashcardsQuery = flashcardsQuery.eq('nbt_lesson_id', nbtLessonId);
      } else {
        flashcardsQuery = flashcardsQuery.ilike('title', `%NBT%${materialSection}%`).is('nbt_lesson_id', null);
      }

      const { data: flashcardDecks } = await flashcardsQuery;
      setExistingFlashcards(flashcardDecks || []);
    } catch (err) {
      console.error('Error fetching NBT content:', err);
    } finally {
      setLoadingExisting(false);
    }
  };

  useEffect(() => {
    refreshExistingContent();
  }, [user, materialSection, nbtLessonId]);

  const lessonSections = useMemo(() => {
    if (!localContent) return [];
    return extractMarkdownSections(localContent).filter((section) => section.content?.trim().length > 0);
  }, [localContent]);

  const getTopicScopedContent = (selectedIds: string[]) => {
    if (!localContent) return '';
    if (!selectedIds.length || !lessonSections.length) return localContent;
    const selectedSections = lessonSections.filter((section) => selectedIds.includes(section.id));
    return selectedSections.map((section) => `## ${section.title}\n${section.content}`).join('\n\n---\n\n');
  };

  const handleGenerate = async () => {
    if (!user || !material.document) return;
    setIsGenerating(true);
    try {
      const doc = material.document;
      let documentText = '';
      const isPDF = doc.file_name?.toLowerCase().endsWith('.pdf') || doc.file_type?.includes('pdf');
      const fileUrl = doc.isNbtDocument ? doc.source_file_url : doc.knowledge_base?.source_file_url;

      if (isPDF && fileUrl) {
        const storagePath = extractStoragePathFromSignedUrl(fileUrl);
        const blob = await fetchPDFWithFreshSignedUrl(fileUrl, storagePath);
        const file = new File([blob], doc.file_name || 'document.pdf', { type: 'application/pdf' });
        const result = await extractTextFromPDFInBatches(file);
        if (result.error) throw new Error(result.error);
        documentText = result.batches.map(b => b.text).join('\n');
      } else {
        documentText = doc.processed_content || (doc.isNbtDocument ? doc.content : doc.knowledge_base?.content) || '';
      }

      if (!documentText) throw new Error('No content found to analyze');

      const { data, error } = await supabase.functions.invoke('generate-lesson-nbt', {
        body: { documentText, section: materialSection, documentId: material.id }
      });

      if (error) throw error;
      if (data.lessonId) {
        setNbtLessonId(data.lessonId);
        const { data: lessonData } = await supabase.from('nbt_generated_lessons').select('content').eq('id', data.lessonId).single();
        if (lessonData?.content) setLocalContent(lessonData.content);
      }
      toast({ title: 'Success', description: 'NBT Study Guide generated!' });
      onRefresh?.();
    } catch (err: any) {
      console.error('NBT Generation error:', err);
      toast({ title: 'Error', description: err.message || 'Failed to generate NBT material', variant: 'destructive' });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleGenerateQuiz = async () => {
    if (!user || !localContent) return;
    setIsGeneratingQuiz(true);
    try {
      const contentToUse = getTopicScopedContent(selectedQuizTopicIds);
      const selectedTopics = lessonSections.filter(s => selectedQuizTopicIds.includes(s.id)).map(s => s.title);

      const { data, error } = await supabase.functions.invoke('generate-quiz-nbt', {
        body: {
          lessonContent: contentToUse,
          section: materialSection,
          materialId: material.id,
          nbtLessonId,
          count: quizQuestionCount,
          totalMarks: quizTotalMarks,
          selectedTopics,
        }
      });
      if (error) throw error;
      toast({ title: 'Success', description: 'NBT Quiz generated!' });
      await refreshExistingContent();
      if (data?.collectionId) {
        setActiveQuizId(data.collectionId);
        setActiveQuizIndex(0);
        setQuizAnswers({});
        setShowQuizResults(false);
      }
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setIsGeneratingQuiz(false);
    }
  };

  const handleRename = async () => {
    if (!newName.trim() || newName === materialTitle) {
      setIsRenaming(false);
      return;
    }
    setIsSavingName(true);
    try {
      if (material.id && !material.id.startsWith('demo-')) {
        await supabase.from('nbt_study_materials').update({ title: newName.trim() }).eq('id', material.id);
      }
      if (nbtLessonId) {
        await supabase.from('nbt_generated_lessons').update({ title: newName.trim() }).eq('id', nbtLessonId);
      }
      setMaterialTitle(newName.trim());
      setIsRenaming(false);
      toast({ title: 'Renamed successfully' });
      onRefresh?.();
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to rename', variant: 'destructive' });
    } finally {
      setIsSavingName(false);
    }
  };

  const handleSectionChange = async (newSection: string) => {
    if (!newSection || newSection === materialSection) return;
    setIsSavingSection(true);
    try {
      if (material.isUserUpload && material.id) {
        await supabase.from('nbt_user_documents').update({ section: newSection }).eq('id', material.id);
      }
      if (material.id && !material.id.startsWith('demo-')) {
        await supabase.from('nbt_study_materials').update({ section: newSection }).eq('id', material.id);
      }
      setMaterialSection(newSection);
      toast({ title: 'Section updated' });
      onRefresh?.();
    } catch (error) {
      toast({ title: 'Error', variant: 'destructive' });
    } finally {
      setIsSavingSection(false);
    }
  };

  const tabs = [
    { id: 'lesson', label: 'Lesson', icon: <BookOpen className="w-5 h-5" />, description: 'STUDY GUIDE' },
    { id: 'quizzes', label: 'Quizzes', icon: <Target className="w-5 h-5" />, description: 'PRACTICE' },
    { id: 'exams', label: 'Exams', icon: <Award className="w-5 h-5" />, description: 'MOCK TESTS' },
    { id: 'flashcards', label: 'Flashcards', icon: <Brain className="w-5 h-5" />, description: 'RECALL' },
    { id: 'document', label: 'Documents', icon: <FileText className="w-5 h-5" />, description: 'SOURCE' },
  ];

  const persistContentAreaChanges = () => {
    const contentArea = window.document.querySelector('.lesson-content-area');
    if (!contentArea) return;
    const updatedHTML = contentArea.innerHTML;
    
    // Save locally
    setLocalContent(updatedHTML);
    
    // Save to DB
    if (nbtLessonId) {
       supabase.from('nbt_generated_lessons')
         .update({ content: updatedHTML })
         .eq('id', nbtLessonId)
         .then(({ error }) => { if (error) console.error('Error persisting content updates:', error); });
    }
  };

  const handleHighlight = (text: string, color: string) => {
    try {
      highlightSelectedText(color);
      persistContentAreaChanges();
      toast({ title: 'Text Highlighted' });
    } catch (err) {
      console.error('Highlight error:', err);
    }
  };

  const handleComment = (text: string) => {
    setPendingCommentText(text);
    setCommentInputValue('');
    // Apply temporary highlight to mark where the comment will be
    highlightSelectedText('#10b981', true, 'PENDING_COMMENT');
    persistContentAreaChanges();
    setIsCommentModalOpen(true);
  };

  const handleAskAI = (text: string) => {
    if (!text) return;
    const promptText = `I'm studying the NBT ${materialSection} guide for "${materialTitle}". Can you please elaborate more on this specific point from the lesson?\n\n"${text}"`;
    window.dispatchEvent(new CustomEvent('openFlashcardExplanation', { detail: { prompt: promptText } }));
  };

  const handleSaveCommentFromModal = async () => {
    if (!commentInputValue.trim()) return;
    
    try {
      // Update the pending comment mark in DOM with actual comment
      const contentArea = window.document.querySelector('.lesson-content-area');
      if (contentArea) {
        const pendingSpan = contentArea.querySelector('span[data-comment="PENDING_COMMENT"]');
        if (pendingSpan) {
          pendingSpan.setAttribute('data-comment', commentInputValue.trim());
        }
        persistContentAreaChanges();
      }
      
      if (user && nbtLessonId) {
        const { error } = await supabase.from('lesson_comments').insert({
          user_id: user.id,
          lesson_id: nbtLessonId,
          highlighted_text: pendingCommentText,
          content: commentInputValue.trim(),
        });
        if (error) console.error('Error saving comment to DB:', error);
      }
      
      toast({ title: 'Comment added', description: 'Tap the highlighted text to view your note.' });
      setIsCommentModalOpen(false);
    } catch (error) {
      console.error('Error adding comment:', error);
      toast({ title: 'Error', description: 'Failed to add comment.', variant: 'destructive' });
    }
  };

  const handleCancelComment = () => {
    // Remove the pending highlight
    const contentArea = window.document.querySelector('.lesson-content-area');
    if (contentArea) {
      const pendingSpan = contentArea.querySelector('span[data-comment="PENDING_COMMENT"]');
      if (pendingSpan) {
        const parent = pendingSpan.parentNode;
        if (parent) {
          while (pendingSpan.firstChild) {
            parent.insertBefore(pendingSpan.firstChild, pendingSpan);
          }
          parent.removeChild(pendingSpan);
        }
        persistContentAreaChanges();
      }
    }
    setIsCommentModalOpen(false);
  };

  const handleEditComment = async (newComment: string) => {
    // Update the DOM element
    const commentEls = window.document.querySelectorAll('.has-comment');
    commentEls.forEach(el => {
      if (el.getAttribute('data-comment') === commentPopover.comment) {
        el.setAttribute('data-comment', newComment);
      }
    });
    persistContentAreaChanges();

    // Update in DB
    if (user && nbtLessonId) {
      await supabase.from('lesson_comments')
        .update({ content: newComment })
        .eq('user_id', user.id)
        .eq('lesson_id', nbtLessonId)
        .eq('highlighted_text', commentPopover.highlightedText);
    }

    setCommentPopover(prev => ({ ...prev, comment: newComment }));
    toast({ title: 'Comment updated' });
  };

  const handleContentClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    const commentEl = target.closest('.has-comment') as HTMLElement;
    
    if (commentEl) {
      const commentText = commentEl.getAttribute('data-comment') || '';
      if (commentText === 'PENDING_COMMENT' || !commentText) return;
      
      const highlightedText = commentEl.textContent || '';
      const rect = commentEl.getBoundingClientRect();
      
      setCommentPopover({
        visible: true,
        x: rect.left + rect.width / 2,
        y: rect.bottom + 8,
        comment: commentText,
        highlightedText,
      });
    } else {
      if (commentPopover.visible) {
        setCommentPopover(prev => ({ ...prev, visible: false }));
      }
    }
  };

  const handleGenerateExam = async () => {
    if (!nbtLessonId || !user) return;
    if (isGeneratingExam) return;

    setIsGeneratingExam(true);
    try {
      const contentToUse = getTopicScopedContent(selectedExamTopicIds);
      const selectedTopics = lessonSections.filter(s => selectedExamTopicIds.includes(s.id)).map(s => s.title);

      const { data, error } = await supabase.functions.invoke('generate-exam-nbt', {
        body: {
          lessonContent: contentToUse,
          section: materialSection,
          nbtLessonId,
          questionCount: examQuestionCount,
          difficulty: examDifficulty,
          selectedTopics,
        }
      });

      if (error) throw error;
      toast({ title: 'Exam generated!', description: 'Your practice exam simulation is ready.' });
      await refreshExistingContent();
    } catch (error: any) {
      console.error('Error generating exam:', error);
      toast({ title: 'Generation failed', description: error.message, variant: 'destructive' });
    } finally {
      setIsGeneratingExam(false);
    }
  };

  const handleGenerateFlashcards = async () => {
    if (!nbtLessonId || !user) return;
    if (isGeneratingFlashcards) return;

    setIsGeneratingFlashcards(true);
    try {
      const contentToUse = getTopicScopedContent(selectedFlashcardTopicIds);
      const selectedTopics = lessonSections.filter(s => selectedFlashcardTopicIds.includes(s.id)).map(s => s.title);

      const { data, error } = await supabase.functions.invoke('generate-flashcards-nbt', {
        body: {
          lessonContent: contentToUse,
          section: materialSection,
          materialId: material.id,
          nbtLessonId,
          flashcardCount,
          selectedTopics,
        }
      });

      if (error) throw error;
      toast({ title: 'Flashcards generated!', description: 'Your new deck is ready.' });
      await refreshExistingContent();
    } catch (error: any) {
      console.error('Error generating flashcards:', error);
      toast({ title: 'Generation failed', description: error.message, variant: 'destructive' });
    } finally {
      setIsGeneratingFlashcards(false);
    }
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'lesson':
        return (
          <div className="h-full overflow-y-auto bg-background selection:bg-primary/20 selection:text-primary scroll-smooth">
            <TextSelectionToolbar
              onHighlight={handleHighlight}
              onComment={handleComment}
              onAskAI={handleAskAI}
            />

            <InlineCommentPopover
              visible={commentPopover.visible}
              x={commentPopover.x}
              y={commentPopover.y}
              comment={commentPopover.comment}
              highlightedText={commentPopover.highlightedText}
              onClose={() => setCommentPopover(prev => ({ ...prev, visible: false }))}
              onEdit={handleEditComment}
            />

            <div className="max-w-4xl mx-auto px-4 sm:px-8 lg:px-12 py-10 sm:py-20">
              <div className="mb-12 space-y-4">
                <Badge variant="outline" className="px-4 py-1.5 rounded-full border-primary/20 bg-primary/5 text-primary font-black uppercase tracking-widest text-[10px]">
                  NBT {materialSection} • Study Guide
                </Badge>
                <div className="flex items-center justify-between gap-4">
                  <h1 className="text-4xl sm:text-5xl font-black text-foreground tracking-tight leading-[1.1]">{materialTitle}</h1>
                  {!localContent && material.document && (
                    <Button onClick={handleGenerate} disabled={isGenerating} className="shrink-0 h-14 px-8 rounded-2xl shadow-xl shadow-primary/20 font-black animate-pulse">
                      {isGenerating ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Sparkles className="w-5 h-5 mr-2" />}
                      GENERATE GUIDE
                    </Button>
                  )}
                </div>
              </div>

              {!localContent ? (
                <div className="py-32 flex flex-col items-center justify-center text-center space-y-8 bg-secondary/10 rounded-[3rem] border-2 border-dashed border-border/50">
                  <div className="w-24 h-24 rounded-[2.5rem] bg-primary/10 flex items-center justify-center text-primary">
                    <BookOpen className="w-12 h-12" />
                  </div>
                  <div className="space-y-3 max-w-sm">
                    <p className="text-2xl font-black text-foreground">No Guide Generated</p>
                    <p className="text-muted-foreground font-medium leading-relaxed">
                      Transform your source materials into a comprehensive NBT-optimized study guide.
                    </p>
                  </div>
                  {material.document && (
                    <Button onClick={handleGenerate} disabled={isGenerating} size="lg" className="h-14 px-10 rounded-2xl font-black shadow-2xl shadow-primary/25">
                      {isGenerating ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Zap className="w-5 h-5 mr-2" />}
                      START GENERATION
                    </Button>
                  )}
                </div>
              ) : (
                <div 
                  className="prose prose-lg dark:prose-invert max-w-none lesson-content-area prose-headings:font-black prose-p:leading-relaxed prose-strong:text-primary select-text" 
                  onClick={handleContentClick}
                >
                  {(localContent.trim().startsWith('<') && localContent.includes('</')) ? (
                    <div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(localContent) }} />
                  ) : (
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {localContent || "Initializing study content..."}
                    </ReactMarkdown>
                  )}
                </div>
              )}
            </div>
          </div>
        );

      case 'quizzes': {
        const currentQuiz = activeQuizId ? existingQuizzes.find(q => q.id === activeQuizId) : null;
        const questions = currentQuiz?.nbt_practice_questions || [];

        // Quiz Taking View
        if (currentQuiz && activeQuizIndex !== null && !showQuizResults) {
          const q = questions[activeQuizIndex];
          const options = q && Array.isArray(q.options) ? q.options : [];
          const progress = questions.length > 0 ? ((activeQuizIndex + 1) / questions.length) * 100 : 0;

          if (!q) {
            return (
              <div className="h-full overflow-y-auto bg-background p-4 sm:p-8">
                <div className="max-w-4xl mx-auto space-y-8 pb-32">
                  <Button variant="ghost" size="sm" onClick={() => { setActiveQuizId(null); setActiveQuizIndex(null); }} className="text-muted-foreground hover:text-foreground -ml-2">
                    <ChevronLeft className="w-4 h-4 mr-1" />
                    Back to Quizzes
                  </Button>
                  <Card className="border-2 shadow-sm rounded-3xl overflow-hidden">
                    <CardContent className="p-8 sm:p-12 text-center space-y-4">
                      <p className="text-xl font-bold text-foreground">Question unavailable</p>
                      <p className="text-muted-foreground">This quiz item could not be loaded. Please go back and open the quiz again.</p>
                    </CardContent>
                  </Card>
                </div>
              </div>
            );
          }

          return (
            <div className="h-full overflow-y-auto bg-background p-4 sm:p-8">
              <div className="max-w-4xl mx-auto space-y-8 pb-32">
                {/* Header */}
                <div className="space-y-4">
                  <Button variant="ghost" size="sm" onClick={() => { setActiveQuizId(null); setActiveQuizIndex(null); }} className="text-muted-foreground hover:text-foreground -ml-2">
                    <ChevronLeft className="w-4 h-4 mr-1" />
                    Back to Quizzes
                  </Button>
                  <div className="flex items-center justify-between">
                    <div>
                      <h1 className="text-2xl sm:text-3xl font-bold text-foreground">{currentQuiz.title}</h1>
                      <p className="text-sm text-muted-foreground mt-1">Question {activeQuizIndex + 1} of {questions.length}</p>
                    </div>
                  </div>
                </div>

                {/* Progress */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    <span>Progress</span>
                    <span>{activeQuizIndex + 1} / {questions.length}</span>
                  </div>
                  <Progress value={progress} className="h-2 rounded-full" />
                </div>

                {/* Question Card */}
                <Card className="border-2 shadow-sm rounded-3xl overflow-hidden">
                  <CardContent className="p-8 sm:p-12 space-y-8">
                    <div className="text-xl sm:text-2xl font-bold text-foreground leading-relaxed">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {q.question_text}
                      </ReactMarkdown>
                    </div>

                    <div className="grid gap-4">
                      {options.map((opt: string, i: number) => (
                        <div
                          key={i}
                          onClick={() => setQuizAnswers({ ...quizAnswers, [q.id]: opt })}
                          className={cn(
                            "group flex items-center gap-4 p-5 rounded-2xl border-2 transition-all cursor-pointer",
                            quizAnswers[q.id] === opt
                              ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                              : "border-border hover:border-primary/40 hover:bg-secondary/20"
                          )}
                        >
                          <div className={cn(
                            "w-8 h-8 rounded-full border-2 flex items-center justify-center font-bold text-xs transition-colors",
                            quizAnswers[q.id] === opt ? "bg-primary border-primary text-white" : "border-muted-foreground/30 text-muted-foreground"
                          )}>
                            {String.fromCharCode(65 + i)}
                          </div>
                          <span className="font-bold text-lg">{opt}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Navigation */}
                <div className="flex justify-between gap-4">
                  <Button variant="outline" disabled={activeQuizIndex === 0} onClick={() => setActiveQuizIndex(activeQuizIndex - 1)} className="h-14 flex-1 rounded-2xl border-2 font-bold">
                    <ChevronLeft className="w-4 h-4 mr-2" />
                    Previous
                  </Button>
                  <Button
                    disabled={!quizAnswers[q.id]}
                    onClick={() => activeQuizIndex < questions.length - 1 ? setActiveQuizIndex(activeQuizIndex + 1) : setShowQuizResults(true)}
                    className="h-14 flex-1 rounded-2xl shadow-lg font-bold"
                  >
                    {activeQuizIndex === questions.length - 1 ? 'Finish Quiz' : 'Next Question'}
                    {activeQuizIndex < questions.length - 1 && <ChevronRight className="w-4 h-4 ml-2" />}
                  </Button>
                </div>
              </div>
            </div>
          );
        }

        // Quiz Results View
        if (showQuizResults && currentQuiz) {
          const correct = questions.filter((q: any) => quizAnswers[q.id] === q.correct_answer).length;
          const percentage = Math.round((correct / questions.length) * 100);

          // Save quiz results to nbt_practice_attempts for analytics tracking
          const saveQuizResultsToAnalytics = async () => {
            if (!user) return;
            try {
              const attemptsToInsert = questions.map((q: any) => ({
                user_id: user.id,
                question_id: q.id,
                section: materialSection,
                user_answer: quizAnswers[q.id] || null,
                is_correct: quizAnswers[q.id] === q.correct_answer,
                completed_at: new Date().toISOString(),
              }));
              await supabase.from('nbt_practice_attempts').insert(attemptsToInsert);

              // Update last score for the quiz card
              setQuizLastScores(prev => ({ ...prev, [currentQuiz.id]: percentage }));
            } catch (err) {
              console.error('Error saving quiz analytics:', err);
            }
          };
          // Fire and forget — don't block UI rendering
          if (!quizLastScores[currentQuiz.id] || quizLastScores[currentQuiz.id] !== percentage) {
            saveQuizResultsToAnalytics();
          }

          return (
            <div className="h-full overflow-y-auto bg-background p-4 sm:p-8">
              <div className="max-w-4xl mx-auto space-y-12 pb-32">
                <div className="text-center space-y-6">
                  <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-primary/10 text-primary mb-2">
                    <Award className="w-10 h-10" />
                  </div>
                  <h1 className="text-4xl sm:text-5xl font-bold text-foreground tracking-tight">Quiz Results</h1>
                  <div className="flex justify-center gap-12">
                    <div className="text-center">
                      <p className="text-5xl font-black text-primary">{percentage}%</p>
                      <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mt-1">Accuracy</p>
                    </div>
                    <div className="w-px h-16 bg-border/50" />
                    <div className="text-center">
                      <p className="text-5xl font-black text-foreground">{correct}/{questions.length}</p>
                      <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mt-1">Correct</p>
                    </div>
                  </div>
                </div>

                {/* Answer Review */}
                <div className="space-y-6">
                  <h3 className="text-2xl font-bold flex items-center gap-3">
                    <div className="w-2 h-8 bg-primary rounded-full" />
                    Review Answers
                  </h3>
                  <div className="grid gap-6">
                    {questions.map((q: any, i: number) => {
                      const isCorrect = quizAnswers[q.id] === q.correct_answer;
                      return (
                        <Card key={q.id} className={cn("rounded-3xl border-2 transition-colors", isCorrect ? "border-emerald-500/20 bg-emerald-500/[0.02]" : "border-destructive/20 bg-destructive/[0.02]")}>
                          <CardContent className="p-8 space-y-4">
                            <div className="flex items-center gap-3">
                              <div className={cn("w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold", isCorrect ? "bg-emerald-500 shadow-md shadow-emerald-500/20" : "bg-destructive shadow-md shadow-destructive/20")}>
                                {isCorrect ? "✓" : "!"}
                              </div>
                              <p className="font-bold text-sm text-muted-foreground">Question {i + 1}</p>
                            </div>
                            <p className="text-lg font-bold leading-relaxed">{q.question_text}</p>
                            <div className="pt-6 border-t border-border/10 grid gap-3">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium text-muted-foreground">Your Answer:</span>
                                <span className={cn("text-sm font-bold", isCorrect ? "text-emerald-600" : "text-destructive")}>
                                  {quizAnswers[q.id] || "Skipped"}
                                </span>
                              </div>
                              {!isCorrect && (
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-medium text-muted-foreground">Correct Answer:</span>
                                  <span className="text-sm font-bold text-emerald-600">{q.correct_answer}</span>
                                </div>
                              )}
                              {q.explanation && (
                                <div className="mt-4 p-4 rounded-2xl bg-muted/30 border-l-4 border-primary/20">
                                  <p className="text-sm text-muted-foreground italic leading-relaxed">
                                    <span className="font-bold not-italic text-foreground mr-2">Explanation:</span>
                                    {q.explanation}
                                  </p>
                                </div>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-4 pt-8">
                  <Button onClick={() => { setActiveQuizId(null); setActiveQuizIndex(null); }} className="h-14 flex-1 rounded-2xl border-2 font-bold" variant="outline">
                    Return to Hub
                  </Button>
                  <Button onClick={() => { setActiveQuizIndex(0); setQuizAnswers({}); setShowQuizResults(false); }} className="h-14 flex-1 rounded-2xl shadow-xl font-bold">
                    <RotateCcw className="w-4 h-4 mr-2" />
                    Retake Quiz
                  </Button>
                </div>
              </div>
            </div>
          );
        }

        // Quiz Hub (List View)
        return (
          <div className="h-full overflow-y-auto bg-background">
            <div className="p-4 sm:p-10 max-w-5xl mx-auto space-y-12 pb-40">
              {/* Header */}
              <div className="space-y-2">
                <h1 className="text-4xl font-bold text-foreground tracking-tight">Quizzes</h1>
                <p className="text-muted-foreground text-lg">Generate and practice quizzes focused on your study material.</p>
              </div>

              {/* Generation Section */}
              <div className="grid gap-8 p-8 sm:p-10 bg-card rounded-[2.5rem] border-2 border-border/50 shadow-sm relative overflow-hidden">
                <div className="absolute -top-12 -right-12 opacity-[0.03] rotate-12">
                  <Brain className="w-64 h-64 text-primary" />
                </div>
                
                <div className="relative space-y-8">
                  <div>
                    <h2 className="text-2xl font-bold flex items-center gap-2">
                      <Sparkles className="w-6 h-6 text-primary" />
                      Generate New Quiz
                    </h2>
                    <p className="text-sm text-muted-foreground mt-1">Customize your practice session topics and difficulty.</p>
                  </div>

                  <div className="grid gap-6 md:grid-cols-3">
                    <div className="space-y-3">
                      <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Number of Questions</Label>
                      <Select value={quizQuestionCount.toString()} onValueChange={(v) => setQuizQuestionCount(parseInt(v))}>
                        <SelectTrigger className="h-12 rounded-xl bg-background border-2 font-bold text-base"><SelectValue /></SelectTrigger>
                        <SelectContent className="rounded-xl border-2">
                          {[5, 10, 20, 30, 50].map(n => (
                            <SelectItem key={n} value={n.toString()}>{n} Questions</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-3">
                      <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Total Marks</Label>
                      <Input 
                        type="number" 
                        value={quizTotalMarks} 
                        onChange={(e) => setQuizTotalMarks(parseInt(e.target.value) || 10)}
                        className="h-12 rounded-xl bg-background border-2 font-bold text-base"
                        min={5}
                        max={100}
                      />
                    </div>

                    <div className="space-y-3">
                      <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Select Topics</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="outline" className="w-full h-12 rounded-xl bg-background border-2 justify-between font-bold text-base">
                            <span className="truncate">
                              {selectedQuizTopicIds.length === 0 ? "All Topics" : `${selectedQuizTopicIds.length} Selected`}
                            </span>
                            <ChevronDown className="w-4 h-4 opacity-40 shrink-0" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-2 rounded-xl border-2 shadow-2xl" align="start">
                          <div className="space-y-1 max-h-72 overflow-y-auto custom-scrollbar">
                            {lessonSections.map((section) => (
                              <div
                                key={section.id}
                                className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted cursor-pointer transition-colors"
                                onClick={() => {
                                  setSelectedQuizTopicIds(prev => prev.includes(section.id) ? prev.filter(id => id !== section.id) : [...prev, section.id]);
                                }}
                              >
                                <Checkbox checked={selectedQuizTopicIds.includes(section.id)} id={`q-${section.id}`} className="rounded-md" />
                                <label className="text-sm font-medium leading-tight cursor-pointer line-clamp-1">{section.title}</label>
                              </div>
                            ))}
                            {lessonSections.length === 0 && (
                              <p className="text-xs text-center py-4 text-muted-foreground italic">Generate a study guide to see topics</p>
                            )}
                          </div>
                        </PopoverContent>
                      </Popover>
                    </div>
                  </div>

                  <Button 
                    onClick={handleGenerateQuiz} 
                    disabled={isGeneratingQuiz || !nbtLessonId}
                    className="w-full h-14 rounded-2xl shadow-lg shadow-primary/20 font-bold text-lg gap-3"
                  >
                    {isGeneratingQuiz ? <Loader2 className="w-5 h-5 animate-spin" /> : <Zap className="w-5 h-5" />}
                    {isGeneratingQuiz ? "Generating Quiz..." : "Create Practice Quiz"}
                  </Button>
                </div>
              </div>

              {/* Quiz List */}
              <div className="space-y-8">
                <div className="flex items-center gap-4">
                  <h3 className="text-2xl font-bold text-foreground">Previous Quizzes</h3>
                  <div className="h-px flex-1 bg-border" />
                </div>
                
                {existingQuizzes.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {existingQuizzes.map((quiz: any) => (
                      <Card 
                        key={quiz.id} 
                        className="group hover:border-primary/40 transition-all cursor-pointer bg-card/50 backdrop-blur-sm border-2 border-border/50 rounded-3xl overflow-hidden hover:shadow-md"
                        onClick={() => { setActiveQuizId(quiz.id); setActiveQuizIndex(0); setQuizAnswers({}); setShowQuizResults(false); }}
                      >
                        <CardContent className="p-8 space-y-6">
                          <div className="flex justify-between items-start">
                            <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-white transition-all duration-300">
                              <Target className="w-6 h-6" />
                            </div>
                            <Badge variant="secondary" className="font-bold text-[10px] uppercase tracking-wider">
                              {quiz.nbt_practice_questions?.length || 0} Questions
                            </Badge>
                          </div>

                          <div className="space-y-1">
                            <h3 className="font-bold text-xl text-foreground group-hover:text-primary transition-colors line-clamp-1">{quiz.title}</h3>
                            <p className="text-xs font-medium text-muted-foreground flex items-center gap-2">
                              <Clock className="w-3.5 h-3.5" />
                              {new Date(quiz.created_at).toLocaleDateString()}
                            </p>
                          </div>

                          {quizLastScores[quiz.id] !== undefined && (
                            <div className="flex items-center gap-2 mt-1">
                              <Badge variant={quizLastScores[quiz.id] >= 70 ? 'default' : 'destructive'} className="text-xs font-bold">
                                Last: {quizLastScores[quiz.id]}%
                              </Badge>
                            </div>
                          )}

                          <div className="w-full h-12 bg-secondary/50 rounded-xl flex items-center justify-center font-bold text-sm text-muted-foreground group-hover:bg-primary group-hover:text-white transition-all">
                            Take Quiz
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <div className="py-20 text-center space-y-4 border-2 border-dashed rounded-[2.5rem] border-border/50 bg-muted/5">
                    <div className="w-16 h-16 bg-muted rounded-2xl flex items-center justify-center text-muted-foreground/30 mx-auto">
                      <Target className="w-8 h-8" />
                    </div>
                    <p className="text-muted-foreground font-medium">No quizzes generated yet. Start by generating one above!</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      }

      case 'exams': {
        const currentExam = activeExamId ? existingExams.find(e => e.id === activeExamId) : null;
        const questions = currentExam?.nbt_practice_questions || [];

        // Exam Taking View
        if (currentExam && activeExamIndex !== null && !showExamResults) {
          const q = questions[activeExamIndex];
          const options = q && Array.isArray(q.options) ? q.options : [];
          const progress = questions.length > 0 ? ((activeExamIndex + 1) / questions.length) * 100 : 0;

          const formatTime = (seconds: number) => {
            const mins = Math.floor(seconds / 60);
            const secs = seconds % 60;
            return `${mins}:${secs.toString().padStart(2, '0')}`;
          };

          if (!q) {
            return (
              <div className="h-full overflow-y-auto bg-background p-4 sm:p-8">
                <div className="max-w-4xl mx-auto space-y-8 pb-32">
                  <Button variant="ghost" size="sm" onClick={() => { setActiveExamId(null); setExamTimeLeft(null); }} className="text-muted-foreground hover:text-foreground -ml-2">
                    <ChevronLeft className="w-4 h-4 mr-1" />
                    Back to Exams
                  </Button>
                  <Card className="border-2 shadow-sm rounded-[2rem] overflow-hidden">
                    <CardContent className="p-8 sm:p-12 text-center space-y-4">
                      <p className="text-xl font-bold text-foreground">Question unavailable</p>
                      <p className="text-muted-foreground">This exam item could not be loaded. Please go back and open the exam again.</p>
                    </CardContent>
                  </Card>
                </div>
              </div>
            );
          }

          return (
            <div className="h-full overflow-y-auto bg-background p-4 sm:p-8">
              <div className="max-w-4xl mx-auto space-y-8 pb-32">
                {/* Header */}
                <div className="space-y-4">
                  <Button variant="ghost" size="sm" onClick={() => { setActiveExamId(null); setExamTimeLeft(null); }} className="text-muted-foreground hover:text-foreground -ml-2">
                    <ChevronLeft className="w-4 h-4 mr-1" />
                    Back to Exams
                  </Button>
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <h1 className="text-2xl sm:text-3xl font-bold text-foreground line-clamp-1">{currentExam.title}</h1>
                    </div>
                    {examTimeLeft !== null && (
                      <div className={cn("flex items-center gap-2 px-4 py-2 rounded-xl border-2 font-mono text-xl", examTimeLeft < 300 ? "border-destructive text-destructive bg-destructive/5 animate-pulse" : "border-border bg-muted/30")}>
                        <Clock className="w-5 h-5" />
                        {formatTime(examTimeLeft)}
                      </div>
                    )}
                  </div>
                </div>

                {/* Question Info Bar */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div className="bg-muted/30 p-4 rounded-2xl border border-border/50 text-center">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Question</p>
                    <p className="text-xl font-bold">{activeExamIndex + 1} / {questions.length}</p>
                  </div>
                  <div className="bg-muted/30 p-4 rounded-2xl border border-border/50 text-center">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Type</p>
                    <p className="text-sm font-bold uppercase tracking-wide">Multiple Choice</p>
                  </div>
                  <div className="bg-muted/30 p-4 rounded-2xl border border-border/50 text-center overflow-hidden">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Progress</p>
                    <div className="mt-2 h-2 w-full bg-border rounded-full">
                      <div className="h-full bg-primary rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
                    </div>
                  </div>
                  <div className="bg-muted/30 p-4 rounded-2xl border border-border/50 text-center">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Points</p>
                    <p className="text-xl font-bold">1</p>
                  </div>
                </div>

                {/* Question Card */}
                <Card className="border-2 shadow-sm rounded-[2rem] overflow-hidden">
                  <CardContent className="p-8 sm:p-12 space-y-8">
                    <div className="text-xl sm:text-2xl font-bold text-foreground leading-relaxed italic">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {q.question_text}
                      </ReactMarkdown>
                    </div>

                    <div className="grid gap-4">
                      {options.map((opt: string, i: number) => (
                        <div
                          key={i}
                          onClick={() => setExamAnswers({ ...examAnswers, [q.id]: opt })}
                          className={cn(
                            "group flex items-center gap-4 p-6 rounded-2xl border-2 transition-all cursor-pointer",
                            examAnswers[q.id] === opt
                              ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                              : "border-border hover:border-primary/40 hover:bg-secondary/20"
                          )}
                        >
                          <div className={cn(
                            "w-10 h-10 rounded-xl border-2 flex items-center justify-center font-bold text-sm transition-all shadow-sm",
                            examAnswers[q.id] === opt ? "bg-primary border-primary text-white scale-110" : "border-muted-foreground/30 text-muted-foreground group-hover:border-primary/50"
                          )}>
                            {String.fromCharCode(65 + i)}
                          </div>
                          <span className="font-bold text-lg">{opt}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Navigation */}
                <div className="flex flex-col sm:flex-row justify-between gap-4 pt-4">
                  <div className="flex gap-4 flex-1">
                    <Button variant="outline" disabled={activeExamIndex === 0} onClick={() => setActiveExamIndex(activeExamIndex - 1)} className="h-14 flex-1 rounded-2xl border-2 font-bold">
                      <ChevronLeft className="w-4 h-4 mr-2" />
                      PREVIOUS
                    </Button>
                    <Button variant="outline" onClick={() => activeExamIndex < questions.length - 1 ? setActiveExamIndex(activeExamIndex + 1) : null} disabled={activeExamIndex === questions.length - 1} className="h-14 flex-1 rounded-2xl border-2 font-bold group">
                      SKIP
                      <ChevronRight className="w-4 h-4 ml-2 opacity-40 group-hover:opacity-100 transition-opacity" />
                    </Button>
                  </div>
                  <Button
                    disabled={!examAnswers[q.id]}
                    onClick={() => activeExamIndex < questions.length - 1 ? setActiveExamIndex(activeExamIndex + 1) : setShowExamResults(true)}
                    className="h-14 sm:w-64 rounded-2xl shadow-xl font-bold text-lg bg-primary hover:bg-primary/90"
                  >
                    {activeExamIndex === questions.length - 1 ? 'SUBMIT EXAM' : 'NEXT QUESTION'}
                  </Button>
                </div>

                {/* Question Nav Dots */}
                <div className="flex flex-wrap justify-center gap-2 max-w-2xl mx-auto pt-8">
                  {questions.map((_: any, idx: number) => (
                    <button
                      key={idx}
                      onClick={() => setActiveExamIndex(idx)}
                      className={cn(
                        "w-8 h-8 rounded-lg border-2 text-[10px] font-bold transition-all",
                        activeExamIndex === idx ? "border-primary bg-primary text-white scale-110 shadow-lg" :
                        examAnswers[questions[idx].id] ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-600" :
                        "border-border bg-muted/50 text-muted-foreground hover:border-primary/50"
                      )}
                    >
                      {idx + 1}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          );
        }

        // Exam Results View
        if (showExamResults && currentExam) {
          const correct = questions.filter((q: any) => examAnswers[q.id] === q.correct_answer).length;
          const percentage = Math.round((correct / questions.length) * 100);

          return (
            <div className="h-full overflow-y-auto bg-background p-4 sm:p-8">
              <div className="max-w-4xl mx-auto space-y-12 pb-32">
                <div className="text-center space-y-8 bg-card p-12 rounded-[3rem] border-2 border-border/50 shadow-2xl relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-full h-2 bg-primary" />
                  <div className="inline-flex items-center justify-center w-24 h-24 rounded-[2rem] bg-primary/10 text-primary mb-2">
                    <Trophy className="w-12 h-12" />
                  </div>
                  <h1 className="text-5xl font-bold text-foreground tracking-tight">Exam Complete!</h1>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 max-w-2xl mx-auto">
                    <div className="space-y-1">
                      <p className="text-5xl font-black text-primary">{percentage}%</p>
                      <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mt-1">Overall Grade</p>
                    </div>
                    <div className="hidden sm:block w-px h-16 bg-border/50 mx-auto" />
                    <div className="space-y-1">
                      <p className="text-5xl font-black text-foreground">{correct}/{questions.length}</p>
                      <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mt-1">Questions Correct</p>
                    </div>
                  </div>

                  <div className="pt-8 border-t border-border/30 flex justify-center gap-12">
                    <div className="flex items-center gap-2 text-muted-foreground font-bold">
                      <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                      <span>{correct} Passed</span>
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground font-bold">
                      <XCircle className="w-5 h-5 text-destructive" />
                      <span>{questions.length - correct} Failed</span>
                    </div>
                  </div>
                </div>

                {/* Detailed Analysis */}
                <div className="space-y-8">
                  <div className="flex items-center justify-between">
                    <h3 className="text-2xl font-bold flex items-center gap-3 italic">
                      <ClipboardCheck className="w-7 h-7 text-primary" />
                      Detailed Solutions
                    </h3>
                  </div>
                  
                  <div className="grid gap-8">
                    {questions.map((q: any, i: number) => {
                      const isCorrect = examAnswers[q.id] === q.correct_answer;
                      return (
                        <Card key={q.id} className={cn("rounded-3xl border-2 transition-all shadow-sm", isCorrect ? "border-emerald-500/20 bg-emerald-500/[0.01]" : "border-destructive/20 bg-destructive/[0.01]")}>
                          <CardContent className="p-8 sm:p-12 space-y-6">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center text-white text-sm font-bold shadow-lg", isCorrect ? "bg-emerald-500 shadow-emerald-500/20" : "bg-destructive shadow-destructive/20")}>
                                  {isCorrect ? "✓" : "!"}
                                </div>
                                <p className="font-bold text-sm text-muted-foreground uppercase tracking-widest">Question {i + 1}</p>
                              </div>
                              <Badge variant="outline" className={cn("font-bold px-4 py-1.5 rounded-full border-2", isCorrect ? "text-emerald-600 border-emerald-500/30 bg-emerald-500/10" : "text-destructive border-destructive/30 bg-destructive/10")}>
                                {isCorrect ? "CORRECT" : "INCORRECT"}
                              </Badge>
                            </div>

                            <p className="text-xl font-bold leading-relaxed">{q.question_text}</p>
                            
                            <div className="pt-8 border-t border-border/10 grid gap-6 md:grid-cols-2">
                              <div className="space-y-2">
                                <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Your Submission</p>
                                <div className={cn("p-4 rounded-xl border-2 font-bold", isCorrect ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-700" : "border-destructive/30 bg-destructive/5 text-destructive")}>
                                  {examAnswers[q.id] || "No Answer Submitted"}
                                </div>
                              </div>
                              
                              {!isCorrect && (
                                <div className="space-y-2">
                                  <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Correct Solution</p>
                                  <div className="p-4 rounded-xl border-2 border-emerald-500/30 bg-emerald-500/5 text-emerald-700 font-bold">
                                    {q.correct_answer}
                                  </div>
                                </div>
                              )}
                            </div>

                            {q.explanation && (
                              <div className="mt-4 p-6 rounded-2xl bg-muted/40 border-l-4 border-primary/40 relative group">
                                <Lightbulb className="absolute -top-3 -left-3 w-8 h-8 text-primary opacity-20 group-hover:opacity-100 transition-opacity" />
                                <p className="text-sm text-muted-foreground font-medium italic leading-relaxed">
                                  <span className="font-bold not-italic text-foreground block mb-2 uppercase text-[10px] tracking-widest opacity-60">Rational Explanation:</span>
                                  {q.explanation}
                                </p>
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-6 pt-12">
                  <Button onClick={() => { setActiveExamId(null); setExamTimeLeft(null); }} className="h-16 flex-1 rounded-2xl border-2 font-bold text-lg" variant="outline">
                    Return to Exams
                  </Button>
                  <Button onClick={() => { setActiveExamIndex(0); setExamAnswers({}); setShowExamResults(false); setExamTimeLeft(examQuestionCount * 60); }} className="h-16 flex-1 rounded-2xl shadow-2xl font-bold text-lg">
                    <RotateCcw className="w-5 h-5 mr-3" />
                    RETAKE EXAM
                  </Button>
                </div>
              </div>
            </div>
          );
        }

        // Exam Hub (List View)
        return (
          <div className="h-full overflow-y-auto bg-background">
            <div className="p-4 sm:p-10 max-w-5xl mx-auto space-y-12 pb-40">
              <div className="space-y-2">
                <h1 className="text-4xl font-bold text-foreground tracking-tight">Exams</h1>
                <p className="text-muted-foreground text-lg">Simulate real test conditions with timed exams and detailed reviews.</p>
              </div>

              {/* Generation Section */}
              <div className="grid gap-8 p-10 bg-card rounded-[3rem] border-2 border-border/50 shadow-sm relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
                  <Target className="w-40 h-40 text-primary" />
                </div>
                
                <div className="relative space-y-10">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                      <Sparkles className="w-7 h-7" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold tracking-tight">Generate Exam</h2>
                      <p className="text-sm text-muted-foreground">Create a comprehensive test covering all selected topics.</p>
                    </div>
                  </div>

                  <div className="grid gap-8 md:grid-cols-3">
                    <div className="space-y-3">
                      <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground ml-1">Length</Label>
                      <Select value={examQuestionCount.toString()} onValueChange={(v) => setExamQuestionCount(parseInt(v))}>
                        <SelectTrigger className="h-14 rounded-2xl bg-background border-2 shadow-sm font-bold text-lg"><SelectValue /></SelectTrigger>
                        <SelectContent className="rounded-2xl border-2">
                          {[20, 30, 40, 50, 60, 100].map(n => (
                            <SelectItem key={n} value={n.toString()}>{n} Questions</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-3">
                      <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground ml-1">Difficulty</Label>
                      <Select value={examDifficulty} onValueChange={(v: any) => setExamDifficulty(v)}>
                        <SelectTrigger className="h-14 rounded-2xl bg-background border-2 shadow-sm font-bold text-lg capitalize"><SelectValue /></SelectTrigger>
                        <SelectContent className="rounded-2xl border-2">
                          <SelectItem value="easy">Beginner</SelectItem>
                          <SelectItem value="medium">Standard</SelectItem>
                          <SelectItem value="hard">Advanced</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-3">
                      <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground ml-1">Focus topics</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="outline" className="w-full h-14 rounded-2xl bg-background border-2 shadow-sm justify-between font-bold text-lg">
                            <span className="truncate">
                              {selectedExamTopicIds.length === 0 ? "Full Syllabus" : `${selectedExamTopicIds.length} Selected`}
                            </span>
                            <ChevronDown className="w-5 h-5 opacity-40 shrink-0" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-3 rounded-2xl border-2 shadow-2xl" align="start">
                          <div className="space-y-2 max-h-72 overflow-y-auto custom-scrollbar">
                            {lessonSections.map((section) => (
                              <div
                                key={section.id}
                                className="flex items-center gap-3 p-3 rounded-xl hover:bg-muted cursor-pointer transition-colors"
                                onClick={() => {
                                  setSelectedExamTopicIds(prev => prev.includes(section.id) ? prev.filter(id => id !== section.id) : [...prev, section.id]);
                                }}
                              >
                                <Checkbox checked={selectedExamTopicIds.includes(section.id)} id={`exam-q-${section.id}`} className="rounded-md" />
                                <label className="text-sm font-bold leading-tight cursor-pointer line-clamp-1">{section.title}</label>
                              </div>
                            ))}
                          </div>
                        </PopoverContent>
                      </Popover>
                    </div>
                  </div>

                  <Button 
                    onClick={handleGenerateExam} 
                    disabled={isGeneratingExam || !nbtLessonId}
                    className="w-full h-16 rounded-[1.5rem] shadow-2xl shadow-primary/25 hover:shadow-primary/40 transition-all font-black text-xl gap-4"
                  >
                    {isGeneratingExam ? <Loader2 className="w-7 h-7 animate-spin" /> : <Play className="w-6 h-6 fill-current" />}
                    {isGeneratingExam ? "SIMULATING EXAM CONDITIONS..." : "START NEW EXAM SIMULATION"}
                  </Button>
                </div>
              </div>

              {/* Exam List */}
              <div className="space-y-8">
                <div className="flex items-center gap-4">
                  <h3 className="text-2xl font-bold text-foreground italic flex items-center gap-2">
                    <History className="w-6 h-6" />
                    Past Exams
                  </h3>
                  <div className="h-px flex-1 bg-border" />
                </div>
                
                {existingExams.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {existingExams.map((exam: any) => (
                      <Card 
                        key={exam.id} 
                        className="group relative hover:border-primary/40 transition-all cursor-pointer bg-card/40 backdrop-blur-md border-2 border-border/50 rounded-[2.5rem] overflow-hidden hover:shadow-2xl shadow-sm hover:translate-y-[-4px]"
                        onClick={() => { setActiveExamId(exam.id); setActiveExamIndex(0); setExamAnswers({}); setShowExamResults(false); setExamTimeLeft(exam.nbt_practice_questions?.length * 90); }}
                      >
                        <CardContent className="p-10 space-y-8">
                          <div className="flex justify-between items-start">
                            <div className="w-16 h-16 rounded-3xl bg-secondary flex items-center justify-center text-muted-foreground group-hover:bg-primary group-hover:text-white transition-all duration-500">
                              <ClipboardCheck className="w-8 h-8" />
                            </div>
                            <Badge className="bg-primary/10 text-primary border-none font-bold text-xs px-4 py-2 rounded-full uppercase tracking-widest">
                              {exam.nbt_practice_questions?.length || 0} ITEMS
                            </Badge>
                          </div>

                          <div className="space-y-3">
                            <h3 className="font-bold text-2xl text-foreground group-hover:text-primary transition-colors line-clamp-1 italic">{exam.title}</h3>
                            <div className="flex items-center gap-6">
                              <p className="text-xs font-bold text-muted-foreground uppercase tracking-[0.15em] flex items-center gap-2">
                                <Clock className="w-4 h-4" />
                                {Math.round((exam.nbt_practice_questions?.length * 90) / 60)} MINS
                              </p>
                              <div className="w-1.5 h-1.5 rounded-full bg-border" />
                              <p className="text-xs font-bold text-muted-foreground uppercase tracking-[0.15em] flex items-center gap-2">
                                <Target className="w-4 h-4" />
                                {exam.difficulty || 'Standard'}
                              </p>
                            </div>
                          </div>

                          <div className="w-full h-16 bg-primary/5 rounded-[1.25rem] flex items-center justify-center font-black text-xs uppercase tracking-[0.4em] text-primary group-hover:bg-primary group-hover:text-white transition-all shadow-sm">
                            ENTER SIMULATION
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <div className="py-32 text-center space-y-8 border-4 border-dashed rounded-[3rem] border-border/20 bg-muted/5">
                    <div className="w-24 h-24 bg-muted/50 rounded-[2rem] flex items-center justify-center text-muted-foreground/20 mx-auto">
                      <Lock className="w-12 h-12" />
                    </div>
                    <div className="space-y-2">
                      <p className="font-bold text-2xl text-foreground/80">No Exam History</p>
                      <p className="text-muted-foreground max-w-sm mx-auto">Complete your first exam simulation to see your performance metrics here.</p>
                      <Button variant="link" onClick={handleGenerateExam} className="font-bold text-primary">Generate your first exam now</Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      }

      case 'flashcards': {
        const currentDeck = activeDeckId ? existingFlashcards.find(d => d.id === activeDeckId) : null;
        const cards = currentDeck?.flashcards || [];

        // Flashcard Player View
        if (currentDeck && activeDeckCardIndex !== null) {
          const card = cards[activeDeckCardIndex];
          const progress = ((activeDeckCardIndex + 1) / cards.length) * 100;
          const masteredCount = cards.filter((c: any) => c.is_mastered).length;
          const handleExplainCardWithAI = (card: any) => {
            if (!card) return;
            const promptText = `Using the current NBT lesson content for ${material.title}, explain the following flashcard concept in a simple way:\n\nQuestion: ${card.front}\n\nAnswer: ${card.back}`;
            
            // This is the standard event that TimerChatToggle listens for
            const event = new CustomEvent('openFlashcardExplanation', {
              detail: { 
                prompt: promptText 
              }
            });
            window.dispatchEvent(event);
          };

          return (
            <div className="h-full overflow-y-auto bg-background/50 p-4 sm:p-8">
              <div className="max-w-4xl mx-auto space-y-8 pb-32">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <Button variant="ghost" size="sm" onClick={() => setActiveDeckId(null)} className="text-muted-foreground hover:text-foreground -ml-2 h-8 px-2">
                      <ChevronLeft className="w-4 h-4 mr-1" />
                      All Decks
                    </Button>
                    <h1 className="text-2xl md:text-3xl font-bold text-foreground tracking-tight">{currentDeck.title}</h1>
                  </div>
                  <div className="flex items-center gap-3 bg-card p-2 rounded-xl border border-border/50 shadow-sm">
                    <div className="text-right">
                      <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider leading-none">Mastery</p>
                      <p className="text-lg font-bold text-primary tabular-nums leading-none mt-1">{masteredCount}/{cards.length}</p>
                    </div>
                    <div className="w-10 h-10 rounded-full border-2 border-primary/20 flex items-center justify-center relative">
                      <svg className="w-full h-full -rotate-90">
                        <circle
                          cx="20"
                          cy="20"
                          r="16"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="3"
                          className="text-primary/10"
                        />
                        <circle
                          cx="20"
                          cy="20"
                          r="16"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="3"
                          strokeDasharray={100}
                          strokeDashoffset={100 - (masteredCount / cards.length) * 100}
                          className="text-primary transition-all duration-500"
                        />
                      </svg>
                    </div>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="space-y-2">
                  <div className="flex justify-between text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    <span>Progress</span>
                    <span>{activeDeckCardIndex + 1} of {cards.length} Cards</span>
                  </div>
                  <Progress value={progress} className="h-1.5 rounded-full bg-secondary" />
                </div>

                {/* Card Display */}
                <div className="perspective-1000 h-[400px] md:h-[450px] relative group shrink-0">
                  <motion.div
                    key={activeDeckCardIndex}
                    initial={{ x: 300, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    exit={{ x: -300, opacity: 0 }}
                    transition={{ type: "spring", stiffness: 260, damping: 20 }}
                    className="w-full h-full"
                  >
                    <motion.div
                      animate={{ rotateY: showFlashcardBack ? 180 : 0 }}
                      transition={{ duration: 0.6, type: "spring", stiffness: 260, damping: 20 }}
                      className="w-full h-full cursor-pointer preserve-3d relative"
                      onClick={() => setShowFlashcardBack(!showFlashcardBack)}
                    >
                      {/* Front side */}
                      <div className={cn("absolute inset-0 backface-hidden flex flex-col rounded-3xl border-2 border-primary/20 bg-gradient-to-br from-primary/10 to-card shadow-xl transition-all", !showFlashcardBack ? 'shadow-primary/5 ring-1 ring-primary/10' : '')}>
                        <div className="p-6 md:p-8 flex-1 flex flex-col items-center justify-center text-center">
                          <div className="absolute top-6 left-6 flex items-center gap-2 text-primary/60">
                            <Lightbulb className="w-4 h-4" />
                            <span className="text-[10px] font-bold uppercase tracking-widest">Question</span>
                          </div>
                          <div className="w-full max-h-full overflow-y-auto custom-scrollbar px-4">
                            <div className="text-xl md:text-3xl font-bold text-foreground leading-relaxed">
                              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                {card?.front}
                              </ReactMarkdown>
                            </div>
                          </div>
                          <div className="absolute bottom-6 w-full text-center">
                            <p className="text-[10px] font-bold text-muted-foreground/50 uppercase tracking-widest">Tap to reveal answer</p>
                          </div>
                        </div>
                      </div>

                      {/* Back side */}
                      <div className={cn("absolute inset-0 backface-hidden rotate-y-180 flex flex-col rounded-3xl border-2 border-emerald-500/20 bg-gradient-to-br from-emerald-500/10 to-card shadow-xl transition-all", showFlashcardBack ? 'shadow-emerald-500/5 ring-1 ring-emerald-500/10' : '')}>
                        <div className="p-6 md:p-8 flex-1 flex flex-col items-center justify-center text-center">
                          <div className="absolute top-6 left-6 flex items-center gap-2 text-emerald-500/60">
                            <Check className="w-4 h-4" />
                            <span className="text-[10px] font-bold uppercase tracking-widest">Answer</span>
                          </div>
                          <div className="w-full max-h-full overflow-y-auto custom-scrollbar px-4">
                            <div className="text-lg md:text-2xl font-semibold text-foreground leading-relaxed">
                              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                {card?.back}
                              </ReactMarkdown>
                            </div>
                          </div>
                          <div className="absolute bottom-6 w-full text-center">
                            <p className="text-[10px] font-bold text-muted-foreground/50 uppercase tracking-widest">Tap to see question</p>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  </motion.div>
                </div>

                {/* Navigation and Controls */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-end pb-8">
                  <div className="md:col-span-3 flex md:flex-col gap-3">
                    <Button
                      variant="outline"
                      disabled={activeDeckCardIndex === 0}
                      onClick={() => { setActiveDeckCardIndex(activeDeckCardIndex - 1); setShowFlashcardBack(false); }}
                      className="flex-1 md:w-full h-12 rounded-2xl border-2 hover:bg-muted font-bold tracking-tight"
                    >
                      <ChevronLeft className="w-5 h-5 mr-2" />
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      disabled={activeDeckCardIndex === cards.length - 1}
                      onClick={() => { setActiveDeckCardIndex(activeDeckCardIndex + 1); setShowFlashcardBack(false); }}
                      className="flex-1 md:w-full h-12 rounded-2xl border-2 hover:bg-muted font-bold tracking-tight"
                    >
                      Next
                      <ChevronRight className="w-5 h-5 ml-2" />
                    </Button>
                  </div>
                  
                  <div className="md:col-span-6 space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <Button
                        disabled={!showFlashcardBack}
                        onClick={async () => {
                          const card = cards[activeDeckCardIndex];
                          if (!user || !card) return;
                          await supabase.from('flashcards').update({ is_mastered: false }).eq('id', card.id);
                          if (activeDeckCardIndex < cards.length - 1) {
                            setActiveDeckCardIndex(activeDeckCardIndex + 1);
                            setShowFlashcardBack(false);
                          } else {
                            toast({ title: 'Session Done!', description: 'You finished the deck review.' });
                            setActiveDeckId(null);
                          }
                          refreshExistingContent();
                        }}
                        variant="outline"
                        className={cn(
                          "h-16 rounded-2xl border-2 font-bold transition-all",
                          showFlashcardBack ? 'border-orange-500/30 text-orange-600 hover:bg-orange-50 shadow-lg shadow-orange-500/5' : 'opacity-50 grayscale cursor-not-allowed'
                        )}
                      >
                         <div className="flex flex-col items-center">
                            <RotateCcw className="w-5 h-5 mb-1" />
                            <span className="text-xs uppercase">Need Practice</span>
                          </div>
                      </Button>
                      <Button
                        disabled={!showFlashcardBack}
                        onClick={async () => {
                          const card = cards[activeDeckCardIndex];
                          if (!user || !card) return;
                          await supabase.from('flashcards').update({ is_mastered: true }).eq('id', card.id);
                          if (activeDeckCardIndex < cards.length - 1) {
                            setActiveDeckCardIndex(activeDeckCardIndex + 1);
                            setShowFlashcardBack(false);
                          } else {
                            toast({ title: 'Mastery Improved!', description: 'Great job completing this deck!' });
                            setActiveDeckId(null);
                          }
                          refreshExistingContent();
                        }}
                        className={cn(
                          "h-16 rounded-2xl border-2 font-bold transition-all",
                          showFlashcardBack ? 'bg-emerald-600 hover:bg-emerald-700 border-emerald-500/30 shadow-lg shadow-emerald-500/20' : 'bg-muted border-transparent text-muted-foreground opacity-50 grayscale cursor-not-allowed'
                        )}
                      >
                         <div className="flex flex-col items-center">
                            <Check className="w-5 h-5 mb-1 text-white" />
                            <span className="text-xs uppercase text-white">Mastered</span>
                          </div>
                      </Button>
                    </div>
                    
                    <Button
                      variant="outline"
                      onClick={() => handleExplainCardWithAI(card)}
                      className="w-full h-14 rounded-2xl font-bold bg-muted/50 text-muted-foreground hover:bg-muted transition-all border border-border shadow-sm"
                    >
                      <Lightbulb className="w-5 h-5 mr-2" />
                      Explain Concept
                    </Button>
                  </div>

                  <div className="md:col-span-3">
                    <Button
                      variant="ghost"
                      onClick={() => {
                        setActiveDeckCardIndex(0);
                        setShowFlashcardBack(false);
                      }}
                      className="w-full h-12 rounded-2xl text-muted-foreground hover:text-foreground font-semibold flex flex-col gap-0.5"
                    >
                      <RotateCcw className="w-4 h-4" />
                      <span className="text-[10px] uppercase tracking-widest font-bold">Restart Session</span>
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          );
        }

        // Flashcards Hub View
        return (
          <div className="h-full overflow-y-auto bg-background">
            <div className="p-4 sm:p-10 max-w-5xl mx-auto space-y-12 pb-40">
              <div className="space-y-1">
                <h1 className="text-3xl font-bold text-foreground tracking-tight">Flashcards</h1>
                <p className="text-muted-foreground text-sm">Master concepts through spaced repetition and AI-optimized card sets.</p>
              </div>

              {/* Deck Generation Section */}
              <div className="p-6 bg-card rounded-2xl border border-border/50 shadow-sm relative overflow-hidden group">
                <div className="relative space-y-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                      <Sparkles className="w-5 h-5" />
                    </div>
                    <div>
                      <h2 className="text-lg font-bold tracking-tight">Create Smart Deck</h2>
                      <p className="text-xs text-muted-foreground">Extract critical facts from your lessons with AI.</p>
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Deck Intensity</Label>
                      <Select value={flashcardCount.toString()} onValueChange={(v) => setFlashcardCount(parseInt(v))}>
                        <SelectTrigger className="h-10 rounded-xl bg-background border shadow-sm font-semibold">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl border">
                          {[10, 20, 30, 40, 50].map(n => (
                            <SelectItem key={n} value={n.toString()}>{n} Cards <span className="text-muted-foreground font-normal ml-1">({Math.round(n/5)} min)</span></SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Focus topics</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="outline" className="w-full h-10 rounded-xl bg-background border shadow-sm justify-between font-semibold px-4">
                            <span className="truncate">
                              {selectedFlashcardTopicIds.length === 0 ? "Comprehensive Set" : `${selectedFlashcardTopicIds.length} Topic${selectedFlashcardTopicIds.length > 1 ? 's' : ''}`}
                            </span>
                            <Plus className="w-4 h-4 opacity-40 shrink-0" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-2 rounded-xl border-2 shadow-2xl" align="start">
                          <div className="space-y-1 max-h-72 overflow-y-auto custom-scrollbar">
                            {lessonSections.map((section) => (
                              <div
                                key={section.id}
                                className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted cursor-pointer transition-colors"
                                onClick={() => {
                                  setSelectedFlashcardTopicIds(prev => prev.includes(section.id) ? prev.filter(id => id !== section.id) : [...prev, section.id]);
                                }}
                              >
                                <Checkbox checked={selectedFlashcardTopicIds.includes(section.id)} id={`fc-q-${section.id}`} className="rounded-md h-4 w-4" />
                                <label className="text-sm font-medium leading-tight cursor-pointer line-clamp-1">{section.title}</label>
                              </div>
                            ))}
                          </div>
                        </PopoverContent>
                      </Popover>
                    </div>
                  </div>

                  <Button 
                    onClick={handleGenerateFlashcards} 
                    disabled={isGeneratingFlashcards || !nbtLessonId}
                    className="w-full h-12 rounded-xl shadow-lg shadow-primary/10 transition-all font-bold text-base gap-3"
                  >
                    {isGeneratingFlashcards ? <Loader2 className="w-5 h-5 animate-spin" /> : <Layers className="w-5 h-5" />}
                    {isGeneratingFlashcards ? "Generating Deck..." : "Generate Study Deck"}
                  </Button>
                </div>
              </div>

              {/* Deck List */}
              <div className="space-y-8">
                <div className="flex items-center gap-4">
                  <h3 className="text-2xl font-bold text-foreground italic">Your Card Decks</h3>
                  <div className="h-px flex-1 bg-border/50" />
                </div>
                
                {existingFlashcards.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {existingFlashcards.map((deck: any) => {
                      const cardCount = deck.flashcards?.length || 0;
                      const masteredCount = deck.flashcards?.filter((c: any) => c.is_mastered).length || 0;
                      const masteryPercent = cardCount > 0 ? Math.round((masteredCount / cardCount) * 100) : 0;

                      return (
                        <button
                          key={deck.id}
                          onClick={() => { setActiveDeckId(deck.id); setActiveDeckCardIndex(0); setShowFlashcardBack(false); }}
                          className="w-full p-6 bg-card border border-border/50 rounded-2xl hover:border-primary/50 hover:bg-primary/5 transition-all text-left group shadow-sm hover:shadow-md relative"
                        >
                          <div className="flex items-center justify-between gap-4">
                            <div className="flex-1 min-w-0">
                              <p className="text-lg font-bold text-foreground truncate group-hover:text-primary transition-colors">{deck.title}</p>
                              <div className="flex items-center gap-2 mt-2">
                                <div className="flex-1 bg-secondary rounded-full h-1.5 overflow-hidden">
                                  <div
                                    className="bg-primary h-1.5 rounded-full transition-all duration-500"
                                    style={{
                                      width: `${masteryPercent}%`,
                                    }}
                                  />
                                </div>
                                <span className="text-[10px] font-bold text-muted-foreground whitespace-nowrap">
                                  {masteryPercent}%
                                </span>
                              </div>
                              <p className="text-[10px] font-medium text-muted-foreground mt-2">
                                {masteredCount} / {cardCount} cards mastered
                              </p>
                            </div>
                            <div className="w-10 h-10 rounded-xl bg-primary/5 flex items-center justify-center group-hover:bg-primary/10 transition-colors">
                              <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="py-24 text-center space-y-6 border-2 border-dashed rounded-[3rem] border-border/30 bg-muted/5">
                    <Layers className="w-16 h-16 text-muted-foreground/10 mx-auto" />
                    <div className="space-y-1">
                      <p className="font-bold text-xl text-foreground/60">No Active Decks</p>
                      <p className="text-sm text-muted-foreground">Pick a topic above and generate your first set of flashcards.</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      }

      case 'document': {
        const doc = material.document;
        const fileUrl = doc?.source_file_url || doc?.knowledge_base?.source_file_url;
        return (
          <div className="w-full h-full flex flex-col">
            <div className="flex-1 overflow-auto bg-muted/30">
              {fileUrl ? <PdfViewer fileUrl={fileUrl} /> : <div className="flex items-center justify-center h-full text-muted-foreground">No source material available</div>}
            </div>
          </div>
        );
      }

      default:
        return null;
    }
  };

  const isMobile = typeof window !== 'undefined' && window.innerWidth < 1024;

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
              onClick={onClose}
              disabled={isAnyGenerating}
              className={cn("mb-3 -ml-2", isAnyGenerating ? "text-muted-foreground/50 cursor-not-allowed pointer-events-auto" : "text-muted-foreground hover:text-foreground")}
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
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider leading-none mb-1">NBT {materialSection}</p>
                {isRenaming ? (
                  <div className="flex items-center gap-1">
                    <Input
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleRename();
                        if (e.key === 'Escape') { setIsRenaming(false); setNewName(materialTitle); }
                      }}
                      className="h-7 text-sm"
                      autoFocus
                    />
                    <Button size="icon" variant="ghost" className="h-6 w-6 text-green-600" onClick={handleRename} disabled={isSavingName}>
                      {isSavingName ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                    </Button>
                    <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive" onClick={() => { setIsRenaming(false); setNewName(materialTitle); }}>
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-1">
                    <p className="font-black text-base lg:text-lg leading-tight truncate max-w-[160px]">{materialTitle}</p>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => { setIsRenaming(true); setNewName(materialTitle); }}
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

        {/* Section Selector in Sidebar */}
        {(isSidebarExpanded || isMobile) && (
          <div className="p-4 border-b border-border/50">
            <div className="flex items-center gap-2 mb-2">
              <Badge className="bg-primary/10 text-primary border-none font-bold uppercase tracking-wider text-[10px] px-2">
                SECTION
              </Badge>
            </div>
            <Select
              value={materialSection}
              onValueChange={handleSectionChange}
              disabled={isSavingSection}
            >
              <SelectTrigger className="w-full h-8 text-xs font-bold">
                <SelectValue placeholder="Select section" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="AQL">AQL Section</SelectItem>
                <SelectItem value="MAT">MAT Section</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Export PDF Button */}
        {(isSidebarExpanded || isMobile) && localContent && activeTab === 'lesson' && (
          <div className="p-4 border-b border-border/50">
            <Button
              variant="outline"
              size="sm"
              className="w-full gap-2 rounded-xl"
              onClick={() => exportContentToPDF(localContent, materialTitle, `${materialTitle}.pdf`)}
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
      {isMobile && !isSidebarExpanded && (
        <div className="flex items-center justify-between px-2 sm:px-4 py-2 sm:py-3 border-b border-border bg-background shrink-0 w-full overflow-hidden gap-2">
          <div className="flex items-center gap-1 sm:gap-2 min-w-0 shrink-1">
            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => setIsSidebarExpanded(true)}>
              <Sparkles className="w-4 h-4 text-primary" />
            </Button>
            <p className="font-bold text-sm truncate max-w-[120px] sm:max-w-[200px]">{materialTitle}</p>
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
          <Button variant="ghost" size="icon" className={cn("h-8 w-8 shrink-0", isAnyGenerating && "opacity-50 cursor-not-allowed")} onClick={onClose} disabled={isAnyGenerating} title={isAnyGenerating ? 'Generation in progress...' : 'Close'}>
            <X className="w-4 h-4" />
          </Button>
        </div>
      )}

      {/* Content Area */}
      <main className="flex-1 min-w-0 overflow-hidden relative flex flex-col">
        <div className="flex-1 overflow-hidden relative">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab + (activeQuizId || '') + (activeExamId || '')}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="h-full"
            >
              {renderContent()}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>


      {/* Comment Modal */}
      <Dialog open={isCommentModalOpen} onOpenChange={(open) => { if (!open) handleCancelComment(); }}>
        <DialogContent className="sm:max-w-[400px] p-0 overflow-hidden border-none shadow-2xl">
          <div className="bg-primary px-6 py-4 flex items-center gap-3">
            <div className="bg-white/20 p-2 rounded-lg">
              <MessageSquarePlus className="w-5 h-5 text-white" />
            </div>
            <div>
              <DialogTitle className="text-white text-lg">Add Comment</DialogTitle>
              <DialogDescription className="text-primary-foreground/80 text-xs">
                Annotate your NBT study guide
              </DialogDescription>
            </div>
          </div>

          <div className="p-6 space-y-4 bg-background">
            {pendingCommentText && (
              <div className="space-y-1.5">
                <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Selected Text</Label>
                <div className="bg-muted/50 p-3 rounded-lg border-l-4 border-primary/30 max-h-24 overflow-y-auto">
                  <p className="text-xs text-muted-foreground italic leading-relaxed">
                    "{pendingCommentText}"
                  </p>
                </div>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="comment-input-nbt" className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Your Notes</Label>
              <Textarea
                id="comment-input-nbt"
                placeholder="Type your comment here..."
                value={commentInputValue}
                onChange={(e) => setCommentInputValue(e.target.value)}
                className="min-h-[100px] resize-none border-muted focus-visible:ring-primary"
                autoFocus
              />
            </div>
          </div>

          <DialogFooter className="p-4 bg-muted/30 border-t flex flex-row gap-2 sm:justify-end">
            <Button variant="ghost" size="sm" onClick={handleCancelComment} className="text-xs">
              Cancel
            </Button>
            <Button size="sm" onClick={handleSaveCommentFromModal} disabled={!commentInputValue.trim()} className="text-xs px-6 shadow-sm">
              Save Comment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default NBTMaterialView;
