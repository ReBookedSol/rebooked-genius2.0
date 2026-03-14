import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Plus, Upload, Loader2, FileText, Play, Check, X as XIcon, CheckCircle2, XCircle, Trophy, ChevronLeft, Shuffle, Brain, BookOpen, Clock, Lock } from 'lucide-react';
import AppLayout from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useAIContext } from '@/contexts/AIContext';
import { usePageAnimation } from '@/hooks/use-page-animation';
import { useSubscription } from '@/hooks/useSubscription';
import { useChatContext } from '@/hooks/useChatContext';
import { useQuizAnalytics } from '@/hooks/useQuizAnalytics';
import { useSubjectAnalytics } from '@/hooks/useSubjectAnalytics';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import CombinedUploadSection from '@/components/study/CombinedUploadSection';
import RenameableItemRow from '@/components/study/RenameableItemRow';
import DocumentView from '@/pages/DocumentView';
import { cn } from '@/lib/utils';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { updateUserStreak } from '@/utils/streak';
import { recordStudyActivity } from '@/utils/streak';
import { CONTENT_TYPES, extractYoutubeVideoId, safeJsonParse } from '@/lib/constants';

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
  subject_id: string | null;
  created_at: string | null;
  updated_at: string | null;
  extracted_sections: any | null;
  processing_error: string | null;
  knowledge_base?: {
    id: string;
    title: string;
    source_file_url: string | null;
    content: string;
    content_type: string;
    is_active: boolean;
    subject_id: string | null;
  };
}

interface QuizQuestion {
  id: string;
  question: string;
  question_type: string;
  options: any;
  correct_answer: string;
  explanation: string | null;
  points: number;
}

interface Quiz {
  id: string;
  title: string;
  description: string;
  subject_id: string | null;
  total_questions: number;
  time_limit_minutes: number | null;
  is_ai_generated: boolean;
  subjects?: { name: string; color: string } | null;
}

interface FlashcardDeck {
  id: string;
  title: string;
  description: string;
  subject_id: string | null;
  total_cards: number;
  mastered_cards: number;
  is_ai_generated: boolean;
  subjects?: { name: string; color: string } | null;
}

interface Flashcard {
  id: string;
  front: string;
  back: string;
  hint: string | null;
  difficulty: string;
  is_mastered: boolean;
  times_correct: number;
  times_reviewed: number;
}

interface VideoLesson {
  id: string;
  title: string;
  youtube_url: string;
  video_id: string;
  created_at: string;
}

interface CombinedItem {
  id: string;
  type: 'document' | 'video';
  name: string;
  metadata: string;
  data: StudyDocument | VideoLesson;
  isBlocked?: boolean;
}


const Study = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { shouldAnimate } = usePageAnimation('Study');
  const { tier, limits, canUploadDocument } = useSubscription();
  const { id: contentIdFromUrl } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const { updateChatContext } = useChatContext();
  const { recordQuizAttempt } = useQuizAnalytics();
  const { updateSubjectAnalytics } = useSubjectAnalytics();
  const { setAiContext } = useAIContext();

  const [documents, setDocuments] = useState<StudyDocument[]>([]);
  const [videos, setVideos] = useState<VideoLesson[]>([]);
  const [combinedItems, setCombinedItems] = useState<CombinedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>('');
  const [currentSubjectId, setCurrentSubjectId] = useState<string | null>(null);
  const [isUploadSectionExpanded, setIsUploadSectionExpanded] = useState(false);
  const droppedFileRef = useRef<File | null>(null);
  const sessionIdRef = useRef<string | null>(null);

  // Test-related state
  const [isTakingTest, setIsTakingTest] = useState(false);
  const [currentTest, setCurrentTest] = useState<Quiz | null>(null);
  const [testQuestions, setTestQuestions] = useState<QuizQuestion[]>([]);
  const [currentTestQuestionIndex, setCurrentTestQuestionIndex] = useState(0);
  const [selectedTestAnswer, setSelectedTestAnswer] = useState<string>('');
  const [testAnswers, setTestAnswers] = useState<Record<string, string>>({});
  const [showTestResults, setShowTestResults] = useState(false);
  const [testScore, setTestScore] = useState(0);
  const [testTimeLeft, setTestTimeLeft] = useState<number | null>(null);

  // Flashcard-related state (still needed for programmatic access via URL)
  const [flashcardDecks, setFlashcardDecks] = useState<FlashcardDeck[]>([]);
  const [isStudyingFlashcards, setIsStudyingFlashcards] = useState(false);
  const [currentFlashcardDeck, setCurrentFlashcardDeck] = useState<FlashcardDeck | null>(null);
  const [flashcards, setFlashcards] = useState<Flashcard[]>([]);
  const [currentFlashcardIndex, setCurrentFlashcardIndex] = useState(0);
  const [isFlashcardFlipped, setIsFlashcardFlipped] = useState(false);

  // Quiz-related state (still needed for programmatic access via URL)
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [isTakingQuiz, setIsTakingQuiz] = useState(false);
  const [currentQuiz, setCurrentQuiz] = useState<Quiz | null>(null);
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[]>([]);
  const [currentQuizQuestionIndex, setCurrentQuizQuestionIndex] = useState(0);
  const [selectedQuizAnswer, setSelectedQuizAnswer] = useState<string>('');
  const [quizAnswers, setQuizAnswers] = useState<Record<string, string>>({});
  const [showQuizResults, setShowQuizResults] = useState(false);
  const [quizScore, setQuizScore] = useState(0);
  const [quizTimeLeft, setQuizTimeLeft] = useState<number | null>(null);

  const fetchDocuments = useCallback(async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('study_documents')
        .select(`
          id,
          user_id,
          knowledge_id,
          file_name,
          file_size,
          file_type,
          num_pages,
          extraction_status,
          processed_content,
          summary,
          key_concepts,
          subject_id,
          created_at,
          updated_at,
          extracted_sections,
          processing_error,
          knowledge_base(id, title, source_file_url, content, content_type, is_active, subject_id)
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const typedData = data as StudyDocument[];
      setDocuments(typedData);
    } catch (error) {
      console.error('Error fetching documents:', error);
      toast({
        title: 'Error',
        description: 'Failed to load study documents',
        variant: 'destructive',
      });
    }
  }, [user, toast]);

  const fetchVideos = useCallback(async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('knowledge_base')
        .select('id, title, source_file_url, created_at, subject_id')
        .eq('user_id', user.id)
        .eq('content_type', CONTENT_TYPES.YOUTUBE_LESSON)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const videosData: VideoLesson[] = data.map((video: any) => {
        const videoId = extractYoutubeVideoId(video.source_file_url || '');
        return {
          id: video.id,
          title: video.title,
          youtube_url: video.source_file_url || '',
          video_id: videoId,
          created_at: video.created_at,
          subject_id: video.subject_id,
        };
      });

      setVideos(videosData);
    } catch (error) {
      console.error('Error fetching videos:', error);
    }
  }, [user]);

  const fetchFlashcardDecks = useCallback(async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('flashcard_decks')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setFlashcardDecks((data as FlashcardDeck[]) || []);
    } catch (error) {
      console.error('Error fetching flashcard decks:', error);
    }
  }, [user]);

  // NOTE: Study session tracking has been removed from page mount/unmount.
  // Sessions should only be created when actively studying (e.g., when a document is opened
  // or a timer is started). This prevents marking sessions as "completed" when users just
  // browse the study hub without doing any actual studying.

  // Combine documents and videos
  useEffect(() => {
    // Filter out videos that are already in documents (as study_documents)
    const documentKnowledgeIds = new Set(documents.map(doc => doc.knowledge_id));
    const uniqueVideos = videos.filter(video => !documentKnowledgeIds.has(video.id));

    const combined: CombinedItem[] = [
      ...documents.map((doc) => {
        const isVideo = doc.file_type === 'video/youtube' ||
                       (doc.knowledge_base as any)?.content_type === CONTENT_TYPES.YOUTUBE_LESSON;

        return {
          id: doc.id,
          type: (isVideo ? 'video' : 'document') as 'document' | 'video',
          name: doc.file_name,
          metadata: isVideo
            ? new Date(doc.created_at!).toLocaleDateString()
            : `${doc.num_pages ? `${doc.num_pages} pages • ` : ''}${new Date(doc.created_at!).toLocaleDateString()}`,
          data: doc,
          isBlocked: doc.knowledge_base?.is_active === false,
        };
      }),
      ...uniqueVideos.map((video) => ({
        id: video.id,
        type: 'video' as const,
        name: video.title,
        metadata: new Date(video.created_at).toLocaleDateString(),
        data: video,
        isBlocked: (video as any).is_active === false,
      })),
    ].sort((a, b) => {
      const aDate = 'created_at' in a.data ? new Date(a.data.created_at).getTime() : 0;
      const bDate = 'created_at' in b.data ? new Date(b.data.created_at).getTime() : 0;
      return bDate - aDate;
    });

    setCombinedItems(combined);
  }, [documents, videos]);

  useEffect(() => {
    if (user) {
      setLoading(true);
      Promise.all([fetchDocuments(), fetchVideos()]).finally(() => setLoading(false));
    }
  }, [user, fetchDocuments, fetchVideos]);

  // Auto-start content if accessed via URL parameter - REMOVED
  // This was causing documents to disappear when a URL ID pointed to test content
  // Users should click on content to interact with it from the main study page
  useEffect(() => {
    // Placeholder - we keep the effect for consistency but don't auto-start tests
    // This prevents the page from hiding the documents list when loaded with a URL ID
  }, [contentIdFromUrl]);

  // Test timer effect
  useEffect(() => {
    if (testTimeLeft !== null && testTimeLeft > 0 && isTakingTest && !showTestResults) {
      const timer = setTimeout(() => setTestTimeLeft(testTimeLeft - 1), 1000);
      return () => clearTimeout(timer);
    } else if (testTimeLeft === 0) {
      handleFinishTest();
    }
  }, [testTimeLeft, isTakingTest, showTestResults]);

  // Quiz timer effect
  useEffect(() => {
    if (quizTimeLeft !== null && quizTimeLeft > 0 && isTakingQuiz && !showQuizResults) {
      const timer = setTimeout(() => setQuizTimeLeft(quizTimeLeft - 1), 1000);
      return () => clearTimeout(timer);
    } else if (quizTimeLeft === 0) {
      handleFinishQuiz();
    }
  }, [quizTimeLeft, isTakingQuiz, showQuizResults]);

  const handleFinishTest = async () => {
    const finalAnswers = selectedTestAnswer
      ? { ...testAnswers, [testQuestions[currentTestQuestionIndex].id]: selectedTestAnswer }
      : testAnswers;

    let correctCount = 0;
    let totalPoints = 0;
    let earnedPoints = 0;

    testQuestions.forEach((q) => {
      totalPoints += q.points;
      if (finalAnswers[q.id] === q.correct_answer) {
        correctCount++;
        earnedPoints += q.points;
      }
    });

    setTestScore(correctCount);
    setTestAnswers(finalAnswers);
    setShowTestResults(true);
    setTestTimeLeft(null);

    if (user && currentTest) {
      const percentage = testQuestions.length > 0 ? (correctCount / testQuestions.length) * 100 : 0;

      // Record test attempt in the database
      const { data: testAttemptData } = await supabase.from('quiz_attempts').insert({
        quiz_id: currentTest.id,
        user_id: user.id,
        score: earnedPoints,
        max_score: totalPoints,
        percentage,
        answers: finalAnswers,
        completed_at: new Date().toISOString(),
      }).select().single();

      // Record detailed analytics using the quiz analytics hook
      await recordQuizAttempt(
        currentTest.id,
        currentTest.subject_id || null,
        earnedPoints,
        totalPoints,
        0, // time taken (not tracked in this flow)
        correctCount,
        testQuestions.length,
        testAttemptData?.id
      );

      // Trigger analytics update for this subject
      if (currentTest.subject_id) {
        await updateSubjectAnalytics(currentTest.subject_id, true);
      }
    }
  };

  const handleFinishQuiz = async () => {
    const finalAnswers = selectedQuizAnswer
      ? { ...quizAnswers, [quizQuestions[currentQuizQuestionIndex].id]: selectedQuizAnswer }
      : quizAnswers;

    let correctCount = 0;
    let totalPoints = 0;
    let earnedPoints = 0;

    quizQuestions.forEach((q) => {
      totalPoints += q.points;
      if (finalAnswers[q.id] === q.correct_answer) {
        correctCount++;
        earnedPoints += q.points;
      }
    });

    setQuizScore(correctCount);
    setQuizAnswers(finalAnswers);
    setShowQuizResults(true);
    setQuizTimeLeft(null);

    if (user && currentQuiz) {
      const percentage = quizQuestions.length > 0 ? (correctCount / quizQuestions.length) * 100 : 0;

      // Record quiz attempt in the database
      const { data: quizAttemptData } = await supabase.from('quiz_attempts').insert({
        quiz_id: currentQuiz.id,
        user_id: user.id,
        score: earnedPoints,
        max_score: totalPoints,
        percentage,
        answers: finalAnswers,
        completed_at: new Date().toISOString(),
      }).select().single();

      // Record detailed analytics using the quiz analytics hook
      await recordQuizAttempt(
        currentQuiz.id,
        currentQuiz.subject_id || null,
        earnedPoints,
        totalPoints,
        0, // time taken (not tracked in this flow)
        correctCount,
        quizQuestions.length,
        quizAttemptData?.id
      );

      // Trigger analytics update for this subject
      if (currentQuiz.subject_id) {
        await updateSubjectAnalytics(currentQuiz.subject_id, true);
      }
    }
  };

  const handleNextTestQuestion = () => {
    if (selectedTestAnswer) {
      setTestAnswers({ ...testAnswers, [testQuestions[currentTestQuestionIndex].id]: selectedTestAnswer });
    }

    if (currentTestQuestionIndex < testQuestions.length - 1) {
      setCurrentTestQuestionIndex(currentTestQuestionIndex + 1);
      setSelectedTestAnswer(testAnswers[testQuestions[currentTestQuestionIndex + 1]?.id] || '');
    } else {
      handleFinishTest();
    }
  };

  const handleNextQuizQuestion = () => {
    if (selectedQuizAnswer) {
      setQuizAnswers({ ...quizAnswers, [quizQuestions[currentQuizQuestionIndex].id]: selectedQuizAnswer });
    }

    if (currentQuizQuestionIndex < quizQuestions.length - 1) {
      setCurrentQuizQuestionIndex(currentQuizQuestionIndex + 1);
      setSelectedQuizAnswer(quizAnswers[quizQuestions[currentQuizQuestionIndex + 1]?.id] || '');
    } else {
      handleFinishQuiz();
    }
  };

  const fetchFlashcards = async (deckId: string) => {
    const { data: cardsData, error: cardsError } = await (supabase as any)
      .from('flashcards')
      .select('*')
      .eq('deck_id', deckId)
      .order('created_at', { ascending: true });

    if (cardsError) {
      console.error('Error fetching flashcards:', cardsError);
      return;
    }

    setFlashcards((cardsData as Flashcard[]) || []);
  };


  const handleFlashcardResult = async (correct: boolean) => {
    const card = flashcards[currentFlashcardIndex];
    if (!card) return;

    const timesReviewed = (card.times_reviewed ?? 0) + 1;
    const timesCorrect = correct ? (card.times_correct ?? 0) + 1 : (card.times_correct ?? 0);
    const isMastered = correct && timesCorrect >= 2;

    await (supabase as any)
      .from('flashcards')
      .update({
        times_reviewed: timesReviewed,
        times_correct: timesCorrect,
        is_mastered: isMastered,
        updated_at: new Date().toISOString(),
      })
      .eq('id', card.id);

    if (currentFlashcardIndex < flashcards.length - 1) {
      setCurrentFlashcardIndex(currentFlashcardIndex + 1);
      setIsFlashcardFlipped(false);
    } else {
      toast({
        title: 'Deck complete!',
        description: 'You\'ve reviewed all cards in this deck.',
      });

      if (user && currentFlashcardDeck) {
        await recordStudyActivity(user.id, 'flashcard_review', currentFlashcardDeck.subject_id || null);

        // Also record in quiz_performance_analytics for unified performance tracking
        const masteredCount = flashcards.filter(c => c.is_mastered).length;
        await recordQuizAttempt(
          null, // No quiz_id
          currentFlashcardDeck.subject_id || undefined,
          masteredCount, // score
          flashcards.length, // maxScore
          0, // time taken (not tracked here)
          masteredCount, // questionsCorrect
          flashcards.length, // totalQuestions
          undefined, // quizAttemptId
          currentFlashcardDeck.id, // knowledge_id (using deck id)
          'flashcard' // activityType
        );

        // Trigger analytics update for this subject
        if (currentFlashcardDeck.subject_id) {
          await updateSubjectAnalytics(currentFlashcardDeck.subject_id, true);
        }
      }

      setIsStudyingFlashcards(false);
      fetchFlashcardDecks();
    }
  };


  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleUploadSuccess = useCallback(async (uploadedItem: any) => {
    // Refresh both documents and videos
    await Promise.all([fetchDocuments(), fetchVideos()]);
    droppedFileRef.current = null;
    toast({
      title: 'Success',
      description: uploadedItem.file_name ? 'Document uploaded and processing started' : 'Video added and processing started',
    });
  }, [toast, fetchDocuments, fetchVideos]);

  const handleUploadSectionExpandedChange = useCallback((expanded: boolean) => {
    setIsUploadSectionExpanded(expanded);
    if (!expanded) {
      droppedFileRef.current = null;
    }
  }, []);

  const handleItemClick = (item: CombinedItem) => {
    if (item.type === 'document') {
      setSelectedDocumentId(item.id);
    } else if (item.type === 'video') {
      // If it's a study document (has UUID format and is in the documents list)
      // we navigate to DocumentView. Otherwise (legacy), we open the URL.
      if (documents.some(d => d.id === item.id)) {
        setSelectedDocumentId(item.id);
      } else {
        const video = item.data as VideoLesson;
        window.open(video.youtube_url, '_blank');
      }
    }
  };

  const handleItemRename = async (itemId: string, newName: string) => {
    if (!itemId || !newName.trim()) return;

    try {
      // Update the local state first for immediate UI feedback
      if (documents.some((d) => d.id === itemId)) {
        const doc = documents.find(d => d.id === itemId);
        setDocuments(
          documents.map((d) =>
            d.id === itemId ? { ...d, file_name: newName } : d
          )
        );

        // Update in Supabase
        const { error: docError } = await supabase
          .from('study_documents')
          .update({ file_name: newName.trim() })
          .eq('id', itemId);

        if (docError) throw docError;

        if (doc?.knowledge_id) {
          await supabase
            .from('knowledge_base')
            .update({ title: newName.trim() })
            .eq('id', doc.knowledge_id);
        }
      } else {
        setVideos(
          videos.map((v) =>
            v.id === itemId ? { ...v, title: newName } : v
          )
        );

        // Update in Supabase (videos are stored in knowledge_base directly)
        const { error: videoError } = await supabase
          .from('knowledge_base')
          .update({ title: newName.trim() })
          .eq('id', itemId);

        if (videoError) throw videoError;
      }

      toast({
        title: 'Renamed successfully',
        description: 'The item has been renamed.',
      });
    } catch (error) {
      console.error('Error renaming item:', error);
      toast({
        title: 'Error',
        description: 'Failed to rename the item. Please try again.',
        variant: 'destructive',
      });
      // Refresh to restore original state on error
      fetchDocuments();
      fetchVideos();
    }
  };

  const handleItemDelete = (itemId: string, type: 'document' | 'video') => {
    if (type === 'document') {
      setDocuments(prev => prev.filter(d => d.id !== itemId));
    } else {
      setVideos(prev => prev.filter(v => v.id !== itemId));
    }
  };

  const handleBackFromDocument = useCallback(() => {
    setSelectedDocumentId(null);
    // Ensure documents are refreshed when returning from document view
    fetchDocuments().catch((error) => {
      console.error('Error refreshing documents on return:', error);
    });
  }, [fetchDocuments]);

  // Auto-start timer when document is selected and set subject context
  useEffect(() => {
    if (!selectedDocumentId) {
      setAiContext({
        currentPage: 'study',
        location: 'Study Hub (Materials List)',
        activeDocument: null,
        activePaper: null,
        activeAnalytics: null
      });
    }
  }, [selectedDocumentId, setAiContext]);


  if (loading) {
    return (
      <AppLayout>
        <div className="w-full space-y-8 pb-12">
          {/* Page Header Skeleton */}
          <div className="space-y-4">
            <div>
              <Skeleton className="h-10 w-48 mb-2" />
              <Skeleton className="h-6 w-96 max-w-full" />
            </div>
          </div>

          {/* Upload Section Skeleton */}
          <Skeleton className="h-64 w-full rounded-2xl" />

          {/* Materials Section Skeleton */}
          <div className="space-y-6">
            <Skeleton className="h-8 w-64 mb-5" />
            <div className="space-y-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex flex-col gap-3 p-4 bg-card border border-border rounded-lg">
                  <div className="flex items-start gap-3 w-full">
                    <Skeleton className="w-10 h-10 rounded-lg flex-shrink-0" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-6 w-2/3" />
                      <Skeleton className="h-4 w-1/3" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </AppLayout>
    );
  }

  // Flashcard study mode
  if (isStudyingFlashcards && currentFlashcardDeck && flashcards.length > 0) {
    const currentCard = flashcards[currentFlashcardIndex];
    const progress = ((currentFlashcardIndex + 1) / flashcards.length) * 100;

    return (
      <AppLayout>
        <div className="space-y-6 pb-40">
          <div className="flex items-center justify-between">
            <Button variant="ghost" onClick={() => setIsStudyingFlashcards(false)}>
              <ChevronLeft className="w-4 h-4 mr-2" />
              Exit Study
            </Button>
            <div className="text-center">
              <h2 className="font-semibold">{currentFlashcardDeck.title}</h2>
              <p className="text-sm text-muted-foreground">
                Card {currentFlashcardIndex + 1} of {flashcards.length}
              </p>
            </div>
            <Button variant="outline" onClick={() => {
              setFlashcards([...flashcards].sort(() => Math.random() - 0.5));
              setCurrentFlashcardIndex(0);
              setIsFlashcardFlipped(false);
            }}>
              <Shuffle className="w-4 h-4" />
            </Button>
          </div>

          <Progress value={progress} className="h-2" />

          <motion.div
            className="perspective-1000"
            onClick={() => setIsFlashcardFlipped(!isFlashcardFlipped)}
          >
            <motion.div
              animate={{ rotateY: isFlashcardFlipped ? 180 : 0 }}
              transition={{ duration: 0.5 }}
              className="relative cursor-pointer"
              style={{ transformStyle: 'preserve-3d' }}
            >
              <Card className="min-h-[300px] flex items-center justify-center p-8">
                <CardContent className="text-center">
                  <motion.div
                    animate={{ opacity: isFlashcardFlipped ? 0 : 1 }}
                    className="absolute inset-0 flex items-center justify-center p-8"
                  >
                    <div>
                      <p className="text-xs text-muted-foreground mb-4">QUESTION</p>
                      <p className="text-xl font-medium">{currentCard.front}</p>
                      <p className="text-sm text-muted-foreground mt-6">
                        Tap to flip
                      </p>
                    </div>
                  </motion.div>
                  <motion.div
                    animate={{ opacity: isFlashcardFlipped ? 1 : 0 }}
                    className="absolute inset-0 flex items-center justify-center p-8"
                    style={{ transform: 'rotateY(180deg)' }}
                  >
                    <div>
                      <p className="text-xs text-muted-foreground mb-4">ANSWER</p>
                      <p className="text-xl font-medium">{currentCard.back}</p>
                    </div>
                  </motion.div>
                </CardContent>
              </Card>
            </motion.div>
          </motion.div>

          {isFlashcardFlipped && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex justify-center gap-4"
            >
              <Button
                size="lg"
                variant="outline"
                className="border-destructive text-destructive hover:bg-destructive/10"
                onClick={() => handleFlashcardResult(false)}
              >
                <XIcon className="w-5 h-5 mr-2" />
                Got it wrong
              </Button>
              <Button
                size="lg"
                className="bg-green-600 hover:bg-green-700"
                onClick={() => handleFlashcardResult(true)}
              >
                <Check className="w-5 h-5 mr-2" />
                Got it right
              </Button>
            </motion.div>
          )}
        </div>
      </AppLayout>
    );
  }

  // Quiz taking mode
  if (isTakingQuiz && currentQuiz) {
    if (quizQuestions.length === 0) {
      return (
        <AppLayout>
          <div className="text-center py-16">
            <Brain className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">No questions in this quiz</h2>
            <p className="text-muted-foreground mb-6">
              Add some questions before taking the quiz
            </p>
            <Button onClick={() => setIsTakingQuiz(false)}>
              Go Back
            </Button>
          </div>
        </AppLayout>
      );
    }

    if (showQuizResults) {
      const percentage = Math.round((quizScore / quizQuestions.length) * 100);

      return (
        <AppLayout>
        <div className="space-y-6 pb-40">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
            >
              <Card className="text-center py-8">
                <CardContent>
                  <Trophy className={`w-20 h-20 mx-auto mb-4 ${percentage >= 70 ? 'text-yellow-500' : 'text-muted-foreground'}`} />
                  <h2 className="text-2xl font-bold mb-2">Quiz Complete!</h2>
                  <p className="text-4xl font-bold text-primary mb-2">
                    {quizScore}/{quizQuestions.length}
                  </p>
                  <p className="text-xl text-muted-foreground mb-6">
                    {percentage}% Correct
                  </p>
                  <div className="flex justify-center gap-4">
                    <Button variant="outline" onClick={() => setIsTakingQuiz(false)}>
                      Back to Study
                    </Button>
                    <Button onClick={() => {
                      setCurrentQuizQuestionIndex(0);
                      setQuizAnswers({});
                      setSelectedQuizAnswer('');
                      setShowQuizResults(false);
                      setQuizScore(0);
                      setQuizTimeLeft(null);
                    }}>
                      Try Again
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            <Card>
              <CardHeader>
                <CardTitle>Review Answers</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {quizQuestions.map((q, index) => {
                  const userAnswer = quizAnswers[q.id];
                  const isCorrect = userAnswer === q.correct_answer;

                  return (
                    <div key={q.id} className="p-4 rounded-lg bg-secondary/50">
                      <div className="flex items-start gap-3">
                        {isCorrect ? (
                          <CheckCircle2 className="w-5 h-5 text-green-500 mt-1" />
                        ) : (
                          <XCircle className="w-5 h-5 text-destructive mt-1" />
                        )}
                        <div className="flex-1">
                          <p className="font-medium mb-2">
                            {index + 1}. {q.question}
                          </p>
                          <p className="text-sm">
                            Your answer: <span className={isCorrect ? 'text-green-600' : 'text-destructive'}>{userAnswer || 'Not answered'}</span>
                          </p>
                          {!isCorrect && (
                            <p className="text-sm text-green-600">
                              Correct answer: {q.correct_answer}
                            </p>
                          )}
                          {q.explanation && (
                            <p className="text-sm text-muted-foreground mt-2">
                              {q.explanation}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </div>
        </AppLayout>
      );
    }

    const currentQuestion = quizQuestions[currentQuizQuestionIndex];
    const progress = ((currentQuizQuestionIndex + 1) / quizQuestions.length) * 100;

    return (
      <AppLayout>
        <div className="space-y-6 pb-40">
          <div className="flex items-center justify-between">
            <Button variant="ghost" onClick={() => setIsTakingQuiz(false)}>
              <ChevronLeft className="w-4 h-4 mr-2" />
              Exit Quiz
            </Button>
            <div className="text-center">
              <h2 className="font-semibold">{currentQuiz.title}</h2>
              <p className="text-sm text-muted-foreground">
                Question {currentQuizQuestionIndex + 1} of {quizQuestions.length}
              </p>
            </div>
            {quizTimeLeft !== null && (
              <div className={`flex items-center gap-2 ${quizTimeLeft < 60 ? 'text-destructive' : 'text-muted-foreground'}`}>
                <Clock className="w-4 h-4" />
                <span className="font-mono">{formatTime(quizTimeLeft)}</span>
              </div>
            )}
          </div>

          <Progress value={progress} className="h-2" />

          <Card>
            <CardContent className="p-6">
              <h3 className="text-lg font-medium mb-6">{currentQuestion.question}</h3>

              <RadioGroup value={selectedQuizAnswer} onValueChange={setSelectedQuizAnswer}>
                {(Array.isArray(currentQuestion.options) ? currentQuestion.options : []).map((option: string, index: number) => (
                  <div
                    key={index}
                    className={`flex items-center space-x-3 p-4 rounded-lg border transition-colors cursor-pointer ${
                      selectedQuizAnswer === option
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:bg-secondary/50'
                    }`}
                    onClick={() => setSelectedQuizAnswer(option)}
                  >
                    <RadioGroupItem value={option} id={`quiz-option-${index}`} />
                    <Label htmlFor={`quiz-option-${index}`} className="flex-1 cursor-pointer">
                      {option}
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            </CardContent>
          </Card>

          <div className="flex justify-between pr-12 md:pr-16 lg:pr-20">
            <Button
              variant="outline"
              disabled={currentQuizQuestionIndex === 0}
              onClick={() => {
                if (selectedQuizAnswer) {
                  setQuizAnswers({ ...quizAnswers, [currentQuestion.id]: selectedQuizAnswer });
                }
                setCurrentQuizQuestionIndex(currentQuizQuestionIndex - 1);
                setSelectedQuizAnswer(quizAnswers[quizQuestions[currentQuizQuestionIndex - 1]?.id] || '');
              }}
            >
              Previous
            </Button>
            <Button onClick={handleNextQuizQuestion}>
              {currentQuizQuestionIndex === quizQuestions.length - 1 ? 'Finish Quiz' : 'Next Question'}
            </Button>
          </div>
        </div>
      </AppLayout>
    );
  }

  // Test taking mode
  if (isTakingTest && currentTest) {
    if (testQuestions.length === 0) {
      return (
        <AppLayout>
          <div className="text-center py-16">
            <BookOpen className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">No questions in this test</h2>
            <p className="text-muted-foreground mb-6">
              The test has no questions to display
            </p>
            <Button onClick={() => setIsTakingTest(false)}>
              Go Back
            </Button>
          </div>
        </AppLayout>
      );
    }

    if (showTestResults) {
      const percentage = Math.round((testScore / testQuestions.length) * 100);

      return (
        <AppLayout>
        <div className="space-y-6 pb-40">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
            >
              <Card className="text-center py-8">
                <CardContent>
                  <Trophy className={`w-20 h-20 mx-auto mb-4 ${percentage >= 70 ? 'text-yellow-500' : 'text-muted-foreground'}`} />
                  <h2 className="text-2xl font-bold mb-2">Test Complete!</h2>
                  <p className="text-4xl font-bold text-primary mb-2">
                    {testScore}/{testQuestions.length}
                  </p>
                  <p className="text-xl text-muted-foreground mb-6">
                    {percentage}% Correct
                  </p>
                  <div className="flex justify-center gap-4">
                    <Button variant="outline" onClick={() => setIsTakingTest(false)}>
                      Back to Study
                    </Button>
                    <Button onClick={() => {
                      setCurrentTestQuestionIndex(0);
                      setTestAnswers({});
                      setSelectedTestAnswer('');
                      setShowTestResults(false);
                      setTestScore(0);
                      setTestTimeLeft(null);
                    }}>
                      Try Again
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            <Card>
              <CardHeader>
                <CardTitle>Review Answers</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {testQuestions.map((q, index) => {
                  const userAnswer = testAnswers[q.id];
                  const isCorrect = userAnswer === q.correct_answer;

                  return (
                    <div key={q.id} className="p-4 rounded-lg bg-secondary/50">
                      <div className="flex items-start gap-3">
                        {isCorrect ? (
                          <CheckCircle2 className="w-5 h-5 text-green-500 mt-1" />
                        ) : (
                          <XCircle className="w-5 h-5 text-destructive mt-1" />
                        )}
                        <div className="flex-1">
                          <p className="font-medium mb-2">
                            {index + 1}. {q.question}
                          </p>
                          <p className="text-sm">
                            Your answer: <span className={isCorrect ? 'text-green-600' : 'text-destructive'}>{userAnswer || 'Not answered'}</span>
                          </p>
                          {!isCorrect && (
                            <p className="text-sm text-green-600">
                              Correct answer: {q.correct_answer}
                            </p>
                          )}
                          {q.explanation && (
                            <p className="text-sm text-muted-foreground mt-2">
                              {q.explanation}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </div>
        </AppLayout>
      );
    }

    const currentQuestion = testQuestions[currentTestQuestionIndex];
    const progress = ((currentTestQuestionIndex + 1) / testQuestions.length) * 100;

    return (
      <AppLayout>
        <div className="space-y-6 pb-40">
          <div className="flex items-center justify-between">
            <Button variant="ghost" onClick={() => setIsTakingTest(false)}>
              <ChevronLeft className="w-4 h-4 mr-2" />
              Exit Test
            </Button>
            <div className="text-center">
              <h2 className="font-semibold">{currentTest.title}</h2>
              <p className="text-sm text-muted-foreground">
                Question {currentTestQuestionIndex + 1} of {testQuestions.length}
              </p>
            </div>
            {testTimeLeft !== null && (
              <div className={`flex items-center gap-2 ${testTimeLeft < 60 ? 'text-destructive' : 'text-muted-foreground'}`}>
                <Clock className="w-4 h-4" />
                <span className="font-mono">{formatTime(testTimeLeft)}</span>
              </div>
            )}
          </div>

          <Progress value={progress} className="h-2" />

          <Card>
            <CardContent className="p-6">
              <h3 className="text-lg font-medium mb-6">{currentQuestion.question}</h3>

              <RadioGroup value={selectedTestAnswer} onValueChange={setSelectedTestAnswer}>
                {(Array.isArray(currentQuestion.options) ? currentQuestion.options : []).map((option: string, index: number) => (
                  <div
                    key={index}
                    className={`flex items-center space-x-3 p-4 rounded-lg border transition-colors cursor-pointer ${
                      selectedTestAnswer === option
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:bg-secondary/50'
                    }`}
                    onClick={() => setSelectedTestAnswer(option)}
                  >
                    <RadioGroupItem value={option} id={`test-option-${index}`} />
                    <Label htmlFor={`test-option-${index}`} className="flex-1 cursor-pointer">
                      {option}
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            </CardContent>
          </Card>

          <div className="flex justify-between pr-12 md:pr-16 lg:pr-20">
            <Button
              variant="outline"
              disabled={currentTestQuestionIndex === 0}
              onClick={() => {
                if (selectedTestAnswer) {
                  setTestAnswers({ ...testAnswers, [currentQuestion.id]: selectedTestAnswer });
                }
                setCurrentTestQuestionIndex(currentTestQuestionIndex - 1);
                setSelectedTestAnswer(testAnswers[testQuestions[currentTestQuestionIndex - 1]?.id] || '');
              }}
            >
              Previous
            </Button>
            <Button onClick={handleNextTestQuestion}>
              {currentTestQuestionIndex === testQuestions.length - 1 ? 'Finish Test' : 'Next Question'}
            </Button>
          </div>
        </div>
      </AppLayout>
    );
  }

  // Document view
  if (selectedDocumentId) {
    return <DocumentView documentId={selectedDocumentId} onBack={handleBackFromDocument} />;
  }

  // Animation variants for container and items
  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.08,
        delayChildren: shouldAnimate ? 0.3 : 0,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 10 },
    show: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.5, ease: 'easeOut' as const },
    },
  };

  // Main Study page
  return (
    <AppLayout>
      <div className="w-full space-y-8 pb-12">
        {/* Page Header */}
        <motion.div
          className="space-y-4"
          initial={shouldAnimate ? { opacity: 0, y: -20 } : { opacity: 1, y: 0 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        >
          <div>
            <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold text-foreground mb-2">Study Hub</h1>
            <p className="text-sm md:text-base lg:text-lg text-muted-foreground max-w-2xl">
              Upload documents and videos to organize your study materials
            </p>
          </div>

          {/* Document Limit Indicator for Free Tier */}
          {tier === 'free' && (
            <motion.div
              initial={shouldAnimate ? { opacity: 0 } : { opacity: 1 }}
              animate={{ opacity: 1 }}
              className="mt-6 p-3 md:p-5 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 rounded-xl flex items-start gap-3"
            >
              <Lock className="w-4 h-4 md:w-6 md:h-6 text-amber-600 dark:text-amber-500 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-xs md:text-base font-semibold text-amber-900 dark:text-amber-200">
                  Documents: {documents.length} of {limits.maxDocuments}
                </p>
                <p className="text-[10px] md:text-sm text-amber-800 dark:text-amber-300 mt-0.5">
                  Upgrade to Pro for unlimited documents and other pro features
                </p>
              </div>
            </motion.div>
          )}
        </motion.div>

        {/* Upload Section */}
        <motion.div
          initial={shouldAnimate ? { opacity: 0, y: 10 } : { opacity: 1, y: 0 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: shouldAnimate ? 0.15 : 0, ease: 'easeOut' }}
        >
          <CombinedUploadSection
            onUploadSuccess={handleUploadSuccess}
            onAutoNavigate={(docId) => setSelectedDocumentId(docId)}
          />
        </motion.div>

        {/* Materials Section */}
        {combinedItems.length === 0 ? (
          <motion.div
            initial={shouldAnimate ? { opacity: 0, y: 10 } : { opacity: 1, y: 0 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: shouldAnimate ? 0.3 : 0, ease: 'easeOut' }}
            className="flex items-center justify-center border-2 border-dashed rounded-2xl border-border py-24 px-6 bg-secondary/20"
          >
            <div className="text-center max-w-md">
              <motion.div
            initial={shouldAnimate ? { scale: 0.8, opacity: 0 } : { scale: 1, opacity: 1 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.5, delay: shouldAnimate ? 0.35 : 0 }}
          >
            <Upload className="w-16 h-16 md:w-20 md:h-20 text-muted-foreground mx-auto mb-4 opacity-40" />
          </motion.div>
          <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-3">
            No study materials yet
          </h2>
          <p className="text-base md:text-lg text-muted-foreground">
            Upload PDFs, documents, or add YouTube videos to start creating lessons and quizzes
          </p>
            </div>
          </motion.div>
        ) : (
          <motion.div
            className="space-y-6"
            variants={containerVariants}
            initial={shouldAnimate ? 'hidden' : 'show'}
            animate="show"
          >
            <div>
              <h2 className="text-lg md:text-2xl font-bold text-foreground mb-5">Your Study Materials</h2>
              {/* Materials List - Full Width Vertical Layout */}
              <div className="space-y-3 md:space-y-4">
                {combinedItems.map((item, index) => (
                  <motion.div
                    key={item.id}
                    variants={itemVariants}
                    initial={shouldAnimate ? 'hidden' : 'show'}
                    animate="show"
                  >
                    <RenameableItemRow
                      id={item.id}
                      name={item.name}
                      type={item.type}
                      metadata={item.metadata}
                      index={index}
                      shouldAnimate={false}
                      onClick={() => handleItemClick(item)}
                      onRename={(newName) => handleItemRename(item.id, newName)}
                      onDelete={() => handleItemDelete(item.id, item.type)}
                    />
                  </motion.div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </AppLayout>
  );
};

export default Study;
