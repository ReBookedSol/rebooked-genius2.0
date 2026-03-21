import React, { useState, useEffect, useCallback } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Plus, Sparkles, Loader2, Play, CheckCircle2, XCircle, Trophy, ChevronLeft, ChevronRight, Clock, Lock, Check, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import GraphRenderer from './GraphRenderer';
import { useIsMobile } from '@/hooks/use-is-mobile';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useAIContext } from '@/contexts/AIContext';
import { supabase } from '@/integrations/supabase/client';
import { useSubscription } from '@/hooks/useSubscription';
import { useQuizAnalytics } from '@/hooks/useQuizAnalytics';
import { useSubjectAnalytics } from '@/hooks/useSubjectAnalytics';
import { extractMarkdownSections } from '@/lib/markdownUtils';
import { UpgradeModal } from '@/components/subscription/UpgradeModal';

interface StudyDocument {
  id: string;
  file_name: string;
  processed_content: string | null;
  subject_id?: string | null;
}

interface ExamQuestion {
  id: number;
  question: string;
  question_type: 'multipleChoice' | 'fillInBlank' | 'multipleAnswer' | 'trueFalse' | 'dropdown' | 'matching' | 'graph';
  options?: string[];
  correct_answer?: string;
  correct_answers?: string[];
  matchingPairs?: { left: string; right: string }[];
  graphData?: any;
  explanation: string;
  points: number;
  difficulty: 'easy' | 'medium' | 'hard';
}

interface Exam {
  id: string;
  title: string;
  questions: ExamQuestion[];
  totalPoints: number;
  estimatedMinutes: number;
  created_at: string;
  best_score?: number;
}

interface DocumentExamsViewProps {
  document: StudyDocument;
  lessonContent?: string;
  onGeneratingChange?: (isGenerating: boolean) => void;
}

const DocumentExamsView: React.FC<DocumentExamsViewProps> = ({ document, lessonContent, onGeneratingChange }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { tier } = useSubscription();
  const { context: aiContext, setAiContext } = useAIContext();
  const { recordQuizAttempt } = useQuizAnalytics();
  const { updateSubjectAnalytics } = useSubjectAnalytics();

  const [exams, setExams] = useState<Exam[]>([]);
  const [loading, setLoading] = useState(true);
  const [questionCount, setQuestionCount] = useState(20);
  const [selectedLessons, setSelectedLessons] = useState<string[]>([]);
  const [selectedQuestionTypes, setSelectedQuestionTypes] = useState<string[]>(['multipleChoice', 'fillInBlank', 'multipleAnswer', 'trueFalse']);
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);

  // Use global generation state
  const isGenerating = aiContext.generationState?.isGenerating && aiContext.generationState?.generationType === 'exam' && aiContext.generationState?.documentId === document.id ? true : false;

  // Exam taking state
  const [activeExam, setActiveExam] = useState<Exam | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [skippedQuestions, setSkippedQuestions] = useState<number[]>([]);
  const [answers, setAnswers] = useState<Record<number, string | string[] | Record<string, string>>>({});
  const [showResults, setShowResults] = useState(false);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch saved exams
  const fetchExams = useCallback(async () => {
    if (!user || !document) return;
    setLoading(true);
    try {
      // First try the new study_exams table
      const { data: studyExamsData, error: studyExamsError } = await supabase
        .from('study_exams' as any)
        .select('*')
        .eq('user_id', user.id)
        .eq('document_id', document.id)
        .order('created_at', { ascending: false });

      let formatted: Exam[] = [];

      if (!studyExamsError && studyExamsData && studyExamsData.length > 0) {
        formatted = (studyExamsData as any[]).map((item: any) => {
          let questions = [];
          if (Array.isArray(item.questions)) {
            questions = item.questions;
          } else if (typeof item.questions === 'string') {
            try { questions = JSON.parse(item.questions); } catch {}
          }
          if (!Array.isArray(questions)) questions = [];
          
          return {
            id: item.id,
            title: item.title,
            questions,
            totalPoints: item.total_points || 0,
            estimatedMinutes: item.estimated_minutes || 30,
            created_at: item.created_at,
            best_score: item.best_score ? Number(item.best_score) : undefined,
          };
        }).filter((e: Exam) => e.questions.length > 0);
      } else {
        // Fallback to legacy knowledge_base exams
        const { data, error } = await supabase
          .from('knowledge_base')
          .select('id, title, content, created_at')
          .eq('user_id', user.id)
          .eq('content_type', 'exam')
          .ilike('title', `%${document.file_name}%`)
          .order('created_at', { ascending: false });

        if (error) throw error;

        formatted = (data || []).map((item: any) => {
          let parsed: any = {};
          try { parsed = JSON.parse(item.content); } catch {}
          return {
            id: item.id,
            title: item.title,
            questions: parsed.questions || [],
            totalPoints: parsed.totalPoints || 0,
            estimatedMinutes: parsed.estimatedMinutes || 30,
            created_at: item.created_at,
          };
        }).filter((e: Exam) => e.questions.length > 0);

        // Fetch best scores for legacy exams
        const examIds = formatted.map(e => e.id);
        if (examIds.length > 0) {
          const { data: perfData } = await supabase
            .from('quiz_performance_analytics')
            .select('knowledge_id, percentage')
            .in('knowledge_id', examIds)
            .eq('user_id', user.id);

          if (perfData) {
            const bestScores: Record<string, number> = {};
            perfData.forEach((p: any) => {
              if (p.knowledge_id && (!bestScores[p.knowledge_id] || p.percentage > bestScores[p.knowledge_id])) {
                bestScores[p.knowledge_id] = p.percentage;
              }
            });
            formatted = formatted.map(e => ({ ...e, best_score: bestScores[e.id] }));
          }
        }
      }

      setExams(formatted);
    } catch (error) {
      console.error('Error fetching exams:', error);
    } finally {
      setLoading(false);
    }
  }, [user, document]);

  useEffect(() => { fetchExams(); }, [fetchExams]);

  // Timer
  useEffect(() => {
    let timerId: NodeJS.Timeout;
    if (timeLeft !== null && timeLeft > 0 && activeExam && !showResults) {
      timerId = setTimeout(() => setTimeLeft(timeLeft - 1), 1000);
    }
    return () => {
      if (timerId) clearTimeout(timerId);
    };
  }, [timeLeft, activeExam, showResults]);

  // Update AI context when question changes
  useEffect(() => {
    if (activeExam && timeLeft !== null && timeLeft > 0 && !showResults) {
      const q = activeExam.questions[currentIndex];
      if (q) {
        setAiContext({
          activeExam: {
            id: activeExam.id,
            question: q.question, // Changed from q.text to q.question based on ExamQuestion interface
            options: q.options,
            index: currentIndex,
            total: activeExam.questions.length
          }
        });
      }
    } else {
      setAiContext({ activeExam: null });
    }
  }, [activeExam, currentIndex, timeLeft, showResults, setAiContext]);

  const handleGenerate = async () => {
    if (!document || !user) return;

    if (tier === 'free') {
      setIsUpgradeModalOpen(true);
      return;
    }


    let contentToUse = lessonContent || document.processed_content;
    if (!contentToUse || contentToUse.trim().length === 0) {
      toast({ title: 'No content', description: 'Generate lessons first.', variant: 'destructive' });
      return;
    }

    // Filter content based on selected lessons if any
    if (selectedLessons.length > 0) {
      const allSections = extractMarkdownSections(contentToUse);
      const filteredSections = allSections.filter(s => selectedLessons.includes(s.id));
      if (filteredSections.length > 0) {
        contentToUse = filteredSections.map(s => `## ${s.title}\n${s.content}`).join('\n\n');
      }
    }

    // Set global generation state
    setAiContext({
      generationState: {
        isGenerating: true,
        generationType: 'exam',
        documentId: document.id,
      }
    });
    onGeneratingChange?.(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-exam', {
        body: {
          content: contentToUse,
          questionCount,
          questionTypes: selectedQuestionTypes,
          title: `${document.file_name} - Exam`
        },
      });

      if (error) throw error;
      if (!data?.questions) throw new Error('No questions generated');

      // Save to study_exams table
      await supabase.from('study_exams' as any).insert({
        user_id: user.id,
        document_id: document.id,
        subject_id: document.subject_id || null,
        title: `${document.file_name} - Exam`,
        questions: data.questions,
        total_points: data.totalPoints || data.questions.reduce((sum: number, q: any) => sum + (q.points || 1), 0),
        estimated_minutes: data.estimatedMinutes || 30,
      });

      toast({ title: 'Exam created!', description: `${data.questions.length} questions generated.` });
      fetchExams();
    } catch (error: any) {
      console.error('Error generating exam:', error);
      toast({ title: 'Error', description: error.message || 'Failed to generate exam', variant: 'destructive' });
    } finally {
      // Clear global generation state
      setAiContext({
        generationState: {
          isGenerating: false,
          generationType: undefined,
          documentId: undefined,
        }
      });
      onGeneratingChange?.(false);
    }
  };

  const startExam = (exam: Exam) => {
    setActiveExam(exam);
    setCurrentIndex(0);
    setAnswers({});
    setSkippedQuestions([]);
    setShowResults(false);
    setTimeLeft(exam.estimatedMinutes * 60);
  };

  const handleFinish = async () => {
    if (!activeExam || !user || isSubmitting) return;
    setIsSubmitting(true);

    // Check for unanswered questions
    const unansweredCount = activeExam.questions.filter(q => !answers[q.id]).length;
    if (unansweredCount > 0) {
      const confirm = window.confirm(`You have ${unansweredCount} unanswered questions. Are you sure you want to finish?`);
      if (!confirm) return;
    }

    setShowResults(true);
    let earned = 0;
    activeExam.questions.forEach((q) => {
      const userAnswer = answers[q.id];
      if (q.question_type === 'multipleAnswer') {
        const correct = q.correct_answers || [];
        const selected = Array.isArray(userAnswer) ? userAnswer : [];
        if (correct.length === selected.length && correct.every(a => selected.includes(a))) {
          earned += q.points;
        }
      } else {
        const correct = q.correct_answer || '';
        const given = typeof userAnswer === 'string' ? userAnswer : '';
        if (given.toLowerCase().trim() === correct.toLowerCase().trim()) {
          earned += q.points;
        }
      }
    });

    // Track in analytics
    const percentage = activeExam.totalPoints > 0 ? (earned / activeExam.totalPoints) * 100 : 0;

    // Record detailed analytics using the quiz analytics hook
    let correctCount = 0;
    activeExam.questions.forEach((q) => {
      if (isCorrect(q)) correctCount++;
    });

    try {
      // Record attempt in quiz_attempts table for detailed tracking
      // Note: Don't pass study_exams ID as knowledge_id since it has FK constraint to knowledge_base
      const { data: attemptData } = await supabase.from('quiz_attempts').insert({
        user_id: user.id,
        quiz_id: null,
        knowledge_id: null,
        score: earned,
        max_score: activeExam.totalPoints,
        percentage,
        answers: answers,
        completed_at: new Date().toISOString(),
      }).select().single();

      await recordQuizAttempt(
        null, // No quiz_id
        document.subject_id || null,
        earned,
        activeExam.totalPoints,
        activeExam.estimatedMinutes * 60 - (timeLeft || 0),
        correctCount,
        activeExam.questions.length,
        attemptData?.id,
        undefined, // Don't pass exam ID as knowledge_id - it's not a knowledge_base ID
        'exam' // activityType
      );

      // Update best_score on study_exams table
      if (document.subject_id) {
        await updateSubjectAnalytics(document.subject_id, true);
      }
      
      // Update best score in study_exams
      try {
        const { data: currentExam } = await (supabase as any)
          .from('study_exams')
          .select('best_score')
          .eq('id', activeExam.id)
          .single();
        
        if (currentExam && (!currentExam.best_score || percentage > Number(currentExam.best_score))) {
          await (supabase as any)
            .from('study_exams')
            .update({ best_score: percentage })
            .eq('id', activeExam.id);
        }
      } catch {
        // May be a legacy knowledge_base exam
      }
    } catch (error) {
      console.warn('Error recording detailed analytics:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getScore = () => {
    if (!activeExam) return { earned: 0, total: 0, percentage: 0 };
    let earned = 0;
    activeExam.questions.forEach((q) => {
      const userAnswer = answers[q.id];
      if (q.question_type === 'multipleAnswer') {
        const correct = q.correct_answers || [];
        const selected = Array.isArray(userAnswer) ? userAnswer : [];
        if (correct.length === selected.length && correct.every(a => selected.includes(a))) earned += q.points;
      } else {
        const correct = q.correct_answer || '';
        const given = typeof userAnswer === 'string' ? userAnswer : '';
        if (given.toLowerCase().trim() === correct.toLowerCase().trim()) earned += q.points;
      }
    });
    return { earned, total: activeExam.totalPoints, percentage: activeExam.totalPoints > 0 ? Math.round((earned / activeExam.totalPoints) * 100) : 0 };
  };

  const isCorrect = (q: ExamQuestion) => {
    const userAnswer = answers[q.id];
    if (q.question_type === 'multipleAnswer') {
      const correct = q.correct_answers || [];
      const selected = Array.isArray(userAnswer) ? userAnswer : [];
      return correct.length === selected.length && correct.every(a => selected.includes(a));
    }
    if (q.question_type === 'matching') {
      const userPairs = userAnswer as Record<string, string> || {};
      const correctPairs = q.matchingPairs || [];
      return correctPairs.every(p => userPairs[p.left] === p.right);
    }
    if (q.question_type === 'fillInBlank') {
      const correctAnswers = q.correct_answers || [q.correct_answer || ''];
      const given = typeof userAnswer === 'string' ? userAnswer : '';
      return correctAnswers.some(ans => ans.toLowerCase().trim() === given.toLowerCase().trim());
    }
    const correct = q.correct_answer || '';
    const given = typeof userAnswer === 'string' ? userAnswer : '';
    return given.toLowerCase().trim() === correct.toLowerCase().trim();
  };

  // Taking an exam
  if (activeExam) {
    const q = activeExam.questions[currentIndex];
    const score = getScore();

    if (showResults) {
      return (
        <ScrollArea className="h-full">
          <div className="p-6 space-y-6 max-w-3xl mx-auto">
            <div className="text-center space-y-3">
              <Trophy className="w-16 h-16 text-primary mx-auto" />
              <h2 className="text-2xl font-bold text-foreground">Exam Complete!</h2>
              <p className="text-4xl font-bold text-primary">{score.percentage}%</p>
              <p className="text-muted-foreground">{score.earned} / {score.total} points</p>
            </div>

            <div className="space-y-4">
              {activeExam.questions.map((q, i) => (
                <Card key={q.id} className={`border-l-4 ${isCorrect(q) ? 'border-l-green-500' : 'border-l-destructive'}`}>
                  <CardContent className="p-4">
                    <div className="flex items-start gap-2">
                      {isCorrect(q) ? <CheckCircle2 className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" /> : <XCircle className="w-5 h-5 text-destructive mt-0.5 flex-shrink-0" />}
                      <div className="flex-1">
                        <p className="font-medium text-foreground text-sm">Q{i + 1}. {q.question}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Your answer: {Array.isArray(answers[q.id]) ? (answers[q.id] as string[]).join(', ') : (answers[q.id] as string || 'No answer')}
                        </p>
                        <p className="text-xs text-green-600 mt-1">
                          Correct: {q.correct_answers ? q.correct_answers.join(', ') : q.correct_answer}
                        </p>
                        {q.explanation && <p className="text-xs text-muted-foreground mt-2 italic">{q.explanation}</p>}
                      </div>
                      <Badge variant="outline" className="text-xs">{q.points}pts</Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            <Button onClick={() => { setActiveExam(null); setShowResults(false); }} className="w-full">
              Back to Exams
            </Button>
          </div>
        </ScrollArea>
      );
    }

    return (
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border bg-card">
          <Button variant="ghost" size="sm" onClick={() => setActiveExam(null)}>
            <ChevronLeft className="w-4 h-4 mr-1" /> Exit
          </Button>
          <div className="flex items-center gap-3">
            <Badge variant="outline" className="text-xs">
              {currentIndex + 1}/{activeExam.questions.length}
            </Badge>
            {timeLeft !== null && (
              <Badge variant={timeLeft < 60 ? "destructive" : "secondary"} className="text-xs gap-1">
                <Clock className="w-3 h-3" />
                {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
              </Badge>
            )}
          </div>
        </div>

        <Progress value={((currentIndex + 1) / activeExam.questions.length) * 100} className="h-1" />

        {/* Question */}
        <ScrollArea className="flex-1">
          <div className="p-6 max-w-2xl mx-auto space-y-6 pb-40">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Badge variant="outline">{q.difficulty}</Badge>
                <Badge variant="secondary">{q.points} pts</Badge>
                <Badge variant="outline">{q.question_type === 'multipleChoice' ? 'MCQ' : q.question_type === 'fillInBlank' ? 'Fill in' : q.question_type === 'multipleAnswer' ? 'Multi-select' : q.question_type === 'trueFalse' ? 'True/False' : q.question_type === 'matching' ? 'Matching' : q.question_type === 'dropdown' ? 'Dropdown' : q.question_type}</Badge>
              </div>
              <div className="text-base sm:text-2xl md:text-3xl font-bold text-foreground leading-relaxed">
                <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                  {q.question}
                </ReactMarkdown>
              </div>
            </div>

            {/* Answer input based on type */}
            {q.question_type === 'multipleChoice' && q.options && (
              <RadioGroup
                value={typeof answers[q.id] === 'string' ? answers[q.id] as string : ''}
                onValueChange={(val) => setAnswers({ ...answers, [q.id]: val })}
                className="space-y-2 sm:space-y-3 md:space-y-4"
              >
                {q.options.map((opt, i) => (
                  <div key={i} className="flex items-center space-x-2 sm:space-x-4 p-3 sm:p-5 md:p-6 rounded-lg border-2 transition-all cursor-pointer hover:border-primary/50 hover:bg-secondary/30 border-border" onClick={() => setAnswers({ ...answers, [q.id]: opt })}>
                    <RadioGroupItem value={opt} id={`opt-${q.id}-${i}`} className="w-4 h-4 sm:w-6 sm:h-6" />
                    <Label htmlFor={`opt-${q.id}-${i}`} className="flex-1 cursor-pointer text-xs sm:text-lg md:text-base">
                      <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                        {opt}
                      </ReactMarkdown>
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            )}

            {q.question_type === 'trueFalse' && (
              <RadioGroup
                value={typeof answers[q.id] === 'string' ? answers[q.id] as string : ''}
                onValueChange={(val) => setAnswers({ ...answers, [q.id]: val })}
                className="space-y-2 sm:space-y-3 md:space-y-4"
              >
                {['True', 'False'].map((opt, i) => (
                  <div key={i} className="flex items-center space-x-2 sm:space-x-4 p-3 sm:p-5 md:p-6 rounded-lg border-2 transition-all cursor-pointer hover:border-primary/50 hover:bg-secondary/30 border-border" onClick={() => setAnswers({ ...answers, [q.id]: opt })}>
                    <RadioGroupItem value={opt} id={`opt-${q.id}-${i}`} className="w-4 h-4 sm:w-6 sm:h-6" />
                    <Label htmlFor={`opt-${q.id}-${i}`} className="flex-1 cursor-pointer text-xs sm:text-lg md:text-base">{opt}</Label>
                  </div>
                ))}
              </RadioGroup>
            )}

            {q.question_type === 'multipleAnswer' && q.options && (
              <div className="space-y-3">
                <p className="text-xs sm:text-sm text-muted-foreground">Select all that apply</p>
                {q.options.map((opt, i) => {
                  const selected = Array.isArray(answers[q.id]) ? answers[q.id] as string[] : [];
                  return (
                    <div key={i} className="flex items-center space-x-2 sm:space-x-4 p-3 sm:p-5 md:p-6 rounded-lg border-2 transition-all cursor-pointer hover:border-primary/50 hover:bg-secondary/30 border-border" onClick={() => {
                      const newSelected = selected.includes(opt) ? selected.filter(s => s !== opt) : [...selected, opt];
                      setAnswers({ ...answers, [q.id]: newSelected });
                    }}>
                      <Checkbox
                        id={`check-${q.id}-${i}`}
                        checked={selected.includes(opt)}
                        onCheckedChange={(checked) => {
                          const newSelected = checked ? [...selected, opt] : selected.filter(s => s !== opt);
                          setAnswers({ ...answers, [q.id]: newSelected });
                        }}
                        className="w-4 h-4 sm:w-6 sm:h-6"
                      />
                      <Label htmlFor={`check-${q.id}-${i}`} className="flex-1 cursor-pointer text-xs sm:text-lg md:text-base">{opt}</Label>
                    </div>
                  );
                })}
              </div>
            )}

            {q.question_type === 'dropdown' && q.options && (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground italic">Select the best option to complete the statement:</p>
                <div className="flex flex-wrap items-center gap-2 text-foreground">
                  {q.question.split('[___]').map((part, i, arr) => (
                    <React.Fragment key={i}>
                      <span>{part}</span>
                      {i < arr.length - 1 && (
                        <Select
                          value={typeof answers[q.id] === 'string' ? answers[q.id] as string : ''}
                          onValueChange={(val) => setAnswers({ ...answers, [q.id]: val })}
                        >
                          <SelectTrigger className="w-[180px] h-8">
                            <SelectValue placeholder="Select..." />
                          </SelectTrigger>
                          <SelectContent>
                            {q.options?.map((opt, idx) => (
                              <SelectItem key={idx} value={opt}>{opt}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </React.Fragment>
                  ))}
                </div>
              </div>
            )}

            {q.question_type === 'matching' && q.matchingPairs && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4 font-semibold text-xs text-muted-foreground px-2">
                  <span>Column A</span>
                  <span>Column B</span>
                </div>
                {q.matchingPairs.map((pair, i) => {
                  const userAnswers = (answers[q.id] as Record<string, string>) || {};
                  return (
                    <div key={i} className="grid grid-cols-2 gap-4 items-center">
                      <div className="p-2 bg-secondary/30 rounded border text-sm">{pair.left}</div>
                      <Select
                        value={userAnswers[pair.left] || ''}
                        onValueChange={(val) => setAnswers({
                          ...answers,
                          [q.id]: { ...userAnswers, [pair.left]: val }
                        })}
                      >
                        <SelectTrigger className="h-9">
                          <SelectValue placeholder="Match..." />
                        </SelectTrigger>
                        <SelectContent>
                          {q.matchingPairs?.map((p, idx) => (
                            <SelectItem key={idx} value={p.right}>{p.right}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  );
                })}
              </div>
            )}

            {q.question_type === 'graph' && q.graphData && (
              <div className="space-y-6">
                <GraphRenderer data={q.graphData} />
                <Input
                  placeholder="Type your answer based on the graph..."
                  value={typeof answers[q.id] === 'string' ? answers[q.id] as string : ''}
                  onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.value })}
                  className="text-sm sm:text-base md:text-lg p-3 sm:p-4 md:p-5 h-auto"
                />
              </div>
            )}

            {q.question_type === 'fillInBlank' && (
              <div className="space-y-2">
                <Input
                  placeholder="Type your answer..."
                  value={typeof answers[q.id] === 'string' ? answers[q.id] as string : ''}
                  onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.value })}
                  className="text-sm sm:text-base md:text-lg p-3 sm:p-4 md:p-5 h-auto"
                />
                {q.correct_answers && q.correct_answers.length > 1 && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Info className="w-3 h-3" />
                    Multiple accepted answers — separate with a comma (e.g. answer1, answer2)
                  </p>
                )}
              </div>
            )}

            {/* Fallback for sourceBased or shortAnswer types */}
            {(!['multipleChoice', 'trueFalse', 'multipleAnswer', 'dropdown', 'matching', 'graph', 'fillInBlank'].includes(q.question_type)) && (
              <div className="space-y-2 pt-2">
                <p className="text-sm sm:text-base font-medium text-muted-foreground mb-2">Write your answer below:</p>
                <textarea
                  className="w-full min-h-[120px] p-3 sm:p-4 md:p-5 rounded-lg border-2 border-border focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all resize-y text-sm sm:text-base md:text-lg bg-background"
                  placeholder="Type your answer here..."
                  value={typeof answers[q.id] === 'string' ? answers[q.id] as string : ''}
                  onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.value })}
                />
              </div>
            )}

          </div>
        </ScrollArea>

        {/* Navigation */}
        <div className="flex items-center justify-between p-4 border-t border-border bg-card pr-12 md:pr-16 lg:pr-20">
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={currentIndex === 0}
              onClick={() => setCurrentIndex(currentIndex - 1)}
            >
              <ChevronLeft className="w-4 h-4 mr-1" /> Previous
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSkippedQuestions([...skippedQuestions, currentIndex]);
                if (currentIndex < activeExam.questions.length - 1) {
                  setCurrentIndex(currentIndex + 1);
                }
              }}
              className="text-muted-foreground"
            >
              Skip
            </Button>
          </div>

          {currentIndex < activeExam.questions.length - 1 ? (
            <Button size="sm" onClick={() => setCurrentIndex(currentIndex + 1)}>
              Next <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          ) : (
            <Button size="sm" variant="default" onClick={handleFinish} disabled={isSubmitting}>
              {isSubmitting ? 'Submitting...' : 'Finish Exam'}
            </Button>
          )}
        </div>
      </div>
    );
  }

  // Exam list view
  const sections = (lessonContent || document.processed_content) ? extractMarkdownSections(lessonContent || document.processed_content || '') : [];

  return (
    <ScrollArea className="h-full">
      <div className="p-4 space-y-4">
        {/* Generate */}
        <div className="space-y-4 p-5 bg-secondary/30 rounded-xl border border-border/50">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" /> Generate Exam
            </h3>
            {tier === 'free' && (
              <Badge variant="secondary" className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 gap-1 border-amber-200 dark:border-amber-800">
                <Lock className="w-3 h-3" /> PRO
              </Badge>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="examQuestionCount" className="text-xs font-medium text-muted-foreground">Number of Questions</Label>
              <Select
                value={questionCount.toString()}
                onValueChange={(val) => setQuestionCount(parseInt(val))}
              >
                <SelectTrigger id="examQuestionCount" className="h-9">
                  <SelectValue placeholder="Select count" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10 Questions</SelectItem>
                  <SelectItem value="20">20 Questions</SelectItem>
                  <SelectItem value="30">30 Questions</SelectItem>
                  <SelectItem value="40">40 Questions</SelectItem>
                  <SelectItem value="50">50 Questions</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-3 col-span-1 md:col-span-3">
              <Label className="text-sm font-semibold text-foreground">Question Types</Label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-card/50 p-4 rounded-lg border border-border/50">
                {[
                  { id: 'multipleChoice', label: 'Multiple Choice' },
                  { id: 'fillInBlank', label: 'Fill in the blank' },
                  { id: 'trueFalse', label: 'True/False' },
                  { id: 'multipleAnswer', label: 'Multiple Answer' },
                  
                  { id: 'matching', label: 'Matching' },
                  { id: 'dropdown', label: 'Dropdown' },
                  { id: 'sourceBased', label: 'Citation / Source-based' },
                ].map((type) => (
                  <div
                    key={type.id}
                    className="flex items-center space-x-2 py-1"
                    onClick={() => {
                      if (selectedQuestionTypes.includes(type.id)) {
                        setSelectedQuestionTypes(selectedQuestionTypes.filter(id => id !== type.id));
                      } else {
                        setSelectedQuestionTypes([...selectedQuestionTypes, type.id]);
                      }
                    }}
                  >
                    <Checkbox
                      id={`exam-type-${type.id}`}
                      checked={selectedQuestionTypes.includes(type.id)}
                      className="h-4 w-4"
                    />
                    <Label
                      htmlFor={`exam-type-${type.id}`}
                      className="text-xs font-medium cursor-pointer leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                    >
                      {type.label}
                    </Label>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground">Select Lessons</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full h-auto min-h-9 justify-between font-normal text-xs px-3 py-2">
                    <span className="whitespace-normal text-left">
                      {selectedLessons.length === 0
                        ? "All Lessons Selected"
                        : `${selectedLessons.length} Lesson${selectedLessons.length > 1 ? 's' : ''} Selected`}
                    </span>
                    <Plus className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                  <div className="p-2 border-b">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full justify-start text-xs h-8"
                      onClick={() => setSelectedLessons([])}
                    >
                      <Check className={`mr-2 h-3.5 w-3.5 ${selectedLessons.length === 0 ? "opacity-100" : "opacity-0"}`} />
                      All Lessons
                    </Button>
                  </div>
                  <ScrollArea className="h-[200px]">
                    <div className="p-2 space-y-1">
                      {sections.map((section) => (
                        <div
                          key={section.id}
                          className="flex items-center space-x-2 px-2 py-1.5 rounded-md hover:bg-muted cursor-pointer transition-colors"
                          onClick={() => {
                            if (selectedLessons.includes(section.id)) {
                              setSelectedLessons(selectedLessons.filter(id => id !== section.id));
                            } else {
                              setSelectedLessons([...selectedLessons, section.id]);
                            }
                          }}
                        >
                          <Checkbox
                            id={`exam-lesson-${section.id}`}
                            checked={selectedLessons.includes(section.id)}
                            className="h-4 w-4 pointer-events-none"
                          />
                          <Label
                            className="text-xs flex-1 cursor-pointer whitespace-normal break-words pointer-events-none"
                          >
                            {section.title}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {tier === 'free' ? (
            <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/50 p-3 rounded-lg">
              <p className="text-xs text-amber-800 dark:text-amber-300 mb-3">
                Exam generation is a Pro feature. Upgrade to Pro to generate custom exams from your materials.
               </p>
               <Button onClick={() => setIsUpgradeModalOpen(true)} className="w-full bg-amber-600 hover:bg-amber-700 text-white border-none shadow-sm" size="sm">
                 Upgrade to Pro
              </Button>
            </div>
          ) : (
            <Button
              onClick={handleGenerate}
              disabled={isGenerating}
              className="w-full gap-2 shadow-sm"
              size="sm"
            >
              {isGenerating ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Generating...</>
              ) : (
                <><Sparkles className="w-4 h-4" /> Generate Exam</>
              )}
            </Button>
          )}
        </div>

        {/* Exam list */}
        {loading ? (
          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-foreground">
              <Skeleton className="h-4 w-24" />
            </h2>
            {[1, 2, 3].map((i) => (
              <div key={i} className="w-full p-4 bg-card border border-border rounded-lg">
                <div className="flex items-center justify-between">
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-2/3" />
                    <Skeleton className="h-3 w-1/3" />
                  </div>
                  <Skeleton className="w-5 h-5 rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : exams.length > 0 ? (
          <div className="space-y-3">
            <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
              <Play className="w-4 h-4 text-primary" />
              Your Exams
            </h2>
            <div className="grid grid-cols-1 gap-3">
              {exams.map((exam) => (
                <button
                  key={exam.id}
                  onClick={() => startExam(exam)}
                  className="w-full p-4 bg-card border border-border/50 rounded-xl hover:border-primary/50 hover:bg-primary/5 transition-all text-left group shadow-sm hover:shadow-md"
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-foreground truncate group-hover:text-primary transition-colors">{exam.title}</p>
                      <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                        <Badge variant="outline" className="text-[10px] h-5 px-1.5">
                          {exam.questions.length} questions
                        </Badge>
                        <Badge variant="outline" className="text-[10px] h-5 px-1.5">
                          {exam.totalPoints} pts
                        </Badge>
                        <Badge variant="outline" className="text-[10px] h-5 px-1.5">
                          ~{exam.estimatedMinutes} min
                        </Badge>
                        {exam.best_score !== undefined && (
                          <Badge variant="secondary" className="text-[10px] h-5 px-1.5 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                            Best: {Math.round(exam.best_score)}%
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="w-8 h-8 rounded-lg bg-primary/5 flex items-center justify-center group-hover:bg-primary/10 transition-colors">
                      <Play className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="w-12 h-12 rounded-lg bg-secondary flex items-center justify-center mb-3">
              <Plus className="w-6 h-6 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium text-foreground mb-2">No exams yet</p>
            <p className="text-xs text-muted-foreground max-w-xs">
              Generate an exam from your study material above
            </p>
          </div>
        )}
      </div>

      <UpgradeModal
        open={isUpgradeModalOpen}
        onOpenChange={(open) => setIsUpgradeModalOpen(open)}
      />
    </ScrollArea>
  );
};

export default DocumentExamsView;
