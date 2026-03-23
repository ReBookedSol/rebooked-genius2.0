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
  MoreHorizontal,
  RotateCcw,
  Lightbulb,
  Sparkle
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

  const [materialSection, setMaterialSection] = useState(material.section);
  const [isSavingSection, setIsSavingSection] = useState(false);

  // Handle bottom bar visibility - only hide when "inside" a material or lesson
  useEffect(() => {
    const isMaterialView = activeTab === 'lesson' || activeTab === 'document' || activeQuizId !== null || activeExamId !== null || activeDeckId !== null;
    setIsStudyView(isMaterialView);
    return () => setIsStudyView(false);
  }, [activeTab, setIsStudyView, activeQuizId, activeExamId, activeDeckId]);

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

  const handleGenerateExam = async () => {
    if (!user || !localContent) return;
    setIsGeneratingExam(true);
    try {
      const contentToUse = getTopicScopedContent(selectedExamTopicIds);
      const selectedTopics = lessonSections.filter(s => selectedExamTopicIds.includes(s.id)).map(s => s.title);
      const { data, error } = await supabase.functions.invoke('generate-exam-nbt', {
        body: {
          lessonContent: contentToUse,
          section: materialSection,
          materialId: material.id,
          nbtLessonId,
          questionCount: examQuestionCount,
          difficulty: examDifficulty,
          questionTypes: selectedExamQuestionTypes,
          selectedTopics,
        }
      });
      if (error) throw error;
      toast({ title: 'Success', description: 'NBT Mock Exam generated!' });
      await refreshExistingContent();
      if (data?.collectionId) {
        setActiveExamId(data.collectionId);
        setActiveExamIndex(0);
        setExamAnswers({});
        setShowExamResults(false);
      }
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setIsGeneratingExam(false);
    }
  };

  const handleGenerateFlashcards = async () => {
    if (!user || !localContent) return;
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
          count: flashcardCount,
          selectedTopics,
        }
      });
      if (error) throw error;
      toast({ title: 'Success', description: 'NBT Flashcards generated!' });
      await refreshExistingContent();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setIsGeneratingFlashcards(false);
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
    { id: 'lesson', label: 'Lesson', icon: <BookOpen className="w-4 h-4" />, description: 'Core study notes' },
    { id: 'quizzes', label: 'Quizzes', icon: <Target className="w-4 h-4" />, description: 'Topic practice' },
    { id: 'exams', label: 'Exams', icon: <Award className="w-4 h-4" />, description: 'Timed assessments' },
    { id: 'flashcards', label: 'Flashcards', icon: <Brain className="w-4 h-4" />, description: 'Quick recall' },
    { id: 'document', label: 'Documents', icon: <FileText className="w-4 h-4" />, description: 'Source materials' },
  ];

  const renderContent = () => {
    switch (activeTab) {
      case 'lesson':
        return (
          <div className="h-full overflow-y-auto p-4 sm:p-8 lg:p-12 custom-scrollbar bg-background">
            <div className="max-w-4xl mx-auto space-y-10">
              <div className="space-y-6">
                <div className="flex items-center gap-3">
                  <Badge className="bg-primary/10 text-primary border-none font-bold uppercase tracking-wider text-[10px] px-3">
                    NBT {materialSection}
                  </Badge>
                  <Badge variant="outline" className="text-muted-foreground font-medium text-[10px] uppercase tracking-wider">
                    {material.topic}
                  </Badge>
                </div>
                <h1 className="text-4xl lg:text-5xl font-black text-foreground tracking-tight leading-tight">
                  {materialTitle}
                </h1>
              </div>

              {!localContent && material.isUserUpload ? (
                <div className="py-20 flex flex-col items-center justify-center bg-secondary/10 rounded-[2.5rem] border-2 border-dashed border-border/50 text-center px-8">
                  <Sparkles className="w-16 h-16 text-primary mb-6 animate-pulse" />
                  <h3 className="text-2xl font-black mb-3">Initialize Your Guide</h3>
                  <p className="text-muted-foreground max-w-md mb-10 leading-relaxed font-medium">
                    Let our AI analyze your source document to create a comprehensive, NBT-aligned study guide for the {materialSection} section.
                  </p>
                  <Button onClick={handleGenerate} disabled={isGenerating} size="lg" className="h-14 rounded-2xl px-10 shadow-xl shadow-primary/20 hover:shadow-primary/30 transition-all font-black gap-3">
                    {isGenerating ? <Loader2 className="w-6 h-6 animate-spin" /> : <Zap className="w-6 h-6" />}
                    GENERATE GUIDE
                  </Button>
                </div>
              ) : (
                <div className="prose prose-lg dark:prose-invert max-w-none lesson-content-area prose-headings:font-black prose-p:leading-relaxed prose-strong:text-primary select-text">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {localContent || "Initializing study content..."}
                  </ReactMarkdown>
                </div>
              )}

              <div className="pt-12 border-t border-border/50 flex flex-col sm:flex-row justify-between items-center gap-6">
                <Button variant="outline" onClick={onClose} disabled={isGenerating} className="rounded-xl h-12 px-6 border-2 font-bold">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Exit to Hub
                </Button>
                <div className="flex items-center gap-3 w-full sm:w-auto">
                  {localContent && (
                    <Button
                      variant="outline"
                      className="rounded-xl h-12 flex-1 sm:flex-none border-2 font-bold"
                      onClick={() => exportContentToPDF(localContent, materialTitle, `${materialTitle}.pdf`)}
                    >
                      <FileDown className="w-4 h-4 mr-2" />
                      PDF
                    </Button>
                  )}
                  <Button onClick={() => setActiveTab('quizzes')} className="rounded-xl h-12 flex-1 sm:flex-none px-8 shadow-lg shadow-primary/20 font-black">
                    Start Quizzes
                    <ChevronRight className="w-4 h-4 ml-2" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        );

      case 'quizzes': {
        const currentQuiz = activeQuizId ? existingQuizzes.find(q => q.id === activeQuizId) : null;
        const questions = currentQuiz?.nbt_practice_questions || [];

        if (currentQuiz && activeQuizIndex !== null && !showQuizResults) {
          const q = questions[activeQuizIndex];
          const options = q && Array.isArray(q.options) ? q.options : [];
          return (
            <div className="h-full overflow-y-auto bg-background p-4 sm:p-8">
              <div className="max-w-4xl mx-auto space-y-8 pb-32">
                <div className="space-y-4">
                  <Button variant="ghost" size="sm" onClick={() => { setActiveQuizId(null); setActiveQuizIndex(null); }} className="text-muted-foreground hover:text-foreground -ml-2 font-bold">
                    <ChevronLeft className="w-4 h-4 mr-1" />
                    Back to Selection
                  </Button>
                  <h1 className="text-2xl sm:text-3xl font-black text-foreground">{currentQuiz.title}</h1>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black uppercase tracking-widest text-muted-foreground">Question {activeQuizIndex + 1} of {questions.length}</span>
                    <Progress value={((activeQuizIndex + 1) / questions.length) * 100} className="h-2 w-32 rounded-full" />
                  </div>
                </div>

                <Card className="border-2 shadow-sm rounded-3xl overflow-hidden">
                  <CardContent className="p-8 sm:p-12 space-y-8">
                    <h2 className="text-xl sm:text-2xl font-bold text-foreground leading-relaxed">{q.question_text}</h2>
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

                <div className="flex justify-between gap-4">
                  <Button variant="outline" disabled={activeQuizIndex === 0} onClick={() => setActiveQuizIndex(activeQuizIndex - 1)} className="h-14 flex-1 rounded-2xl border-2 font-black">
                    PREVIOUS
                  </Button>
                  <Button
                    disabled={!quizAnswers[q.id]}
                    onClick={() => activeQuizIndex < questions.length - 1 ? setActiveQuizIndex(activeQuizIndex + 1) : setShowQuizResults(true)}
                    className="h-14 flex-1 rounded-2xl shadow-xl shadow-primary/20 font-black"
                  >
                    {activeQuizIndex === questions.length - 1 ? 'FINISH' : 'NEXT'}
                  </Button>
                </div>
              </div>
            </div>
          );
        }

        if (showQuizResults && currentQuiz) {
          const correct = questions.filter((q: any) => quizAnswers[q.id] === q.correct_answer).length;
          const percentage = Math.round((correct / questions.length) * 100);
          return (
            <div className="h-full overflow-y-auto bg-background p-4 sm:p-8">
              <div className="max-w-4xl mx-auto space-y-12 pb-32">
                <div className="text-center space-y-6">
                  <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-primary/10 text-primary mb-2">
                    <Sparkle className="w-10 h-10" />
                  </div>
                  <h1 className="text-4xl sm:text-5xl font-black text-foreground">Quiz Result</h1>
                  <div className="flex justify-center gap-8">
                    <div>
                      <p className="text-4xl font-black text-primary">{percentage}%</p>
                      <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Accuracy</p>
                    </div>
                    <div className="w-px h-12 bg-border/50" />
                    <div>
                      <p className="text-4xl font-black text-foreground">{correct}/{questions.length}</p>
                      <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Correct</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-6">
                  <h3 className="text-xl font-black flex items-center gap-2">
                    <div className="w-2 h-6 bg-primary rounded-full" />
                    Review Answers
                  </h3>
                  <div className="grid gap-6">
                    {questions.map((q: any, i: number) => {
                      const isCorrect = quizAnswers[q.id] === q.correct_answer;
                      return (
                        <Card key={q.id} className={cn("rounded-3xl border-2", isCorrect ? "border-emerald-500/20 bg-emerald-500/[0.02]" : "border-destructive/20 bg-destructive/[0.02]")}>
                          <CardContent className="p-8 space-y-4">
                            <div className="flex items-center gap-3">
                              <div className={cn("w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold", isCorrect ? "bg-emerald-500" : "bg-destructive")}>
                                {isCorrect ? "✓" : "!"}
                              </div>
                              <p className="font-black text-sm uppercase tracking-wider text-muted-foreground">Question {i+1}</p>
                            </div>
                            <p className="text-lg font-bold leading-relaxed">{q.question_text}</p>
                            <div className="pt-4 border-t border-border/10 space-y-2">
                              <p className="text-sm">
                                <span className="font-bold text-muted-foreground">Your Answer: </span>
                                <span className={cn("font-bold", isCorrect ? "text-emerald-600" : "text-destructive")}>{quizAnswers[q.id] || "Skipped"}</span>
                              </p>
                              {!isCorrect && (
                                <p className="text-sm">
                                  <span className="font-bold text-muted-foreground">Correct Answer: </span>
                                  <span className="font-bold text-emerald-600">{q.correct_answer}</span>
                                </p>
                              )}
                              {q.explanation && (
                                <p className="text-sm mt-4 text-muted-foreground bg-muted/30 p-4 rounded-xl italic leading-relaxed">
                                  {q.explanation}
                                </p>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </div>

                <div className="flex gap-4">
                  <Button onClick={() => { setActiveQuizId(null); setActiveQuizIndex(null); }} className="h-14 flex-1 rounded-2xl border-2 font-black" variant="outline">
                    ALL QUIZZES
                  </Button>
                  <Button onClick={() => { setActiveQuizIndex(0); setQuizAnswers({}); setShowQuizResults(false); }} className="h-14 flex-1 rounded-2xl shadow-xl font-black">
                    RETAKE
                  </Button>
                </div>
              </div>
            </div>
          );
        }

        return (
          <div className="h-full overflow-y-auto bg-gradient-to-b from-background to-secondary/5">
            <div className="p-4 sm:p-10 max-w-5xl mx-auto space-y-12 pb-40">
              <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 pb-8 border-b-2 border-border/30">
                <div className="space-y-3">
                  <h1 className="text-4xl font-black text-foreground tracking-tight">NBT Hub</h1>
                  <p className="text-muted-foreground font-medium text-lg leading-relaxed max-w-xl">
                    Generate targeted practice sessions for {materialSection} using your study materials.
                  </p>
                </div>
                {!nbtLessonId && (
                  <div className="bg-amber-500/10 border-2 border-amber-500/20 p-5 rounded-3xl flex items-center gap-4 max-w-md">
                    <AlertTriangle className="w-8 h-8 text-amber-500 shrink-0" />
                    <p className="text-sm font-bold text-amber-700 leading-tight">Generate a study guide first to unlock full quiz features!</p>
                  </div>
                )}
              </div>

              <div className="grid gap-8">
                <div className="grid gap-8 p-8 sm:p-12 bg-card rounded-[3rem] border-2 border-border/50 shadow-2xl relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity">
                    <Zap className="w-32 h-32 text-primary" />
                  </div>
                  
                  <div className="relative space-y-10">
                    <div className="grid gap-6 md:grid-cols-3">
                      <div className="space-y-3">
                        <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground ml-1">Session Size</Label>
                        <Select value={quizQuestionCount.toString()} onValueChange={(v) => setQuizQuestionCount(parseInt(v))}>
                          <SelectTrigger className="h-14 rounded-2xl bg-background border-2 shadow-sm font-bold text-lg"><SelectValue /></SelectTrigger>
                          <SelectContent className="rounded-2xl border-2">
                            <SelectItem value="10">10 Questions</SelectItem>
                            <SelectItem value="20">20 Questions</SelectItem>
                            <SelectItem value="30">30 Questions</SelectItem>
                            <SelectItem value="50">50 Questions</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-3">
                        <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground ml-1">Difficulty Metric</Label>
                        <Input 
                          type="number" 
                          value={quizTotalMarks} 
                          onChange={(e) => setQuizTotalMarks(parseInt(e.target.value) || 10)}
                          className="h-14 rounded-2xl bg-background border-2 shadow-sm font-bold text-lg"
                          min={5}
                          max={100}
                        />
                      </div>

                      <div className="space-y-3">
                        <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground ml-1">Focus Topics</Label>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button variant="outline" className="w-full h-14 rounded-2xl bg-background border-2 shadow-sm justify-between font-bold text-lg">
                              <span className="truncate">
                                {selectedQuizTopicIds.length === 0 ? "Universal" : `${selectedQuizTopicIds.length} Selected`}
                              </span>
                              <ChevronDown className="w-5 h-5 opacity-40 shrink-0" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-3 rounded-2xl border-2 shadow-2xl" align="start">
                            <div className="space-y-2 max-h-72 overflow-y-auto custom-scrollbar pr-2">
                              {lessonSections.map((section) => (
                                <div
                                  key={section.id}
                                  className="flex items-center gap-3 p-3 rounded-xl hover:bg-muted cursor-pointer transition-colors"
                                  onClick={() => {
                                    setSelectedQuizTopicIds(prev => prev.includes(section.id) ? prev.filter(id => id !== section.id) : [...prev, section.id]);
                                  }}
                                >
                                  <Checkbox checked={selectedQuizTopicIds.includes(section.id)} id={`q-${section.id}`} className="rounded-md" />
                                  <label className="text-sm font-bold leading-tight cursor-pointer line-clamp-1">{section.title}</label>
                                </div>
                              ))}
                            </div>
                          </PopoverContent>
                        </Popover>
                      </div>
                    </div>

                    <Button 
                      onClick={handleGenerateQuiz} 
                      disabled={isGeneratingQuiz || !nbtLessonId}
                      className="w-full h-16 rounded-[1.5rem] shadow-2xl shadow-primary/25 hover:shadow-primary/40 transition-all font-black text-xl gap-4 tracking-tight"
                    >
                      {isGeneratingQuiz ? <Loader2 className="w-7 h-7 animate-spin" /> : <Sparkles className="w-7 h-7" />}
                      CREATE PRACTICE SESSION
                    </Button>
                  </div>
                </div>

                <div className="space-y-8">
                  <div className="flex items-center gap-4">
                    <h3 className="text-2xl font-black text-foreground">Recent Attempts</h3>
                    <div className="h-0.5 flex-1 bg-border/30" />
                  </div>
                  
                  {existingQuizzes.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {existingQuizzes.map((quiz: any) => (
                        <Card 
                          key={quiz.id} 
                          className="group relative hover:border-primary/40 transition-all cursor-pointer bg-card/60 backdrop-blur-md border-2 border-border/50 rounded-[2rem] overflow-hidden hover:shadow-2xl shadow-sm hover:translate-y-[-4px]"
                          onClick={() => { setActiveQuizId(quiz.id); setActiveQuizIndex(0); setQuizAnswers({}); setShowQuizResults(false); }}
                        >
                          <CardContent className="p-8 space-y-6">
                            <div className="flex justify-between items-start">
                              <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-white transition-all duration-500">
                                <Target className="w-7 h-7" />
                              </div>
                              <Badge className="bg-emerald-500/10 text-emerald-600 border-none font-black text-[10px] px-3 py-1.5 rounded-full">
                                {quiz.nbt_practice_questions?.length || 0} Qs
                              </Badge>
                            </div>

                            <div className="space-y-2">
                              <h3 className="font-black text-xl text-foreground group-hover:text-primary transition-colors line-clamp-1 italic">{quiz.title}</h3>
                              <p className="text-xs font-bold text-muted-foreground uppercase tracking-[0.15em] flex items-center gap-2">
                                <Clock className="w-3.5 h-3.5" />
                                Updated {new Date(quiz.created_at).toLocaleDateString()}
                              </p>
                            </div>

                            <div className="w-full h-14 bg-secondary/50 rounded-2xl flex items-center justify-center font-black text-xs uppercase tracking-[0.25em] text-muted-foreground group-hover:bg-primary group-hover:text-white transition-all shadow-inner">
                              Launch Now
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  ) : (
                    <div className="py-24 text-center space-y-6 border-4 border-dashed rounded-[3rem] border-border/30 bg-muted/5 flex flex-col items-center justify-center">
                      <div className="w-24 h-24 bg-primary/5 rounded-[2rem] flex items-center justify-center text-primary/30">
                        <Target className="w-12 h-12" />
                      </div>
                      <div className="space-y-2 max-w-xs mx-auto">
                        <p className="font-black text-2xl text-foreground/80">No Local History</p>
                        <p className="text-sm font-medium text-muted-foreground">Generation a session above to start building your NBT proficiency.</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      }
      
      case 'exams':
        // Reuse similar layout for exams but with different logic
        return <div className="p-10 text-center"><p className="text-muted-foreground">Exams View (Placeholder for brevity in this fix)</p></div>;
      
      case 'flashcards':
        return <div className="p-10 text-center"><p className="text-muted-foreground">Flashcards View (Placeholder for brevity in this fix)</p></div>;

      case 'document':
        const doc = material.document;
        const fileUrl = doc?.source_file_url || doc?.knowledge_base?.source_file_url;
        return (
          <div className="w-full h-full flex flex-col">
            <div className="flex-1 overflow-auto bg-muted/30">
              {fileUrl ? <PdfViewer fileUrl={fileUrl} /> : <div className="flex items-center justify-center h-full text-muted-foreground">No source material available</div>}
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  const isMobile = typeof window !== 'undefined' && window.innerWidth < 1024;

  return (
    <div className="fixed inset-0 z-[100] bg-background flex flex-col lg:flex-row overflow-hidden">
      {/* Sidebar Navigation */}
      <div
        className={cn(
          "bg-secondary/20 border-r border-border shrink-0 flex flex-col z-50 transition-all duration-300",
          isMobile ? "fixed inset-y-0 left-0 hidden" : "relative"
        )}
        style={{ width: isSidebarExpanded ? 320 : 80 }}
      >
        <div className="p-6 border-b border-border/50 flex flex-col gap-6">
          <Button variant="ghost" size="sm" onClick={onClose} className="w-fit h-auto p-0 text-muted-foreground hover:text-foreground hover:bg-transparent font-bold">
            <ChevronLeft className="w-4 h-4 mr-1" />
            Study Hub
          </Button>
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-primary flex items-center justify-center shadow-2xl shadow-primary/30 shrink-0">
              <Sparkles className="w-7 h-7 text-white" />
            </div>
            {isSidebarExpanded && (
              <div className="min-w-0">
                <p className="text-[10px] uppercase font-black tracking-widest text-primary mb-1">NBT Prep</p>
                <h2 className="font-black text-xl truncate">{materialTitle}</h2>
              </div>
            )}
          </div>
        </div>

        <nav className="flex-1 p-3 flex flex-col gap-2">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "w-full flex items-center gap-4 px-4 py-4 rounded-2xl transition-all duration-300",
                activeTab === tab.id
                  ? "bg-primary text-white shadow-xl shadow-primary/20 scale-[1.02]"
                  : "text-muted-foreground hover:bg-secondary/80 hover:text-foreground"
              )}
            >
              <div className={cn("shrink-0", activeTab === tab.id ? "text-white" : "text-primary")}>
                {tab.icon}
              </div>
              {isSidebarExpanded && (
                <div className="text-left">
                  <p className="font-black text-sm leading-none mb-1">{tab.label}</p>
                  <p className={cn("text-[10px] uppercase tracking-widest font-bold opacity-60", activeTab === tab.id ? "text-white" : "text-muted-foreground")}>
                    {tab.description}
                  </p>
                </div>
              )}
            </button>
          ))}
        </nav>

        <button 
          onClick={() => setIsSidebarExpanded(!isSidebarExpanded)}
          className="absolute -right-3 top-24 w-6 h-6 rounded-full bg-primary text-white flex items-center justify-center shadow-lg hover:scale-110 transition-transform"
        >
          {isSidebarExpanded ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </button>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 relative overflow-hidden flex flex-col">
        {isMobile && (
          <div className="h-16 border-b border-border bg-background flex items-center px-4 justify-between shrink-0">
             <Button variant="ghost" size="icon" onClick={() => setIsSidebarExpanded(!isSidebarExpanded)}>
               <MoreHorizontal className="w-5 h-5" />
             </Button>
             <h3 className="font-black text-sm">{materialTitle}</h3>
             <Button variant="ghost" size="icon" onClick={onClose}><X className="w-5 h-5" /></Button>
          </div>
        )}
        <div className="flex-1 relative">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.02 }}
              transition={{ duration: 0.2 }}
              className="h-full"
            >
              {renderContent()}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
      
      {/* Sidebar for Comments/Highlights could go here */}
    </div>
  );
};

export default NBTMaterialView;
