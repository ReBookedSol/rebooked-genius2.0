import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import DOMPurify from 'dompurify';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
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
  MoreHorizontal,
  RotateCcw,
  Lightbulb
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { extractMarkdownSections } from '@/lib/markdownUtils';
import { useAuth } from '@/contexts/AuthContext';
import { useSidebar } from '@/contexts/SidebarContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { exportContentToPDF } from '@/lib/lessonPDFExport';
import { extractTextFromPDFInBatches } from '@/lib/pdfExtractor';

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
  const { isChatExpanded, chatWidth } = useSidebar();
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
  const [activeQuizIndex, setActiveQuizIndex] = useState<number | null>(null);
  const [quizAnswers, setQuizAnswers] = useState<Record<string, string>>({});
  const [showQuizResults, setShowQuizResults] = useState(false);

  const [examDifficulty, setExamDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium');
  const [examQuestionCount, setExamQuestionCount] = useState(20);
  const [flashcardCount, setFlashcardCount] = useState(20);
  const [selectedExamTopicIds, setSelectedExamTopicIds] = useState<string[]>([]);
  const [selectedFlashcardTopicIds, setSelectedFlashcardTopicIds] = useState<string[]>([]);
  const [selectedExamQuestionTypes, setSelectedExamQuestionTypes] = useState<string[]>(['multipleChoice', 'trueFalse', 'fillInBlank']);

  const [selectedQuizTopicIds, setSelectedQuizTopicIds] = useState<string[]>([]);
  const [quizQuestionCount, setQuizQuestionCount] = useState(10);
  const [quizTotalMarks, setQuizTotalMarks] = useState(10);

  const [activeExamId, setActiveExamId] = useState<string | null>(null);
  const [activeExamIndex, setActiveExamIndex] = useState(0);
  const [examAnswers, setExamAnswers] = useState<Record<string, string>>({});
  const [showExamResults, setShowExamResults] = useState(false);

  const [activeDeckId, setActiveDeckId] = useState<string | null>(null);
  const [activeDeckCardIndex, setActiveDeckCardIndex] = useState(0);
  const [showFlashcardBack, setShowFlashcardBack] = useState(false);
  const [materialSection, setMaterialSection] = useState(material.section);
  const [isSavingSection, setIsSavingSection] = useState(false);

  // Inline comment popover state (matching Study section)
  const [commentPopover, setCommentPopover] = useState<{
    visible: boolean;
    x: number;
    y: number;
    comment: string;
    highlightedText: string;
  }>({ visible: false, x: 0, y: 0, comment: '', highlightedText: '' });

  // Comment modal state
  const [isCommentModalOpen, setIsCommentModalOpen] = useState(false);
  const [commentInputValue, setCommentInputValue] = useState('');
  const [pendingCommentText, setPendingCommentText] = useState('');
  // 1. Check for existing generated lesson for this document/material
  useEffect(() => {
    const checkExistingLesson = async () => {
      if (!user) return;
      
      try {
        // Try to find an existing generated lesson for this source document
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
          console.log('Found existing generated lesson:', existingLesson.id);
          setNbtLessonId(existingLesson.id);
          setLocalContent(existingLesson.content);
          return;
        }

        // Fallback: load content from material itself
        if (material.content) {
          setLocalContent(material.content);
        } else if (material.id && !material.id.startsWith('demo-')) {
          // Try loading from nbt_study_materials
          const { data } = await supabase
            .from('nbt_study_materials')
            .select('content')
            .eq('id', material.id)
            .single();
          if (data?.content) {
            setLocalContent(data.content);
          }
        }
      } catch (err) {
        console.error('Error checking existing lesson:', err);
      }
    };

    checkExistingLesson();
  }, [user, material.id, material.content, material.isUserUpload]);

  // 2. Fetch existing quizzes/exams/flashcards scoped to this lesson
  useEffect(() => {
    const fetchExistingContent = async () => {
      if (!user) return;
      setLoadingExisting(true);
      try {
        // Build query - scope by nbt_lesson_id if we have one, otherwise by section
        let collectionsQuery = supabase
          .from('nbt_question_collections')
          .select('*, nbt_practice_questions(*)')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });

        if (nbtLessonId) {
          collectionsQuery = collectionsQuery.eq('nbt_lesson_id', nbtLessonId);
        } else {
          collectionsQuery = collectionsQuery.eq('section', material.section).is('nbt_lesson_id', null);
        }

        const { data: collections } = await collectionsQuery;

        if (collections && collections.length > 0) {
          const collectionIds = collections.map(c => c.id);
        // Get best scores from nbt_practice_attempts grouped by collection
          const { data: perfData } = await supabase
            .from('nbt_practice_attempts')
            .select('question_id, is_correct, nbt_practice_questions!inner(collection_id)')
            .in('nbt_practice_questions.collection_id', collectionIds)
            .eq('user_id', user.id);

          const bestScores: Record<string, number> = {};
          if (perfData) {
            // Group attempts by collection_id and compute scores
            const collectionAttempts: Record<string, { correct: number; total: number }> = {};
            perfData.forEach((p: any) => {
              const cid = p.nbt_practice_questions?.collection_id;
              if (!cid) return;
              if (!collectionAttempts[cid]) collectionAttempts[cid] = { correct: 0, total: 0 };
              collectionAttempts[cid].total++;
              if (p.is_correct) collectionAttempts[cid].correct++;
            });
            Object.entries(collectionAttempts).forEach(([cid, stats]) => {
              bestScores[cid] = stats.total > 0 ? (stats.correct / stats.total) * 100 : 0;
            });
          }

          const quizzes = collections
            .filter((c: any) => c.title?.toLowerCase().includes('quiz'))
            .map(c => ({ ...c, best_score: bestScores[c.id] }));
          const exams = collections
            .filter((c: any) => !c.title?.toLowerCase().includes('quiz'))
            .map(c => ({ ...c, best_score: bestScores[c.id] }));
          setExistingQuizzes(quizzes);
          setExistingExams(exams);
        } else {
          setExistingQuizzes([]);
          setExistingExams([]);
        }

        // Fetch flashcard decks scoped to this lesson
        let flashcardsQuery = supabase
          .from('flashcard_decks')
          .select('*, flashcards(*)')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });

        if (nbtLessonId) {
          flashcardsQuery = flashcardsQuery.eq('nbt_lesson_id', nbtLessonId);
        } else {
          flashcardsQuery = flashcardsQuery.ilike('title', `%NBT%${material.section}%`).is('nbt_lesson_id', null);
        }

        const { data: flashcardDecks } = await flashcardsQuery;
        setExistingFlashcards(flashcardDecks || []);
      } catch (err) {
        console.error('Error fetching existing NBT content:', err);
      } finally {
        setLoadingExisting(false);
      }
    };

    fetchExistingContent();
  }, [user, material.section, nbtLessonId]);

  const lessonSections = useMemo(() => {
    if (!localContent) return [];
    return extractMarkdownSections(localContent).filter((section) => section.content?.trim().length > 0);
  }, [localContent]);

  const getTopicScopedContent = (selectedIds: string[]) => {
    if (!localContent) return '';
    if (!selectedIds.length || !lessonSections.length) return localContent;

    const selectedSections = lessonSections.filter((section) => selectedIds.includes(section.id));
    if (!selectedSections.length) return localContent;

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
        const response = await fetch(fileUrl);
        const blob = await response.blob();
        const file = new File([blob], doc.file_name || 'document.pdf', { type: 'application/pdf' });
        const result = await extractTextFromPDFInBatches(file);

        if (result.error) throw new Error(result.error);
        documentText = result.batches.map(b => b.text).join('\n');
      } else {
        documentText = doc.processed_content || (doc.isNbtDocument ? doc.content : doc.knowledge_base?.content) || '';
      }

      if (!documentText) throw new Error('No content found to analyze');

      const { data, error } = await supabase.functions.invoke('generate-lesson-nbt', {
        body: {
          documentText,
          section: material.section,
          documentId: material.id
        }
      });

      if (error) throw error;

      if (data.alreadyExists) {
        toast({
          title: 'Lesson Found',
          description: 'Your previously generated lesson has been loaded.',
        });
      } else {
        toast({
          title: 'Success',
          description: 'NBT Study Guide generated and saved!',
        });
      }

      // Set the lesson ID for scoping
      if (data.lessonId) {
        setNbtLessonId(data.lessonId);
        
        // Load the lesson content
        const { data: lessonData } = await supabase
          .from('nbt_generated_lessons')
          .select('content')
          .eq('id', data.lessonId)
          .single();

        if (lessonData?.content) {
          setLocalContent(lessonData.content);
        }
      }

      if (data.materialId) {
        const { data: newMaterial } = await supabase
          .from('nbt_study_materials')
          .select('*')
          .eq('id', data.materialId)
          .single();

        if (newMaterial && !localContent) {
          setLocalContent(newMaterial.content);
        }
      }
      
      onRefresh?.();
    } catch (err: any) {
      console.error('NBT Generation error:', err);
      toast({
        title: 'Error',
        description: err.message || 'Failed to generate NBT material',
        variant: 'destructive',
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const refreshExistingContent = async () => {
    if (!user) return;
    try {
      let collectionsQuery = supabase
        .from('nbt_question_collections')
        .select('*, nbt_practice_questions(*)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (nbtLessonId) {
        collectionsQuery = collectionsQuery.eq('nbt_lesson_id', nbtLessonId);
      } else {
        collectionsQuery = collectionsQuery.eq('section', material.section).is('nbt_lesson_id', null);
      }

      const { data: collections } = await collectionsQuery;

      if (collections) {
        const quizzes = collections.filter((c: any) => c.title?.toLowerCase().includes('quiz'));
        const exams = collections.filter((c: any) => !c.title?.toLowerCase().includes('quiz'));
        setExistingQuizzes(quizzes);
        setExistingExams(exams);
      }

      let flashcardsQuery = supabase
        .from('flashcard_decks')
        .select('*, flashcards(*)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (nbtLessonId) {
        flashcardsQuery = flashcardsQuery.eq('nbt_lesson_id', nbtLessonId);
      } else {
        flashcardsQuery = flashcardsQuery.ilike('title', `%NBT%${material.section}%`).is('nbt_lesson_id', null);
      }

      const { data: flashcardDecks } = await flashcardsQuery;
      setExistingFlashcards(flashcardDecks || []);
    } catch (err) {
      console.error('Error refreshing content:', err);
    }
  };

  const handleGenerateQuiz = async () => {
    if (!user || !localContent) return;
    setIsGeneratingQuiz(true);
    try {
      const contentToUse = getTopicScopedContent(selectedQuizTopicIds);
      const selectedTopics = lessonSections
        .filter((section) => selectedQuizTopicIds.includes(section.id))
        .map((section) => section.title);

      const { data, error } = await supabase.functions.invoke('generate-quiz-nbt', {
        body: {
          lessonContent: contentToUse,
          section: material.section,
          materialId: material.id,
          nbtLessonId: nbtLessonId,
          count: quizQuestionCount,
          selectedTopics,
        }
      });
      if (error) {
        // Check if the error is just a parsing issue but data exists
        const errorMsg = typeof error === 'object' && error?.message ? error.message : String(error);
        if (errorMsg.includes('FunctionsFetchError') || errorMsg.includes('non-2xx')) {
          console.warn('Quiz generation returned non-2xx but may have succeeded, refreshing...');
        } else {
          throw new Error(errorMsg);
        }
      }
      if (data?.error) throw new Error(data.error);
      toast({ title: 'Success', description: data?.message || 'NBT Quiz generated!' });
      await refreshExistingContent();
    } catch (err: any) {
      console.error('NBT Quiz Generation error:', err);
      toast({ title: 'Error', description: err.message || 'Failed to generate NBT quiz', variant: 'destructive' });
    } finally {
      setIsGeneratingQuiz(false);
    }
  };

  const handleGenerateExam = async () => {
    if (!user || !localContent) return;
    setIsGeneratingExam(true);
    try {
      const contentToUse = getTopicScopedContent(selectedExamTopicIds);
      const selectedTopics = lessonSections
        .filter((section) => selectedExamTopicIds.includes(section.id))
        .map((section) => section.title);

      const { data, error } = await supabase.functions.invoke('generate-exam-nbt', {
        body: {
          lessonContent: contentToUse,
          section: material.section,
          materialId: material.id,
          nbtLessonId,
          questionCount: examQuestionCount,
          difficulty: examDifficulty,
          questionTypes: selectedExamQuestionTypes,
          selectedTopics,
        }
      });
      if (error) {
        const errorMsg = typeof error === 'object' && error?.message ? error.message : String(error);
        if (errorMsg.includes('FunctionsFetchError') || errorMsg.includes('non-2xx')) {
          console.warn('Exam generation returned non-2xx but may have succeeded, refreshing...');
        } else {
          throw new Error(errorMsg);
        }
      }
      if (data?.error) throw new Error(data.error);
      toast({ title: 'Success', description: data?.message || 'NBT Mock Exam generated!' });
      await refreshExistingContent();
      setActiveExamId(data?.collectionId || null);
      setActiveExamIndex(0);
      setExamAnswers({});
      setShowExamResults(false);
    } catch (err: any) {
      console.error('NBT Exam Generation error:', err);
      toast({ title: 'Error', description: err.message || 'Failed to generate NBT mock exam', variant: 'destructive' });
    } finally {
      setIsGeneratingExam(false);
    }
  };

  const handleGenerateFlashcards = async () => {
    if (!user || !localContent) return;
    setIsGeneratingFlashcards(true);
    try {
      const contentToUse = getTopicScopedContent(selectedFlashcardTopicIds);
      const selectedTopics = lessonSections
        .filter((section) => selectedFlashcardTopicIds.includes(section.id))
        .map((section) => section.title);

      const { data, error } = await supabase.functions.invoke('generate-flashcards-nbt', {
        body: {
          lessonContent: contentToUse,
          section: material.section,
          materialId: material.id,
          nbtLessonId,
          count: flashcardCount,
          selectedTopics,
        }
      });
      if (error) {
        const errorMsg = typeof error === 'object' && error?.message ? error.message : String(error);
        if (!errorMsg.includes('FunctionsFetchError') && !errorMsg.includes('non-2xx')) {
          throw new Error(errorMsg);
        }
      }
      if (data?.error) throw new Error(data.error);
      toast({ title: 'Success', description: data?.message || 'NBT Flashcards generated!' });
      await refreshExistingContent();
    } catch (err: any) {
      console.error('NBT Flashcard Generation error:', err);
      toast({ title: 'Error', description: err.message || 'Failed to generate NBT flashcards', variant: 'destructive' });
    } finally {
      setIsGeneratingFlashcards(false);
    }
  };

  const handleRename = async () => {
    if (!newName.trim() || newName === materialTitle) {
      setIsRenaming(false);
      setNewName(materialTitle);
      return;
    }
    setIsSavingName(true);
    try {
      // 1. Update nbt_study_materials if it's an official or user material
      if (material.id && !material.id.startsWith('demo-')) {
        const { error: matError } = await supabase
          .from('nbt_study_materials')
          .update({ title: newName.trim() })
          .eq('id', material.id);
        if (matError) console.warn('Could not update nbt_study_materials title:', matError);
      }

      // 2. Update nbt_generated_lessons if we have a lesson ID
      if (nbtLessonId) {
        const { error: lessonError } = await supabase
          .from('nbt_generated_lessons')
          .update({ title: newName.trim() })
          .eq('id', nbtLessonId);
        if (lessonError) console.warn('Could not update nbt_generated_lessons title:', lessonError);
      }

      // 3. Update knowledge_base if we have a knowledge ID
      if (material.knowledge_id) {
        const { error: kbError } = await supabase
          .from('knowledge_base')
          .update({ title: newName.trim() })
          .eq('id', material.knowledge_id);
        if (kbError) console.warn('Could not update knowledge_base title:', kbError);
      }

      setMaterialTitle(newName.trim());
      setIsRenaming(false);
      toast({ title: 'Renamed successfully', description: 'NBT material name updated.' });
      onRefresh?.();
    } catch (error: any) {
      console.error('Error renaming material:', error);
      toast({ title: 'Error', description: 'Failed to rename material.', variant: 'destructive' });
    } finally {
      setIsSavingName(false);
    }
  };

  const handleSectionChange = async (newSection: string) => {
    if (!newSection || newSection === materialSection) return;
    setIsSavingSection(true);
    try {
      // 1. Update nbt_user_documents if it's a user material
      if (material.isUserUpload && material.id) {
        const { error } = await supabase
          .from('nbt_user_documents')
          .update({ section: newSection })
          .eq('id', material.id);
        if (error) throw error;
      }

      // 2. Update nbt_study_materials if it's an official material or already generated
      if (material.id && !material.id.startsWith('demo-')) {
        const { error } = await supabase
          .from('nbt_study_materials')
          .update({ section: newSection })
          .eq('id', material.id);
        if (error) console.warn('Could not update nbt_study_materials section:', error);
      }

      // 3. Update nbt_generated_lessons if we have a lesson ID
      if (nbtLessonId) {
        const { error } = await supabase
          .from('nbt_generated_lessons')
          .update({ section: newSection })
          .eq('id', nbtLessonId);
        if (error) console.warn('Could not update nbt_generated_lessons section:', error);
      }

      setMaterialSection(newSection);
      toast({ title: 'Section updated', description: `NBT material moved to: ${newSection}` });
      onRefresh?.();
    } catch (error: any) {
      console.error('Error updating section:', error);
      toast({ title: 'Error', description: 'Failed to update section.', variant: 'destructive' });
    } finally {
      setIsSavingSection(false);
    }
  };

  // Update reading progress based on scroll
  useEffect(() => {
    // Reading progress tracking removed as per requirements
  }, [activeTab]);

  const tabs = [
    { id: 'lesson', label: 'Lesson', icon: <BookOpen className="w-4 h-4" />, description: 'Core study notes' },
    { id: 'quizzes', label: 'Quizzes', icon: <Target className="w-4 h-4" />, description: 'Topic practice' },
    { id: 'exams', label: 'Exams', icon: <Award className="w-4 h-4" />, description: 'Timed assessments' },
    { id: 'flashcards', label: 'Flashcards', icon: <Brain className="w-4 h-4" />, description: 'Quick recall' },
    { id: 'document', label: 'Documents', icon: <FileText className="w-4 h-4" />, description: 'Source materials' },
  ];

  const isHTML = (content: string) => {
    return content.trim().startsWith('<') && content.includes('</');
  };

  const renderLessonContent = (content: string) => {
    if (isHTML(content)) {
      return (
        <div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(content) }} />
      );
    }
    return (
      <ReactMarkdown remarkPlugins={[remarkGfm]}>
        {content}
      </ReactMarkdown>
    );
  };

  // Persist content area changes after highlight/comment
  const persistContentAreaChanges = () => {
    const contentArea = window.document.querySelector('.lesson-content-area');
    if (contentArea) {
      // Content is persisted in the DOM for the session
      // Could be extended to save to DB if needed
    }
  };

  const handleHighlight = (text: string, color: string) => {
    try {
      highlightSelectedText(color);
      persistContentAreaChanges();
      toast({ title: 'Highlighted', description: 'Text highlighted successfully.' });
    } catch (error) {
      console.error('Error highlighting text:', error);
    }
  };

  const handleComment = (text: string) => {
    setPendingCommentText(text);
    setCommentInputValue('');
    highlightSelectedText('#10b981', true, 'PENDING_COMMENT');
    persistContentAreaChanges();
    setIsCommentModalOpen(true);
  };

  const handleSaveCommentFromModal = async () => {
    if (!commentInputValue.trim()) return;
    try {
      const contentArea = window.document.querySelector('.lesson-content-area');
      if (contentArea) {
        const pendingSpan = contentArea.querySelector('span[data-comment="PENDING_COMMENT"]');
        if (pendingSpan) {
          pendingSpan.setAttribute('data-comment', commentInputValue.trim());
        }
        persistContentAreaChanges();
      }
      if (user && nbtLessonId) {
        await supabase.from('lesson_comments').insert({
          user_id: user.id,
          lesson_id: nbtLessonId,
          highlighted_text: pendingCommentText,
          content: commentInputValue.trim(),
        });
      }
      toast({ title: 'Comment added', description: 'Tap the highlighted text to view your comment.' });
      setIsCommentModalOpen(false);
    } catch (error) {
      console.error('Error adding comment:', error);
      toast({ title: 'Error', description: 'Failed to add comment.', variant: 'destructive' });
    }
  };

  const handleCancelComment = () => {
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
    const commentEls = window.document.querySelectorAll('.has-comment');
    commentEls.forEach(el => {
      if (el.getAttribute('data-comment') === commentPopover.comment) {
        el.setAttribute('data-comment', newComment);
      }
    });
    persistContentAreaChanges();
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
      // Don't show popover for pending comments
      if (commentText === 'PENDING_COMMENT' || !commentText) {
        return;
      }
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

  const handleAskAI = (text: string) => {
    const prompt = `Can you please further elaborate on this?\n\n"${text}"`;
    window.dispatchEvent(new CustomEvent('openFlashcardExplanation', { detail: { prompt } }));
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'lesson':
        return (
          <div id="nbt-content-scroll" className="h-full overflow-y-auto p-3 sm:p-6 lg:p-10 custom-scrollbar">
            <TextSelectionToolbar
              onComment={handleComment}
              onHighlight={handleHighlight}
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
            <div className="max-w-none mx-auto space-y-8" onClick={handleContentClick}>
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-primary border-primary/20 bg-primary/5 px-3">
                    NBT {material.section}
                  </Badge>
                  <Badge variant="outline" className="text-muted-foreground">
                    {material.topic}
                  </Badge>
                  {nbtLessonId && (
                    <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50 dark:bg-green-950/20 px-3">
                      ✓ Saved
                    </Badge>
                  )}
                </div>
                <h1 className="text-3xl lg:text-4xl font-display font-black text-foreground leading-tight">
                  {materialTitle}
                </h1>
                {!localContent && material.isUserUpload && (
                  <div className="py-12 flex flex-col items-center justify-center bg-secondary/20 rounded-3xl border-2 border-dashed border-border">
                    <Sparkles className="w-12 h-12 text-primary mb-4 animate-pulse" />
                    <h3 className="text-xl font-bold mb-2">Generate Your Lesson</h3>
                    <p className="text-muted-foreground text-center max-w-sm mb-6 px-4">
                      Our AI will analyze your {material.material_type === 'video' ? 'video transcript' : 'document'} and create a comprehensive NBT {material.section} study guide.
                    </p>
                    <Button
                      onClick={handleGenerate}
                      disabled={isGenerating}
                      className="rounded-full px-8 shadow-lg shadow-primary/20 h-12"
                    >
                      {isGenerating ? (
                        <>
                          <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                          Generating...
                        </>
                      ) : (
                        <>
                          <Zap className="w-5 h-5 mr-2" />
                          Generate Now
                        </>
                      )}
                    </Button>
                  </div>
                )}
                {localContent && (
                  <div className="flex items-center gap-6 text-sm text-muted-foreground font-medium">
                    <span className="flex items-center gap-1.5">
                      <Clock className="w-4 h-4" />
                      20-25 min read
                    </span>
                  </div>
                )}
              </div>

              <div className="prose prose-lg dark:prose-invert max-w-none lesson-content-area prose-headings:font-display prose-headings:font-black prose-p:leading-relaxed prose-strong:text-primary select-text">
                {localContent ? (
                  <div className="space-y-6">
                    {localContent.includes('\n\n---\n\n') ? (
                      localContent.split('\n\n---\n\n').map((chunk, i) => (
                        <div key={i} className="mb-12 last:mb-0">
                          {renderLessonContent(chunk)}
                        </div>
                      ))
                    ) : (
                      renderLessonContent(localContent)
                    )}
                  </div>
                ) : !material.isUserUpload && (
                  <div className="space-y-6">
                    <p className="text-xl text-muted-foreground leading-relaxed">
                      Welcome to your NBT {material.section} study guide. This module covers the essential strategies and concepts needed to excel in the {material.section} section of the National Benchmark Test.
                    </p>
                    <h2 className="text-2xl font-black">1. Understanding the Assessment</h2>
                    <p>
                      The {material.section} test is designed to measure your ability to transfer academic knowledge into real-world and academic contexts.
                    </p>
                    <h2 className="text-2xl font-black">2. Next Steps</h2>
                    <p>
                      Upload a document or YouTube URL to generate a personalized lesson, or move on to the **Quizzes** and **Flashcards** tabs.
                    </p>
                  </div>
                )}
              </div>

              <div className="pt-12 border-t border-border flex justify-between items-center flex-wrap gap-3">
                <Button variant="outline" onClick={onClose} className="rounded-full">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to Hub
                </Button>
                <div className="flex items-center gap-3">
                  {localContent && (
                    <Button
                      variant="outline"
                      className="rounded-full"
                      onClick={() => {
                        try {
                          exportContentToPDF(localContent, materialTitle, `${materialTitle}-nbt-lesson.pdf`);
                          toast({ title: 'Export Ready', description: 'Your lesson is ready to save as PDF.' });
                        } catch (err: any) {
                          toast({ title: 'Export Error', description: err.message, variant: 'destructive' });
                        }
                      }}
                    >
                      <FileDown className="w-4 h-4 mr-2" />
                      Export PDF
                    </Button>
                  )}
                  <Button onClick={() => setActiveTab('quizzes')} className="rounded-full px-8 shadow-lg shadow-primary/20">
                    Take Quiz
                    <ChevronRight className="w-4 h-4 ml-2" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        );
      case 'quizzes':
        if (existingQuizzes.length > 0) {
          const currentQuiz = existingQuizzes[0];
          const questions = currentQuiz.nbt_practice_questions || [];
          
          if (activeQuizIndex !== null && !showQuizResults) {
            const q = questions[activeQuizIndex];
            const options = Array.isArray(q.options) ? q.options : [];
            return (
              <div className="h-full overflow-y-auto">
                <div className="p-3 sm:p-6 md:p-8 space-y-4 sm:space-y-8 max-w-4xl mx-auto pb-24 sm:pb-40">
                  {/* Header */}
                  <div className="space-y-2 sm:space-y-4">
                    <Button variant="ghost" size="sm" onClick={() => { setActiveQuizIndex(null); setQuizAnswers({}); setShowQuizResults(false); }} className="text-muted-foreground hover:text-foreground text-xs sm:text-sm">
                      <ChevronLeft className="w-4 h-4 sm:w-5 sm:h-5 mr-1 sm:mr-2" />
                      Back to Quizzes
                    </Button>
                    <div className="space-y-1 sm:space-y-2">
                      <h1 className="text-xl sm:text-3xl md:text-4xl font-bold text-foreground">{currentQuiz.title || 'NBT Quiz'}</h1>
                      <p className="text-sm sm:text-lg text-muted-foreground">
                        Question {activeQuizIndex + 1} of {questions.length}
                      </p>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="space-y-1 sm:space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs sm:text-sm font-medium text-muted-foreground">Progress</span>
                      <span className="text-xs sm:text-sm font-medium text-primary">{activeQuizIndex + 1} / {questions.length}</span>
                    </div>
                    <Progress value={((activeQuizIndex + 1) / questions.length) * 100} className="h-2 sm:h-3 rounded-full" />
                  </div>

                  {/* Question Card */}
                  <Card className="border-2">
                    <CardContent className="p-4 sm:p-8 md:p-10 space-y-4 sm:space-y-8">
                      <h2 className="text-base sm:text-2xl md:text-3xl font-bold text-foreground leading-relaxed">
                        {q.question_text}
                      </h2>
                      <div className="space-y-2 sm:space-y-3 md:space-y-4">
                        {options.map((opt: string, i: number) => (
                          <div
                            key={i}
                            onClick={() => setQuizAnswers({ ...quizAnswers, [q.id]: opt })}
                            className={cn(
                              "flex items-center space-x-2 sm:space-x-4 p-3 sm:p-5 md:p-6 rounded-lg border-2 transition-all cursor-pointer",
                              quizAnswers[q.id] === opt
                                ? "border-primary bg-primary/10"
                                : "border-border hover:border-primary/50 hover:bg-secondary/30"
                            )}
                          >
                            <span className="flex-1 text-xs sm:text-lg md:text-base">{opt}</span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Navigation */}
                  <div className="grid grid-cols-2 gap-3 sm:gap-4 md:gap-6">
                    <Button
                      variant="outline"
                      disabled={activeQuizIndex === 0}
                      onClick={() => setActiveQuizIndex(activeQuizIndex - 1)}
                      size="lg"
                      className="h-10 sm:h-12 md:h-14 text-xs sm:text-base md:text-lg"
                    >
                      <ChevronLeft className="w-4 h-4 sm:w-5 sm:h-5 mr-1 sm:mr-2" />
                      Previous
                    </Button>
                    <Button
                      disabled={!quizAnswers[q.id]}
                      onClick={() => {
                        if (activeQuizIndex < questions.length - 1) {
                          setActiveQuizIndex(activeQuizIndex + 1);
                        } else {
                          setShowQuizResults(true);
                        }
                      }}
                      size="lg"
                      className="h-10 sm:h-12 md:h-14 text-xs sm:text-base md:text-lg"
                    >
                      {activeQuizIndex === questions.length - 1 ? 'Finish Quiz' : 'Next'}
                      <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5 ml-1 sm:ml-2" />
                    </Button>
                  </div>
                </div>
              </div>
            );
          }
          
          if (showQuizResults) {
            const correct = questions.filter((q: any) => quizAnswers[q.id] === q.correct_answer).length;
            const percentage = Math.round((correct / questions.length) * 100);
            return (
              <div className="h-full overflow-y-auto">
                <div className="p-3 sm:p-6 md:p-8 space-y-4 sm:space-y-8 max-w-4xl mx-auto pb-24 sm:pb-40">
                  <div className="text-center space-y-3 sm:space-y-6">
                    <h1 className="text-2xl sm:text-4xl md:text-5xl font-bold text-foreground">Quiz Completed! 🎉</h1>
                    <p className="text-sm sm:text-lg md:text-xl text-muted-foreground">Here's how you performed</p>
                    <Card className="bg-gradient-to-br from-primary/15 to-primary/5 border-2 border-primary/30">
                      <CardContent className="p-4 sm:p-8 md:p-12">
                        <div className="text-4xl sm:text-6xl md:text-7xl font-bold text-primary mb-2 sm:mb-4">{percentage}%</div>
                        <p className="text-sm sm:text-lg md:text-xl text-foreground">
                          {correct} out of {questions.length} questions answered correctly
                        </p>
                      </CardContent>
                    </Card>
                  </div>

                  <div className="space-y-3 sm:space-y-6">
                    <h2 className="text-lg sm:text-2xl md:text-3xl font-bold text-foreground">Answer Review</h2>
                    <div className="grid gap-3 sm:gap-4 md:gap-6">
                      {questions.map((q: any, i: number) => {
                        const isCorrect = quizAnswers[q.id] === q.correct_answer;
                        return (
                          <Card key={q.id} className={isCorrect ? 'border-green-500/30 bg-green-50/30 dark:bg-green-950/10' : 'border-red-500/30 bg-red-50/30 dark:bg-red-950/10'}>
                            <CardContent className="p-3 sm:p-6 md:p-8">
                              <div className="flex items-start gap-2 sm:gap-4 mb-2 sm:mb-4">
                                <div className={`flex-shrink-0 w-7 h-7 sm:w-10 sm:h-10 rounded-full flex items-center justify-center font-bold text-sm sm:text-lg ${
                                  isCorrect ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
                                }`}>
                                  {isCorrect ? '✓' : '✗'}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="font-semibold text-sm sm:text-lg text-foreground mb-1 sm:mb-2">Question {i + 1}</p>
                                  <p className="text-foreground text-xs sm:text-base mb-2 sm:mb-4">{q.question_text}</p>
                                  <div className="space-y-1 sm:space-y-3 text-xs sm:text-base">
                                    <div>
                                      <span className="font-semibold text-foreground">Your answer: </span>
                                      <span className={isCorrect ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>
                                        {quizAnswers[q.id] || 'Not answered'}
                                      </span>
                                    </div>
                                    {!isCorrect && (
                                      <div>
                                        <span className="font-semibold text-foreground">Correct answer: </span>
                                        <span className="text-green-600 dark:text-green-400">{q.correct_answer}</span>
                                      </div>
                                    )}
                                    {q.explanation && (
                                      <div className="pt-2 sm:pt-3 border-t border-border/50">
                                        <span className="font-semibold text-foreground">Explanation: </span>
                                        <p className="text-muted-foreground mt-1 text-xs sm:text-base">{q.explanation}</p>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                    <Button onClick={() => { setActiveQuizIndex(null); setQuizAnswers({}); setShowQuizResults(false); }} size="lg" className="h-10 sm:h-12 md:h-14 text-sm sm:text-base md:text-lg">
                      Back to Quizzes
                    </Button>
                    <Button variant="outline" onClick={() => { setActiveQuizIndex(0); setQuizAnswers({}); setShowQuizResults(false); }} size="lg" className="h-10 sm:h-12 md:h-14 text-sm sm:text-base md:text-lg">
                      Retake Quiz
                    </Button>
                  </div>
                </div>
              </div>
            );
          }
          
        return (
          <div className="h-full overflow-y-auto">
            <div className="p-4 sm:p-8 space-y-8 max-w-4xl mx-auto">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <h2 className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight">Active Quizzes</h2>
                  <p className="text-sm text-muted-foreground italic">"Mistakes are the portals of discovery."</p>
                </div>
                <div className="flex items-center gap-2 px-4 py-2 bg-primary/5 rounded-full border border-primary/10">
                  <Target className="w-5 h-5 text-primary" />
                  <span className="text-sm font-bold text-primary">{existingQuizzes.length} Available</span>
                </div>
              </div>

              {/* Generation controls */}
              {lessonSections.length > 0 && (
                <div className="grid gap-6 p-6 sm:p-8 bg-card rounded-[2rem] border-2 border-border/50 shadow-sm relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                    <Sparkles className="w-24 h-24 text-primary" />
                  </div>
                  
                  <div className="relative space-y-6">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                        <Zap className="w-5 h-5 text-primary" />
                      </div>
                      <h3 className="text-xl font-bold">Quick Quiz Generator</h3>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground ml-1">Questions</Label>
                        <Select value={quizQuestionCount.toString()} onValueChange={(value) => setQuizQuestionCount(parseInt(value, 10))}>
                          <SelectTrigger className="h-12 rounded-xl bg-background border-2"><SelectValue /></SelectTrigger>
                          <SelectContent className="rounded-xl border-2">
                            {[5, 10, 15, 20].map((count) => (
                              <SelectItem key={count} value={count.toString()}>{count} questions</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground ml-1">Focus Topics</Label>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button variant="outline" className="w-full h-12 justify-between rounded-xl bg-background border-2 text-left px-3">
                              <span className="truncate">{selectedQuizTopicIds.length === 0 ? 'All topics' : `${selectedQuizTopicIds.length} selected`}</span>
                              <ChevronDown className="w-4 h-4 opacity-50 shrink-0 ml-2" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-72 p-2 rounded-xl border-2">
                            <div className="space-y-1 max-h-52 overflow-y-auto custom-scrollbar pr-1">
                              {lessonSections.map((section) => (
                                <div
                                  key={section.id}
                                  className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-muted cursor-pointer transition-colors"
                                  onClick={() => {
                                    setSelectedQuizTopicIds((prev) => prev.includes(section.id) ? prev.filter((id) => id !== section.id) : [...prev, section.id]);
                                  }}
                                >
                                  <Checkbox checked={selectedQuizTopicIds.includes(section.id)} className="rounded-md" />
                                  <span className="text-xs font-medium leading-tight">{section.title}</span>
                                </div>
                              ))}
                            </div>
                          </PopoverContent>
                        </Popover>
                      </div>
                    </div>

                    <Button 
                      onClick={handleGenerateQuiz} 
                      disabled={isGeneratingQuiz || !localContent} 
                      className="w-full rounded-2xl h-14 font-black shadow-xl shadow-primary/20 hover:shadow-primary/30 transition-all text-base tracking-tight"
                    >
                      {isGeneratingQuiz ? <Loader2 className="w-6 h-6 animate-spin mr-2" /> : <Sparkles className="w-6 h-6 mr-2" />}
                      Generate Practice Quiz
                    </Button>
                  </div>
                </div>
              )}

              <div className="space-y-4">
                <h3 className="text-lg font-bold text-foreground ml-1">Your Quizzes</h3>
                <div className="grid gap-4">
                  {existingQuizzes.length > 0 ? (
                    existingQuizzes.map((quiz: any) => (
                      <Card 
                        key={quiz.id} 
                        className="hover:shadow-xl transition-all cursor-pointer group border-2 border-transparent hover:border-primary/20 bg-card rounded-2xl overflow-hidden shadow-sm"
                        onClick={() => { setActiveQuizIndex(0); setQuizAnswers({}); setShowQuizResults(false); }}
                      >
                        <CardContent className="p-0">
                          <div className="flex flex-col sm:flex-row sm:items-center">
                            <div className="p-6 flex-1 min-w-0">
                              <div className="flex items-center gap-3 mb-2">
                                <h3 className="font-bold text-lg text-foreground group-hover:text-primary transition-colors truncate">{quiz.title}</h3>
                                {quiz.best_score !== undefined && (
                                  <Badge variant="secondary" className="bg-primary/10 text-primary border-none font-bold tabular-nums">
                                    Best: {Math.round(quiz.best_score)}%
                                  </Badge>
                                )}
                              </div>
                              <div className="flex items-center gap-4 text-sm text-muted-foreground font-medium">
                                <span className="flex items-center gap-1.5">
                                  <FileText className="w-4 h-4" />
                                  {quiz.nbt_practice_questions?.length || 0} Questions
                                </span>
                                <span className="flex items-center gap-1.5">
                                  <Clock className="w-4 h-4" />
                                  Topic Practice
                                </span>
                              </div>
                            </div>
                            <div className="px-6 py-4 sm:py-0 border-t sm:border-t-0 sm:border-l border-border/50 bg-muted/10 flex items-center justify-center min-w-[120px]">
                              <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center group-hover:bg-primary group-hover:text-white transition-all shadow-sm">
                                <Play className="w-6 h-6 ml-0.5" />
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))
                  ) : (
                    <div className="py-12 flex flex-col items-center justify-center border-2 border-dashed border-border/50 rounded-3xl opacity-50">
                      <Target className="w-12 h-12 mb-4" />
                      <p className="font-bold">No quizzes generated yet</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      }
      case 'exams': {
        const activeExam = existingExams.find((exam: any) => exam.id === activeExamId);
        const examQuestions = activeExam?.nbt_practice_questions || [];

        if (activeExam && examQuestions.length > 0) {
          const currentQuestion = examQuestions[activeExamIndex];

          if (showExamResults) {
            const correct = examQuestions.filter((q: any) => examAnswers[q.id] === q.correct_answer).length;
            const percentage = Math.round((correct / examQuestions.length) * 100);

            return (
              <div className="h-full overflow-y-auto">
                <div className="p-3 sm:p-6 md:p-8 space-y-4 sm:space-y-8 max-w-4xl mx-auto pb-24 sm:pb-40 text-center">
                  <div className="space-y-2 sm:space-y-4">
                    <Button variant="ghost" size="sm" onClick={() => { setActiveExamId(null); setActiveExamIndex(0); setExamAnswers({}); setShowExamResults(false); }} className="text-muted-foreground hover:text-foreground">
                      <ChevronLeft className="w-4 h-4 mr-1" />
                      Back to Exams
                    </Button>
                    <h1 className="text-2xl sm:text-4xl md:text-5xl font-bold text-foreground">Exam Completed! 🎓</h1>
                    <p className="text-sm sm:text-lg text-muted-foreground">Detailed review available in the Results tab</p>
                  </div>

                  <Card className="bg-gradient-to-br from-primary/15 to-primary/5 border-2 border-primary/30">
                    <CardContent className="p-6 sm:p-12 md:p-16">
                      <div className="text-5xl sm:text-7xl md:text-8xl font-bold text-primary mb-2 sm:mb-4">{percentage}%</div>
                      <p className="text-sm sm:text-xl md:text-2xl font-medium text-foreground">
                        You scored {correct} out of {examQuestions.length}
                      </p>
                    </CardContent>
                  </Card>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 max-w-lg mx-auto">
                    <Button onClick={() => { setActiveExamId(null); setActiveExamIndex(0); setExamAnswers({}); setShowExamResults(false); }} size="lg" className="h-10 sm:h-12 md:h-14">
                      Back to Mock Exams
                    </Button>
                    <Button variant="outline" onClick={() => { setActiveExamIndex(0); setExamAnswers({}); setShowExamResults(false); }} size="lg" className="h-10 sm:h-12 md:h-14">
                      Retake Exam
                    </Button>
                  </div>
                </div>
              </div>
            );
          }

          const options = Array.isArray(currentQuestion?.options) ? currentQuestion.options : [];
          return (
            <div className="h-full overflow-y-auto">
              <div className="p-3 sm:p-6 md:p-8 space-y-4 sm:space-y-8 max-w-4xl mx-auto pb-24 sm:pb-40">
                {/* Header */}
                <div className="space-y-2 sm:space-y-4">
                  <Button variant="ghost" size="sm" onClick={() => { setActiveExamId(null); setActiveExamIndex(0); setExamAnswers({}); setShowExamResults(false); }} className="text-muted-foreground hover:text-foreground">
                    <ChevronLeft className="w-4 h-4 sm:w-5 sm:h-5 mr-1 sm:mr-2" />
                    Back to Exams
                  </Button>
                  <div className="space-y-1 sm:space-y-2">
                    <h1 className="text-xl sm:text-3xl md:text-4xl font-bold text-foreground truncate">{activeExam.title}</h1>
                    <div className="flex items-center gap-2 text-sm sm:text-lg text-muted-foreground">
                      <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20">Mock Exam</Badge>
                      <span>Question {activeExamIndex + 1} of {examQuestions.length}</span>
                    </div>
                  </div>
                </div>

                {/* Progress */}
                <div className="space-y-1 sm:space-y-2">
                  <div className="flex items-center justify-between text-xs sm:text-sm font-medium">
                    <span className="text-muted-foreground uppercase tracking-wider">Exam Progress</span>
                    <span className="text-primary">{activeExamIndex + 1} / {examQuestions.length}</span>
                  </div>
                  <Progress value={((activeExamIndex + 1) / examQuestions.length) * 100} className="h-2 sm:h-3 rounded-full" />
                </div>

                {/* Question Area */}
                <Card className="border-2 shadow-sm">
                  <CardContent className="p-4 sm:p-8 md:p-10 space-y-4 sm:space-y-8">
                    <div className="space-y-2 sm:space-y-4">
                      <span className="text-[10px] sm:text-xs font-bold uppercase tracking-[0.2em] text-primary bg-primary/5 px-2 py-1 rounded">Question {activeExamIndex + 1}</span>
                      <h2 className="text-base sm:text-2xl md:text-3xl font-bold text-foreground leading-relaxed">
                        {currentQuestion?.question_text}
                      </h2>
                    </div>

                    <div className="space-y-2 sm:space-y-3 md:space-y-4 pt-2 sm:pt-4">
                      {options.map((opt: string, i: number) => (
                        <div
                          key={i}
                          onClick={() => setExamAnswers({ ...examAnswers, [currentQuestion.id]: opt })}
                          className={cn(
                            "group flex items-center space-x-2 sm:space-x-4 p-3 sm:p-5 md:p-6 rounded-xl border-2 transition-all cursor-pointer shadow-sm",
                            examAnswers[currentQuestion.id] === opt
                              ? "border-primary bg-primary/10 ring-2 ring-primary/5 shadow-primary/10"
                              : "border-border hover:border-primary/50 hover:bg-secondary/30 hover:shadow-md"
                          )}
                        >
                          <div className={cn(
                            "flex-shrink-0 w-6 h-6 sm:w-8 sm:h-8 rounded-full border-2 flex items-center justify-center text-[10px] sm:text-xs font-bold transition-colors",
                            examAnswers[currentQuestion.id] === opt
                              ? "bg-primary border-primary text-white"
                              : "border-muted-foreground/30 text-muted-foreground group-hover:border-primary/50"
                          )}>
                            {String.fromCharCode(65 + i)}
                          </div>
                          <span className="flex-1 text-sm sm:text-lg text-foreground font-medium">{opt}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Navigation Buttons */}
                <div className="grid grid-cols-2 gap-3 sm:gap-4 md:gap-6">
                  <Button
                    variant="outline"
                    disabled={activeExamIndex === 0}
                    onClick={() => setActiveExamIndex(activeExamIndex - 1)}
                    size="lg"
                    className="h-10 sm:h-12 md:h-14 text-xs sm:text-base md:text-lg rounded-xl border-2"
                  >
                    <ChevronLeft className="w-4 h-4 sm:w-5 sm:h-5 mr-1 sm:mr-2" />
                    Previous
                  </Button>
                  <Button
                    disabled={!examAnswers[currentQuestion.id]}
                    onClick={() => {
                      if (activeExamIndex < examQuestions.length - 1) {
                        setActiveExamIndex(activeExamIndex + 1);
                      } else {
                        setShowExamResults(true);
                      }
                    }}
                    size="lg"
                    className="h-10 sm:h-12 md:h-14 text-xs sm:text-base md:text-lg rounded-xl shadow-lg shadow-primary/20"
                  >
                    {activeExamIndex === examQuestions.length - 1 ? 'Finish Exam' : 'Next Question'}
                    <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5 ml-1 sm:ml-2" />
                  </Button>
                </div>
              </div>
            </div>
          );
        }

        return (
          <div className="h-full overflow-y-auto">
            <div className="p-4 sm:p-8 space-y-8 max-w-4xl mx-auto">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <h2 className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight">Mock Exams</h2>
                  <p className="text-sm text-muted-foreground italic">"The harder you work, the luckier you get."</p>
                </div>
                <div className="flex items-center gap-2 px-4 py-2 bg-primary/5 rounded-full border border-primary/10">
                  <Award className="w-5 h-5 text-primary" />
                  <span className="text-sm font-bold text-primary">{existingExams.length} Available</span>
                </div>
              </div>

              {/* Generation controls (Matching Study interface) */}
              {lessonSections.length > 0 && (
                <div className="grid gap-6 p-6 sm:p-8 bg-card rounded-[2rem] border-2 border-border/50 shadow-sm relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                    <Sparkles className="w-24 h-24 text-primary" />
                  </div>
                  
                  <div className="relative space-y-6">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                        <Zap className="w-5 h-5 text-primary" />
                      </div>
                      <h3 className="text-xl font-bold">Generate New Exam</h3>
                    </div>

                    <div className="grid gap-4 md:grid-cols-3">
                      <div className="space-y-2">
                        <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground ml-1">Difficulty</Label>
                        <Select value={examDifficulty} onValueChange={(value: 'easy' | 'medium' | 'hard') => setExamDifficulty(value)}>
                          <SelectTrigger className="h-12 rounded-xl bg-background border-2"><SelectValue /></SelectTrigger>
                          <SelectContent className="rounded-xl border-2">
                            <SelectItem value="easy">Easy</SelectItem>
                            <SelectItem value="medium">Medium</SelectItem>
                            <SelectItem value="hard">Hard</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground ml-1">Questions</Label>
                        <Select value={examQuestionCount.toString()} onValueChange={(value) => setExamQuestionCount(parseInt(value, 10))}>
                          <SelectTrigger className="h-12 rounded-xl bg-background border-2"><SelectValue /></SelectTrigger>
                          <SelectContent className="rounded-xl border-2">
                            {[10, 20, 30, 40, 50].map((count) => (
                              <SelectItem key={count} value={count.toString()}>{count} questions</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground ml-1">Topics</Label>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button variant="outline" className="w-full h-12 justify-between rounded-xl bg-background border-2 text-left px-3">
                              <span className="truncate">{selectedExamTopicIds.length === 0 ? 'All topics' : `${selectedExamTopicIds.length} selected`}</span>
                              <ChevronDown className="w-4 h-4 opacity-50 shrink-0 ml-2" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-72 p-2 rounded-xl border-2">
                            <div className="space-y-1 max-h-52 overflow-y-auto custom-scrollbar pr-1">
                              {lessonSections.map((section) => (
                                <div
                                  key={section.id}
                                  className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-muted cursor-pointer transition-colors"
                                  onClick={() => {
                                    setSelectedExamTopicIds((prev) => prev.includes(section.id) ? prev.filter((id) => id !== section.id) : [...prev, section.id]);
                                  }}
                                >
                                  <Checkbox checked={selectedExamTopicIds.includes(section.id)} className="rounded-md" />
                                  <span className="text-xs font-medium leading-tight">{section.title}</span>
                                </div>
                              ))}
                            </div>
                          </PopoverContent>
                        </Popover>
                      </div>
                    </div>

                    {/* Question Types */}
                    <div className="space-y-3">
                      <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground ml-1">Question Types</Label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 bg-muted/30 p-4 rounded-xl border border-border/50">
                        {[
                          { id: 'multipleChoice', label: 'Multiple Choice' },
                          { id: 'fillInBlank', label: 'Fill in the Blank' },
                          { id: 'trueFalse', label: 'True/False' },
                          { id: 'multipleAnswer', label: 'Multiple Answer' },
                          { id: 'matching', label: 'Matching' },
                        ].map((type) => (
                          <div
                            key={type.id}
                            className="flex items-center space-x-3 p-2 rounded-lg hover:bg-background/50 cursor-pointer transition-all"
                            onClick={() => {
                              setSelectedExamQuestionTypes(prev =>
                                prev.includes(type.id)
                                  ? prev.filter(id => id !== type.id)
                                  : [...prev, type.id]
                              );
                            }}
                          >
                            <Checkbox checked={selectedExamQuestionTypes.includes(type.id)} className="h-4 w-4 rounded" />
                            <span className="text-xs font-bold text-foreground/80">{type.label}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <Button 
                      onClick={handleGenerateExam} 
                      disabled={isGeneratingExam || !localContent} 
                      className="w-full rounded-2xl h-14 font-black shadow-xl shadow-primary/20 hover:shadow-primary/30 transition-all text-base tracking-tight"
                    >
                      {isGeneratingExam ? <Loader2 className="w-6 h-6 animate-spin mr-2" /> : <Sparkles className="w-6 h-6 mr-2" />}
                      Generate Full Mock Exam
                    </Button>
                  </div>
                </div>
              )}

              <div className="space-y-4">
                <h3 className="text-lg font-bold text-foreground ml-1">Your Exam History</h3>
                <div className="grid gap-4">
                  {existingExams.map((exam: any) => (
                    <Card 
                      key={exam.id} 
                      className="hover:shadow-xl transition-all cursor-pointer group border-2 border-transparent hover:border-primary/20 bg-card rounded-2xl overflow-hidden shadow-sm" 
                      onClick={() => { setActiveExamId(exam.id); setActiveExamIndex(0); setExamAnswers({}); setShowExamResults(false); }}
                    >
                      <CardContent className="p-0">
                        <div className="flex flex-col sm:flex-row sm:items-center">
                          <div className="p-6 flex-1 min-w-0">
                            <div className="flex items-center gap-3 mb-2">
                              <h3 className="font-bold text-lg text-foreground group-hover:text-primary transition-colors truncate">{exam.title}</h3>
                              {exam.best_score !== undefined && (
                                <Badge variant="secondary" className="bg-primary/10 text-primary border-none font-bold tabular-nums">
                                  Best: {Math.round(exam.best_score)}%
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-4 text-sm text-muted-foreground font-medium">
                              <span className="flex items-center gap-1.5">
                                <FileText className="w-4 h-4" />
                                {exam.nbt_practice_questions?.length || 0} Questions
                              </span>
                              <span className="flex items-center gap-1.5">
                                <Brain className="w-4 h-4" />
                                {exam.difficulty || 'Medium'}
                              </span>
                            </div>
                          </div>
                          <div className="px-6 py-4 sm:py-0 border-t sm:border-t-0 sm:border-l border-border/50 bg-muted/10 flex items-center justify-center min-w-[120px]">
                            <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center group-hover:bg-primary group-hover:text-white transition-all shadow-sm">
                              <Play className="w-6 h-6 ml-0.5" />
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                  {existingExams.length === 0 && !isGeneratingExam && (
                    <div className="py-12 flex flex-col items-center justify-center border-2 border-dashed border-border/50 rounded-3xl opacity-50">
                      <FileText className="w-12 h-12 mb-4" />
                      <p className="font-bold">No exams generated yet</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      }
      case 'flashcards': {
        // Active deck study view with flip animation (matching Study section)
        const activeDeck = existingFlashcards.find((d: any) => d.id === activeDeckId);
        const deckCards = activeDeck?.flashcards || [];
        const masteredInDeck = deckCards.filter((c: any) => c.is_mastered).length;

        if (activeDeck && deckCards.length > 0) {
          const currentCard = deckCards[activeDeckCardIndex];
          return (
            <div className="h-full overflow-y-auto bg-background/50">
              <div className="p-4 md:p-8 space-y-8 max-w-4xl mx-auto min-h-full flex flex-col">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <Button variant="ghost" size="sm" onClick={() => { setActiveDeckId(null); setActiveDeckCardIndex(0); setShowFlashcardBack(false); }} className="text-muted-foreground hover:text-foreground -ml-2 h-8 px-2">
                      <ChevronLeft className="w-4 h-4 mr-1" />
                      All Decks
                    </Button>
                    <h1 className="text-2xl md:text-3xl font-bold text-foreground tracking-tight">{activeDeck.title}</h1>
                  </div>
                  <div className="flex items-center gap-3 bg-card p-2 rounded-xl border border-border/50 shadow-sm">
                    <div className="text-right">
                      <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider leading-none">Mastery</p>
                      <p className="text-lg font-bold text-primary tabular-nums leading-none mt-1">{masteredInDeck}/{deckCards.length}</p>
                    </div>
                    <div className="w-10 h-10 rounded-full border-2 border-primary/20 flex items-center justify-center relative">
                      <svg className="w-full h-full -rotate-90">
                        <circle cx="20" cy="20" r="16" fill="none" stroke="currentColor" strokeWidth="3" className="text-primary/10" />
                        <circle cx="20" cy="20" r="16" fill="none" stroke="currentColor" strokeWidth="3" strokeDasharray={100} strokeDashoffset={100 - (masteredInDeck / deckCards.length) * 100} className="text-primary transition-all duration-500" />
                      </svg>
                    </div>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="space-y-2">
                  <div className="flex justify-between text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    <span>Progress</span>
                    <span>{activeDeckCardIndex + 1} of {deckCards.length} Cards</span>
                  </div>
                  <Progress value={((activeDeckCardIndex + 1) / deckCards.length) * 100} className="h-1.5 rounded-full bg-secondary" />
                </div>

                {/* Flashcard Area */}
                <div className="flex-1 flex flex-col items-center justify-center py-4 perspective-1000">
                  <div className="w-full max-w-2xl relative group h-[400px] md:h-[450px]">
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
                        className="w-full h-full preserve-3d cursor-pointer relative"
                        onClick={() => setShowFlashcardBack(!showFlashcardBack)}
                      >
                        {/* Front side */}
                        <div className={`absolute inset-0 backface-hidden flex flex-col rounded-3xl border-2 border-primary/20 bg-gradient-to-br from-primary/10 to-card shadow-xl transition-all ${!showFlashcardBack ? 'shadow-primary/5 ring-1 ring-primary/10' : ''}`}>
                          <div className="p-6 md:p-8 flex-1 flex flex-col items-center justify-center text-center">
                            <div className="absolute top-6 left-6 flex items-center gap-2 text-primary/60">
                              <Lightbulb className="w-4 h-4" />
                              <span className="text-[10px] font-bold uppercase tracking-widest">Question</span>
                            </div>
                            <div className="w-full max-h-full overflow-y-auto custom-scrollbar px-4">
                              <p className="text-xl md:text-3xl font-bold text-foreground leading-relaxed">
                                {currentCard.front}
                              </p>
                            </div>
                            <div className="absolute bottom-6 w-full text-center">
                              <p className="text-[10px] font-bold text-muted-foreground/50 uppercase tracking-widest">Tap to reveal answer</p>
                            </div>
                          </div>
                        </div>

                        {/* Back side */}
                        <div className={`absolute inset-0 backface-hidden rotate-y-180 flex flex-col rounded-3xl border-2 border-green-500/20 bg-gradient-to-br from-green-500/10 to-card shadow-xl transition-all ${showFlashcardBack ? 'shadow-green-500/5 ring-1 ring-green-500/10' : ''}`}>
                          <div className="p-6 md:p-8 flex-1 flex flex-col items-center justify-center text-center">
                            <div className="absolute top-6 left-6 flex items-center gap-2 text-green-500/60">
                              <Check className="w-4 h-4" />
                              <span className="text-[10px] font-bold uppercase tracking-widest">Answer</span>
                            </div>
                            <div className="w-full max-h-full overflow-y-auto custom-scrollbar px-4">
                              <p className="text-xl md:text-2xl font-semibold text-foreground leading-relaxed whitespace-pre-wrap">
                                {currentCard.back}
                              </p>
                            </div>
                            <div className="absolute bottom-6 w-full text-center">
                              <p className="text-[10px] font-bold text-muted-foreground/50 uppercase tracking-widest">Tap to see question</p>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    </motion.div>
                  </div>
                </div>

                {/* Controls Layout */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-end pb-8">
                  {/* Navigation Controls */}
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
                      disabled={activeDeckCardIndex >= deckCards.length - 1}
                      onClick={() => { setActiveDeckCardIndex(activeDeckCardIndex + 1); setShowFlashcardBack(false); }}
                      className="flex-1 md:w-full h-12 rounded-2xl border-2 hover:bg-muted font-bold tracking-tight"
                    >
                      Next
                      <ChevronRight className="w-5 h-5 ml-2" />
                    </Button>
                  </div>

                  {/* Action Center */}
                  <div className="md:col-span-6 space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <Button
                        disabled={!showFlashcardBack}
                        onClick={async () => {
                          if (currentCard.is_mastered) {
                            await supabase.from('flashcards').update({ is_mastered: false }).eq('id', currentCard.id);
                            currentCard.is_mastered = false;
                          }
                          if (activeDeckCardIndex < deckCards.length - 1) { setActiveDeckCardIndex(activeDeckCardIndex + 1); setShowFlashcardBack(false); }
                        }}
                        variant="outline"
                        className={`h-16 rounded-2xl border-2 font-bold transition-all ${
                          showFlashcardBack
                            ? 'border-orange-500/30 text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-950/20 shadow-lg shadow-orange-500/5'
                            : 'opacity-50 grayscale cursor-not-allowed'
                        }`}
                      >
                        <div className="flex flex-col items-center">
                          <RotateCcw className="w-5 h-5 mb-1" />
                          <span className="text-xs uppercase">Need Practice</span>
                        </div>
                      </Button>
                      <Button
                        disabled={!showFlashcardBack}
                        onClick={async () => {
                          await supabase.from('flashcards').update({ is_mastered: true }).eq('id', currentCard.id);
                          currentCard.is_mastered = true;
                          if (activeDeckCardIndex < deckCards.length - 1) { setActiveDeckCardIndex(activeDeckCardIndex + 1); setShowFlashcardBack(false); }
                        }}
                        className={`h-16 rounded-2xl border-2 font-bold transition-all ${
                          showFlashcardBack
                            ? 'bg-green-600 hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-600 border-green-500/30 shadow-lg shadow-green-500/20'
                            : 'bg-muted border-transparent text-muted-foreground opacity-50 grayscale cursor-not-allowed'
                        }`}
                      >
                        <div className="flex flex-col items-center">
                          <Check className="w-5 h-5 mb-1 text-white" />
                          <span className="text-xs uppercase text-white">Mastered</span>
                        </div>
                      </Button>
                    </div>
                    <Button
                      variant="outline"
                      onClick={() => {
                        const message = `Using the current lesson content, explain the following question in a simple way suitable for a 12-year-old:\n\nQuestion: ${currentCard.front}\n\nAnswer: ${currentCard.back}\n\nPlease explain this concept in more detail.`;
                        window.dispatchEvent(new CustomEvent('openFlashcardExplanation', {
                          detail: { prompt: message, flashcardId: currentCard.id }
                        }));
                        window.dispatchEvent(new CustomEvent('openAiChat', {
                          detail: { message, autoSend: true }
                        }));
                      }}
                      className="w-full h-14 rounded-2xl font-bold bg-muted/50 text-muted-foreground hover:bg-muted transition-all border border-border shadow-sm"
                    >
                      <Lightbulb className="w-5 h-5 mr-2" />
                      Explain Concept
                    </Button>
                  </div>

                  {/* Meta Controls */}
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
        return (
          <div className="h-full overflow-y-auto">
            <div className="p-4 sm:p-8 space-y-8 max-w-4xl mx-auto">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <h2 className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight">Flashcard Decks</h2>
                  <p className="text-sm text-muted-foreground italic">"Memory is the mother of all wisdom."</p>
                </div>
                <div className="flex items-center gap-2 px-4 py-2 bg-primary/5 rounded-full border border-primary/10">
                  <Brain className="w-5 h-5 text-primary" />
                  <span className="text-sm font-bold text-primary">{existingFlashcards.length} Decks</span>
                </div>
              </div>

              {/* Generation controls */}
              {lessonSections.length > 0 && (
                <div className="grid gap-6 p-6 sm:p-8 bg-card rounded-[2rem] border-2 border-border/50 shadow-sm relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                    <Zap className="w-24 h-24 text-primary" />
                  </div>
                  
                  <div className="relative space-y-6">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                        <Sparkles className="w-5 h-5 text-primary" />
                      </div>
                      <h3 className="text-xl font-bold">Generate New Deck</h3>
                    </div>

                    <div className="grid gap-4 md:grid-cols-3">
                      <div className="space-y-2">
                        <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground ml-1">Card Count</Label>
                        <Select value={flashcardCount.toString()} onValueChange={(value) => setFlashcardCount(parseInt(value, 10))}>
                          <SelectTrigger className="h-12 rounded-xl bg-background border-2"><SelectValue /></SelectTrigger>
                          <SelectContent className="rounded-xl border-2">
                            {[10, 20, 30, 40, 50].map((count) => (
                              <SelectItem key={count} value={count.toString()}>{count} cards</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2 md:col-span-2">
                        <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground ml-1">Focus Topics</Label>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button variant="outline" className="w-full h-12 justify-between rounded-xl bg-background border-2 text-left px-3">
                              <span className="truncate">{selectedFlashcardTopicIds.length === 0 ? 'All topics' : `${selectedFlashcardTopicIds.length} selected`}</span>
                              <ChevronDown className="w-4 h-4 opacity-50 shrink-0 ml-2" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-72 p-2 rounded-xl border-2">
                            <div className="space-y-1 max-h-52 overflow-y-auto custom-scrollbar pr-1">
                              {lessonSections.map((section) => (
                                <div
                                  key={section.id}
                                  className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-muted cursor-pointer transition-colors"
                                  onClick={() => {
                                    setSelectedFlashcardTopicIds((prev) => prev.includes(section.id) ? prev.filter((id) => id !== section.id) : [...prev, section.id]);
                                  }}
                                >
                                  <Checkbox checked={selectedFlashcardTopicIds.includes(section.id)} className="rounded-md" />
                                  <span className="text-xs font-medium leading-tight">{section.title}</span>
                                </div>
                              ))}
                            </div>
                          </PopoverContent>
                        </Popover>
                      </div>
                    </div>

                    <Button 
                      onClick={handleGenerateFlashcards} 
                      disabled={isGeneratingFlashcards || !localContent} 
                      className="w-full rounded-2xl h-14 font-black shadow-xl shadow-primary/20 hover:shadow-primary/30 transition-all text-base tracking-tight"
                    >
                      {isGeneratingFlashcards ? <Loader2 className="w-6 h-6 animate-spin mr-2" /> : <Sparkles className="w-6 h-6 mr-2" />}
                      Generate Study Deck
                    </Button>
                  </div>
                </div>
              )}

              <div className="space-y-4">
                <h3 className="text-lg font-bold text-foreground ml-1">Your Decks</h3>
                {existingFlashcards.length > 0 ? (
                  <div className="grid gap-4">
                    {existingFlashcards.map((deck: any) => (
                      <Card 
                        key={deck.id} 
                        className="hover:shadow-xl transition-all cursor-pointer group border-2 border-transparent hover:border-primary/20 bg-card rounded-2xl overflow-hidden shadow-sm"
                        onClick={() => { setActiveDeckId(deck.id); setActiveDeckCardIndex(0); setShowFlashcardBack(false); }}
                      >
                        <CardContent className="p-0">
                          <div className="flex flex-col sm:flex-row sm:items-center">
                            <div className="p-6 flex-1 min-w-0">
                              <div className="flex items-center gap-3 mb-2">
                                <h3 className="font-bold text-lg text-foreground group-hover:text-primary transition-colors truncate">{deck.title}</h3>
                                <Badge variant="secondary" className="bg-primary/5 text-primary border-none font-bold tabular-nums">
                                  {deck.flashcards?.filter((c: any) => c.is_mastered).length || 0}/{deck.flashcards?.length || 0} mastered
                                </Badge>
                              </div>
                              <div className="flex items-center gap-4 text-sm text-muted-foreground font-medium">
                                <span className="flex items-center gap-1.5">
                                  <Zap className="w-4 h-4" />
                                  {deck.flashcards?.length || 0} Cards
                                </span>
                                <span className="flex items-center gap-1.5">
                                  <Clock className="w-4 h-4" />
                                  Created {new Date(deck.created_at).toLocaleDateString()}
                                </span>
                              </div>
                            </div>
                            <div className="px-6 py-4 sm:py-0 border-t sm:border-t-0 sm:border-l border-border/50 bg-muted/10 flex items-center justify-center min-w-[120px]">
                              <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center group-hover:bg-primary group-hover:text-white transition-all shadow-sm">
                                <Play className="w-6 h-6 ml-0.5" />
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <div className="py-20 text-center space-y-4 border-2 border-dashed rounded-[2rem] border-border/50 opacity-50">
                    <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto text-primary">
                      <Brain className="w-10 h-10" />
                    </div>
                    <div className="space-y-1">
                      <p className="font-bold text-xl">No decks available</p>
                      <p className="text-sm">Generate your first flashcard deck to start studying.</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      }
      case 'document':
        const doc = material.document;
        const isYoutube = material.material_type === 'video' ||
                         doc?.file_type === 'video/youtube' ||
                         doc?.knowledge_base?.content_type === 'youtube_lesson';
        const fileUrl = doc?.source_file_url || doc?.knowledge_base?.source_file_url;

        return (
          <div className="w-full h-full flex flex-col">
            <div className="flex-1 overflow-auto bg-muted/30">
              {isYoutube && fileUrl ? (
                <YoutubeViewer videoUrl={fileUrl} />
              ) : fileUrl ? (
                <PdfViewer fileUrl={fileUrl} />
              ) : (
                <div className="flex items-center justify-center h-full">
                  <p className="text-muted-foreground">No source file available</p>
                </div>
              )}
            </div>
          </div>
        );
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
          opacity: isMobile && !isSidebarExpanded ? 0 : 1
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
              className="mb-3 -ml-2 text-muted-foreground hover:text-foreground"
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
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider leading-none mb-1">NBT Guide</p>
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
              <Zap className="w-3 h-3 text-muted-foreground" />
              <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">NBT Section</span>
            </div>
            <Select
              value={materialSection}
              onValueChange={handleSectionChange}
              disabled={isSavingSection}
            >
              <SelectTrigger className="w-full h-8 text-xs">
                <SelectValue placeholder="Select section" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="AQL">AQL (Literacy)</SelectItem>
                <SelectItem value="MAT">MAT (Mathematics)</SelectItem>
                <SelectItem value="QL">QL (Quantitative)</SelectItem>
              </SelectContent>
            </Select>
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
        <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-background shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={onClose}>
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <p className="font-bold text-sm truncate max-w-[120px]">{materialTitle}</p>
          </div>
          <div className="flex items-center gap-0.5">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "p-1.5 rounded-lg transition-colors",
                  activeTab === tab.id ? "bg-primary text-primary-foreground" : "text-muted-foreground"
                )}
              >
                {tab.icon}
              </button>
            ))}
            {/* Mobile options dropdown */}
            <Popover>
              <PopoverTrigger asChild>
                <button className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground">
                  <MoreHorizontal className="w-4 h-4" />
                </button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-48 p-1">
                {localContent && (
                  <button
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-md hover:bg-muted transition-colors"
                    onClick={() => {
                      try {
                        exportContentToPDF(localContent, materialTitle, `${materialTitle}-nbt-lesson.pdf`);
                        toast({ title: 'Export Ready', description: 'Your lesson is ready to save as PDF.' });
                      } catch (err: any) {
                        toast({ title: 'Export Error', description: err.message, variant: 'destructive' });
                      }
                    }}
                  >
                    <FileDown className="w-4 h-4" />
                    Export as PDF
                  </button>
                )}
                {material.document && (material.document.source_file_url || material.document.knowledge_base?.source_file_url) && (
                  <button
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-md hover:bg-muted transition-colors"
                    onClick={() => setActiveTab('document')}
                  >
                    <FileText className="w-4 h-4" />
                    View Source PDF
                  </button>
                )}
                <button
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-md hover:bg-muted transition-colors"
                  onClick={() => { setIsRenaming(true); setNewName(materialTitle); }}
                >
                  <Pencil className="w-4 h-4" />
                  Rename
                </button>
              </PopoverContent>
            </Popover>
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
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.15 }}
            className="h-full"
          >
            {renderContent()}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* NBT Generation Overlay */}
      {(isGenerating || isGeneratingQuiz || isGeneratingExam || isGeneratingFlashcards) && (
        <NBTGenerationOverlay 
          type={isGenerating ? 'lesson' : isGeneratingQuiz ? 'quiz' : isGeneratingExam ? 'exam' : 'flashcards'} 
        />
      )}

      {/* Comment Modal (matching Study section) */}
      <Dialog open={isCommentModalOpen} onOpenChange={(open) => { if (!open) handleCancelComment(); }}>
        <DialogContent className="sm:max-w-[400px] p-0 overflow-hidden border-none shadow-2xl">
          <div className="bg-primary px-6 py-4 flex items-center gap-3">
            <div className="bg-white/20 p-2 rounded-lg">
              <MessageSquarePlus className="w-5 h-5 text-white" />
            </div>
            <div>
              <DialogTitle className="text-white text-lg">Add Comment</DialogTitle>
              <DialogDescription className="text-primary-foreground/80 text-xs">
                Annotate your study material
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

// NBT Facts for the generation overlay
const NBT_FACTS = [
  "The NBT is written by approximately 100,000 students each year in South Africa.",
  "NBT stands for National Benchmark Tests — they measure academic readiness for university.",
  "There are two NBT tests: the AQL (Academic and Quantitative Literacy) and the MAT (Mathematics).",
  "The NBT was introduced in 2009 by Universities South Africa (USAf).",
  "NBT scores range from 0 to 100 and are categorized as Basic, Lower Intermediate, Upper Intermediate, or Proficient.",
  "The AQL test takes 3 hours to complete and has about 75 questions.",
  "The MAT test takes 1.5 hours and has about 60 questions.",
  "You can write the NBT multiple times — universities typically take your best score.",
  "NBT results are valid for 3 years from the date of writing.",
  "The NBT tests critical thinking, not just subject knowledge.",
  "Many South African universities require NBT scores for admission alongside your matric results.",
  "The NBT Academic Literacy section tests reading comprehension, vocabulary, and academic reasoning.",
  "Quantitative Literacy on the NBT measures your ability to manage situations requiring mathematical understanding.",
  "The MAT test covers algebra, functions, geometry, trigonometry, and calculus concepts.",
  "NBT registration usually opens in May each year for the following intake.",
  "Your NBT performance helps universities place you in appropriate support programs.",
  "The NBT is designed to complement — not replace — your National Senior Certificate (NSC) results.",
  "Practice with timed conditions helps simulate the real NBT experience.",
  "Strong reading speed and comprehension are key factors for AQL success.",
  "The NBT does not have a pass or fail — it measures your level of readiness.",
];

const NBTGenerationOverlay: React.FC<{ type: string }> = ({ type }) => {
  const [currentFact, setCurrentFact] = useState(NBT_FACTS[0]);

  useEffect(() => {
    const interval = setInterval(() => {
      const randomIndex = Math.floor(Math.random() * NBT_FACTS.length);
      setCurrentFact(NBT_FACTS[randomIndex]);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const typeLabel = type === 'lesson' ? 'Study Guide' : type === 'quiz' ? 'Quiz' : type === 'exam' ? 'Mock Exam' : 'Flashcards';

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-6 overflow-hidden">
      <div className="absolute inset-0 bg-background/60 backdrop-blur-md animate-in fade-in duration-300" />
      <div className="relative w-full max-w-lg bg-card border border-border rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.15)] overflow-hidden animate-in slide-in-from-bottom-8 zoom-in-95 duration-500">
        <div className="p-8 sm:p-10 space-y-8">
          <div className="text-center space-y-4">
            <div className="mx-auto w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center animate-pulse">
              <Sparkles className="w-7 h-7 text-primary" />
            </div>
            <div className="space-y-1">
              <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
                Generating Your NBT {typeLabel}
              </h2>
              <p className="text-sm text-muted-foreground">This will only take a moment...</p>
            </div>
          </div>

          <div className="p-5 bg-secondary/50 border border-border/50 rounded-2xl relative overflow-hidden">
            <p className="text-xs font-bold uppercase tracking-widest text-primary mb-2">📚 Did you know?</p>
            <p className="text-md font-medium leading-relaxed text-foreground text-center relative z-10 px-2">
              {currentFact}
            </p>
          </div>

          <div className="flex items-center justify-center gap-3">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <span className="font-bold uppercase tracking-wider text-muted-foreground text-xs">
              Processing...
            </span>
          </div>

          <div className="flex items-center justify-center gap-2 text-amber-600 dark:text-amber-500 bg-amber-50 dark:bg-amber-900/10 px-3 py-1.5 rounded-lg border border-amber-200/50 dark:border-amber-800/20">
            <AlertTriangle className="w-3.5 h-3.5" />
            <span className="text-[11px] font-semibold">Stay on this page while we process</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NBTMaterialView;
