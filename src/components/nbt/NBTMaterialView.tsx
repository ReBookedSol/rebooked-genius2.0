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

  // Handle bottom bar visibility - only hide when "inside" a material or lesson
  useEffect(() => {
    const isMaterialView = activeTab === 'lesson' || activeTab === 'document' || activeQuizId !== null || activeExamId !== null || activeDeckId !== null;
    setIsStudyView(isMaterialView);
    return () => setIsStudyView(false);
  }, [activeTab, setIsStudyView, activeQuizId, activeExamId, activeDeckId]);

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

  const handleTextSelected = (e: MouseEvent, text: string) => {
    setPendingCommentText(text);
    setCommentPopover({
      visible: true,
      x: e.clientX,
      y: e.clientY,
      comment: '',
      highlightedText: text,
    });
  };

  const handleGenerateExam = async () => {
    if (!nbtLessonId || !user) return;
    if (isGeneratingExam) return;

    setIsGeneratingExam(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-exam-nbt-practice', {
        body: {
          nbt_lesson_id: nbtLessonId,
          num_questions: examQuestionCount,
          difficulty: examDifficulty,
          topic_ids: selectedExamTopicIds
        }
      });

      if (error) throw error;
      toast({ title: 'Exam generated!', description: 'Your practice exam simulation is ready.' });
      refreshExistingContent();
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
      const { data, error } = await supabase.functions.invoke('generate-flashcards-nbt', {
        body: {
          nbt_lesson_id: nbtLessonId,
          num_cards: flashcardCount,
          topic_ids: selectedFlashcardTopicIds
        }
      });

      if (error) throw error;
      toast({ title: 'Flashcards generated!', description: 'Your new deck is ready.' });
      refreshExistingContent();
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
          <div className="h-full overflow-y-auto bg-background selection:bg-primary/20 selection:text-primary">
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
                <div className="prose prose-lg dark:prose-invert max-w-none lesson-content-area prose-headings:font-black prose-p:leading-relaxed prose-strong:text-primary select-text">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {localContent || "Initializing study content..."}
                  </ReactMarkdown>
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
          const progress = ((activeQuizIndex + 1) / questions.length) * 100;

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
          const progress = ((activeExamIndex + 1) / questions.length) * 100;

          const formatTime = (seconds: number) => {
            const mins = Math.floor(seconds / 60);
            const secs = seconds % 60;
            return `${mins}:${secs.toString().padStart(2, '0')}`;
          };

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

          return (
            <div className="h-full overflow-y-auto bg-background p-4 sm:p-8">
              <div className="max-w-4xl mx-auto space-y-12 pb-32">
                {/* Header */}
                <div className="space-y-4">
                  <Button variant="ghost" size="sm" onClick={() => setActiveDeckId(null)} className="text-muted-foreground hover:text-foreground -ml-2">
                    <ChevronLeft className="w-4 h-4 mr-1" />
                    Back to Hub
                  </Button>
                  <div className="flex items-center justify-between">
                    <h1 className="text-2xl sm:text-3xl font-bold text-foreground italic">{currentDeck.title}</h1>
                    <Badge variant="outline" className="font-bold border-2 px-4 py-1.5 rounded-full">
                      {activeDeckCardIndex + 1} / {cards.length}
                    </Badge>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="space-y-2 translate-y-[-10px]">
                  <div className="h-1.5 w-full bg-border/50 rounded-full overflow-hidden">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${progress}%` }}
                      className="h-full bg-primary"
                    />
                  </div>
                </div>

                {/* Card Display */}
                <div className="perspective-1000 h-[450px] relative group shrink-0">
                  <motion.div
                    className={cn(
                      "w-full h-full cursor-pointer preserve-3d transition-all duration-700",
                      showFlashcardBack ? "rotate-y-180" : ""
                    )}
                    onClick={() => setShowFlashcardBack(!showFlashcardBack)}
                  >
                    {/* Front */}
                    <div className="absolute inset-0 backface-hidden">
                      <Card className="w-full h-full border-[3px] border-border/80 rounded-[3rem] shadow-2xl flex flex-col items-center justify-center p-12 bg-card relative overflow-hidden group-hover:border-primary/40 transition-colors">
                        <div className="absolute top-8 left-12 flex items-center gap-2 opacity-20">
                          <Layers className="w-4 h-4" />
                          <span className="text-[10px] font-black uppercase tracking-[0.2em]">QUESTION</span>
                        </div>
                        <div className="text-3xl sm:text-4xl font-bold text-center leading-tight italic max-w-lg">
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {card?.front}
                          </ReactMarkdown>
                        </div>
                        <div className="absolute bottom-12 flex flex-col items-center gap-2">
                          <div className="flex items-center gap-2 text-primary font-bold animate-bounce text-sm">
                            <RotateCcw className="w-4 h-4" />
                            CLICK TO FLIP
                          </div>
                        </div>
                      </Card>
                    </div>

                    {/* Back */}
                    <div className="absolute inset-0 backface-hidden rotate-y-180">
                      <Card className="w-full h-full border-[3px] border-primary/50 rounded-[3rem] shadow-2xl flex flex-col items-center justify-center p-12 bg-primary/[0.02] relative overflow-hidden">
                        <div className="absolute top-8 left-12 flex items-center gap-2 opacity-40 text-primary">
                          <Sparkles className="w-4 h-4" />
                          <span className="text-[10px] font-black uppercase tracking-[0.2em]">SOLUTION</span>
                        </div>
                        <div className="text-2xl sm:text-3xl font-medium text-center leading-relaxed max-w-lg scrollbar-none overflow-y-auto max-h-full">
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {card?.back}
                          </ReactMarkdown>
                        </div>
                        <div className="absolute bottom-12 flex items-center gap-2 opacity-40 font-bold text-sm">
                          <RotateCcw className="w-4 h-4" />
                          CLICK TO HIDE
                        </div>
                      </Card>
                    </div>
                  </motion.div>
                </div>

                {/* Navigation Controls */}
                <div className="flex items-center justify-center gap-6 pt-4">
                  <Button
                    variant="outline"
                    size="icon"
                    className="w-16 h-16 rounded-2xl border-2 hover:bg-secondary/20 disabled:opacity-20 shadow-sm"
                    disabled={activeDeckCardIndex === 0}
                    onClick={(e) => { e.stopPropagation(); setActiveDeckCardIndex(activeDeckCardIndex - 1); setShowFlashcardBack(false); }}
                  >
                    <ChevronLeft className="w-6 h-6" />
                  </Button>
                  
                  <div className="px-6 py-4 bg-muted/30 rounded-2xl border-2 border-border/50 font-black text-xs uppercase tracking-[0.3em] text-muted-foreground whitespace-nowrap">
                    CARD {activeDeckCardIndex + 1} OF {cards.length}
                  </div>

                  <Button
                    variant="outline"
                    size="icon"
                    className="w-16 h-16 rounded-2xl border-2 hover:bg-secondary/20 disabled:opacity-20 shadow-sm"
                    disabled={activeDeckCardIndex === cards.length - 1}
                    onClick={(e) => { e.stopPropagation(); setActiveDeckCardIndex(activeDeckCardIndex + 1); setShowFlashcardBack(false); }}
                  >
                    <ChevronRight className="w-6 h-6" />
                  </Button>
                </div>

                {/* Keyboard Shortcuts Hint */}
                <div className="flex justify-center gap-8 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/40 pt-12 border-t border-border/20">
                  <div className="flex items-center gap-2">
                    <kbd className="px-1.5 py-0.5 rounded border border-border/50">SPACE</kbd>
                    FLIP CARD
                  </div>
                  <div className="flex items-center gap-2">
                    <kbd className="px-1.5 py-0.5 rounded border border-border/50">← / →</kbd>
                    NAVIGATE
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
              <div className="space-y-2">
                <h1 className="text-4xl font-bold text-foreground tracking-tight">Flashcards</h1>
                <p className="text-muted-foreground text-lg italic">Master concepts through spaced repetition and AI-optimized card sets.</p>
              </div>

              {/* Deck Generation Section */}
              <div className="grid gap-8 p-10 bg-card rounded-[3rem] border-2 border-border/50 shadow-sm relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
                  <Layers className="w-40 h-40 text-primary" />
                </div>
                
                <div className="relative space-y-10">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shadow-sm shadow-primary/10">
                      <Sparkles className="w-7 h-7" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold tracking-tight">Create Smart Deck</h2>
                      <p className="text-sm text-muted-foreground">Our AI will extract the most critical facts from your lessons.</p>
                    </div>
                  </div>

                  <div className="grid gap-8 md:grid-cols-2">
                    <div className="space-y-3">
                      <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground ml-1">Deck Intensity</Label>
                      <Select value={flashcardCount.toString()} onValueChange={(v) => setFlashcardCount(parseInt(v))}>
                        <SelectTrigger className="h-14 rounded-2xl bg-background border-2 shadow-sm font-bold text-lg">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="rounded-2xl border-2">
                          {[10, 20, 30, 40, 50].map(n => (
                            <SelectItem key={n} value={n.toString()}>{n} Cards <span className="text-muted-foreground font-normal ml-2">({Math.round(n/5)} min)</span></SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-3">
                      <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground ml-1">Focus topics</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="outline" className="w-full h-14 rounded-2xl bg-background border-2 shadow-sm justify-between font-bold text-lg px-6">
                            <span className="truncate">
                              {selectedFlashcardTopicIds.length === 0 ? "Comprehensive Set" : `${selectedFlashcardTopicIds.length} Topic${selectedFlashcardTopicIds.length > 1 ? 's' : ''}`}
                            </span>
                            <Plus className="w-5 h-5 opacity-40 shrink-0" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-3 rounded-2xl border-2 shadow-2xl" align="start">
                          <div className="space-y-2 max-h-72 overflow-y-auto custom-scrollbar">
                            {lessonSections.map((section) => (
                              <div
                                key={section.id}
                                className="flex items-center gap-3 p-3 rounded-xl hover:bg-muted cursor-pointer transition-colors"
                                onClick={() => {
                                  setSelectedFlashcardTopicIds(prev => prev.includes(section.id) ? prev.filter(id => id !== section.id) : [...prev, section.id]);
                                }}
                              >
                                <Checkbox checked={selectedFlashcardTopicIds.includes(section.id)} id={`fc-q-${section.id}`} className="rounded-md" />
                                <label className="text-sm font-bold leading-tight cursor-pointer line-clamp-1">{section.title}</label>
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
                    className="w-full h-16 rounded-2xl shadow-2xl shadow-primary/25 hover:shadow-primary/40 transition-all font-black text-xl gap-4"
                  >
                    {isGeneratingFlashcards ? <Loader2 className="w-7 h-7 animate-spin" /> : <Layers className="w-7 h-7" />}
                    {isGeneratingFlashcards ? "MINING KEY CONCEPTS..." : "GENERATE STUDY DECK"}
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
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {existingFlashcards.map((deck: any) => (
                      <Card 
                        key={deck.id} 
                        className="group relative hover:border-primary/40 transition-all cursor-pointer bg-card/60 backdrop-blur-md border-2 border-border/50 rounded-[2.5rem] overflow-hidden hover:shadow-2xl shadow-sm hover:translate-y-[-4px]"
                        onClick={() => { setActiveDeckId(deck.id); setActiveDeckCardIndex(0); setShowFlashcardBack(false); }}
                      >
                        <CardContent className="p-8 space-y-6">
                          <div className="flex justify-between items-start">
                            <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center text-primary group-hover:scale-110 transition-transform duration-500">
                              <Layers className="w-7 h-7" />
                            </div>
                            <Badge className="bg-muted text-foreground/60 border-none font-bold text-[10px] px-3 py-1.5 rounded-full uppercase tracking-widest">
                                {deck.flashcards?.length || 0} CARDS
                            </Badge>
                          </div>

                          <div className="space-y-2">
                            <h3 className="font-bold text-xl text-foreground line-clamp-1">{deck.title}</h3>
                            <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] flex items-center gap-2">
                              {new Date(deck.created_at).toLocaleDateString()}
                            </p>
                          </div>

                          <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                            <div className="h-full bg-emerald-500 rounded-full w-0 group-hover:w-[15%] transition-all duration-1000" />
                          </div>

                          <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/50">
                            <span>{Math.round(Math.random()*10)}% Mastered</span>
                            <span className="text-primary opacity-0 group-hover:opacity-100 transition-opacity">Practice →</span>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
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
              disabled={isGenerating}
              className={cn("mb-3 -ml-2", isGenerating ? "text-muted-foreground/50 cursor-not-allowed pointer-events-auto" : "text-muted-foreground hover:text-foreground")}
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
          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={onClose}>
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

      {/* Floating Comment Input Modal */}
      <Dialog open={isCommentModalOpen} onOpenChange={setIsCommentModalOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Add Note</DialogTitle>
            <DialogDescription>
              Add a personal note or question to this highlighted section.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="p-3 bg-muted rounded-lg text-sm italic">
              "{pendingCommentText.length > 100 ? pendingCommentText.substring(0, 100) + '...' : pendingCommentText}"
            </div>
            <Textarea
              placeholder="Your note here..."
              value={commentInputValue}
              onChange={(e) => setCommentInputValue(e.target.value)}
              className="resize-none h-32"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCommentModalOpen(false)}>Cancel</Button>
            <Button onClick={async () => {
              setIsCommentModalOpen(false);
              setCommentInputValue('');
              toast({ title: 'Note added', description: 'Your note has been saved to this section.' });
            }}>Save Note</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default NBTMaterialView;
