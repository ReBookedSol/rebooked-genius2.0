import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ArrowLeft, Clock, Award, ChevronLeft, ChevronRight, Loader2, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import AppLayout from '@/components/layout/AppLayout';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { useSidebar } from '@/contexts/SidebarContext';
import { useAIContext } from '@/contexts/AIContext';

interface TestQuestion {
  id: string;
  question_text: string;
  options: string[];
  correct_answer: string;
  explanation: string | null;
  difficulty: string;
}


const NBTTestTaking = () => {
  const { testId } = useParams<{ testId: string }>();
  const [searchParams] = useSearchParams();
  const section = searchParams.get('section') || 'AQL';
  const _lessonId = searchParams.get('lessonId');
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const startTimeRef = useRef(Date.now());
  const { setAiContext } = useAIContext();

  // Allow AI chat during test taking
  // We removed the setFloatingPanelOpen(false) to let users ask for help


  const [loading, setLoading] = useState(true);
  const [test, setTest] = useState<any>(null);
  const [questions, setQuestions] = useState<TestQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [showResults, setShowResults] = useState(false);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [testStarted, setTestStarted] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  // Active question derived early for context updates
  const currentQ = questions[currentIndex] || null;

  // Update AI context when question changes
  useEffect(() => {
    if (testStarted && !showResults && currentQ && test) {
      setAiContext({
        activeNbtTest: {
          id: test.id,
          section: test.section || section,
          question: currentQ.question_text,
          options: currentQ.options,
          index: currentIndex,
          total: questions.length
        }
      });
    } else if (showResults || !testStarted) {
      // Clear context when not actively taking the test
      setAiContext({ activeNbtTest: null });
    }
  }, [currentIndex, currentQ, testStarted, showResults, test, setAiContext, section, questions.length]);
  const [generationMessage, setGenerationMessage] = useState('');
  

  const motivationalMessages = [
    "Your future self will thank you for this preparation! 🌟",
    "Every question you practice now is a point gained on test day! 💪",
    "Building your knowledge base, one question at a time... 🧠",
    "Success is the sum of small efforts repeated daily! 🔥",
    "You're investing in yourself - the best investment there is! ⭐",
  ];

  useEffect(() => {
    const fetchTest = async () => {
      if (!testId || !user) return;
      setLoading(true);
      try {
        const { data: testData, error: testError } = await supabase
          .from('nbt_practice_tests')
          .select('*')
          .eq('id', testId)
          .single();

        if (testError) throw testError;
        setTest(testData);
        if (testData.time_limit_minutes) {
          setTimeLeft(testData.time_limit_minutes * 60);
        }

        // Fetch test questions
        const { data: testQuestions } = await supabase
          .from('nbt_test_questions')
          .select('question_id, order_index, nbt_practice_questions(*)')
          .eq('test_id', testId)
          .order('order_index', { ascending: true });

        const mapped: TestQuestion[] = (testQuestions || [])
          .filter((tq: any) => tq.nbt_practice_questions)
          .map((tq: any) => {
            const q = tq.nbt_practice_questions;
            return {
              id: q.id,
              question_text: q.question_text,
              options: Array.isArray(q.options) ? q.options : [],
              correct_answer: q.correct_answer,
              explanation: q.explanation,
              difficulty: q.difficulty,
            };
          });

        // Only set questions if we actually have linked ones - otherwise show "Generate" screen
        if (mapped.length > 0) {
          setQuestions(mapped);
        }
        // No fallback to old collections - user must generate fresh questions
      } catch (err) {
        console.error('Error loading test:', err);
        toast({ title: 'Error', description: 'Failed to load test', variant: 'destructive' });
        navigate('/nbt');
      } finally {
        setLoading(false);
      }
    };

    fetchTest();
  }, [testId, user]);

  // Timer
  useEffect(() => {
    if (testStarted && timeLeft !== null && timeLeft > 0 && !showResults) {
      const timer = setTimeout(() => setTimeLeft(timeLeft - 1), 1000);
      return () => clearTimeout(timer);
    } else if (testStarted && timeLeft === 0 && !showResults) {
      handleFinish();
    }
  }, [timeLeft, showResults, testStarted]);

  // Generation message rotation
  useEffect(() => {
    if (!isGenerating) return;
    let idx = 0;
    setGenerationMessage(motivationalMessages[0]);
    const interval = setInterval(() => {
      idx = (idx + 1) % motivationalMessages.length;
      setGenerationMessage(motivationalMessages[idx]);
    }, 4000);
    return () => clearInterval(interval);
  }, [isGenerating]);

  const handleGenerateTest = async () => {
    if (!user) {
      toast({ title: 'Error', description: 'You must be logged in.', variant: 'destructive' });
      return;
    }

    setIsGenerating(true);
    try {
      const topic = searchParams.get('topic');
      const testSection = test?.section || section;

      const { data, error } = await supabase.functions.invoke('generate-exam-nbt-practice', {
        body: {
          section: testSection,
          testId: testId,
          questionCount: test?.total_questions || 30,
          difficulty: 'mixed',
          selectedTopics: topic ? [topic] : [],
        }
      });

      // Handle edge function errors gracefully
      if (error) {
        const errorMsg = typeof error === 'object' && error?.message ? error.message : String(error);
        // If it's a fetch/parsing error, the function may have still succeeded
        if (!errorMsg.includes('FunctionsFetchError') && !errorMsg.includes('non-2xx')) {
          throw new Error(errorMsg);
        }
        console.warn('Generate test returned non-2xx but may have succeeded, checking for questions...');
      }
      if (data?.error) throw new Error(data.error);

      // Fetch the newly created questions linked to this test
      const { data: testQuestions } = await supabase
        .from('nbt_test_questions')
        .select('question_id, order_index, nbt_practice_questions(*)')
        .eq('test_id', testId!)
        .order('order_index', { ascending: true });

      if (testQuestions && testQuestions.length > 0) {
        setQuestions(testQuestions
          .filter((tq: any) => tq.nbt_practice_questions)
          .map((tq: any) => {
            const q = tq.nbt_practice_questions;
            return {
              id: q.id,
              question_text: q.question_text,
              options: Array.isArray(q.options) ? q.options : [],
              correct_answer: q.correct_answer,
              explanation: q.explanation,
              difficulty: q.difficulty,
            };
          }));
      }

      toast({ title: 'Test Generated!', description: `${data?.questionCount || test?.total_questions || 30} questions ready.` });
    } catch (err: any) {
      console.error('Error generating test:', err);
      toast({ title: 'Error', description: err.message || 'Failed to generate test', variant: 'destructive' });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleFinish = async () => {
    let correct = 0;
    questions.forEach(q => {
      if (answers[q.id] === q.correct_answer) correct++;
    });

    const timeSpent = Math.floor((Date.now() - startTimeRef.current) / 1000);
    const percentage = questions.length > 0 ? Math.round((correct / questions.length) * 100) : 0;

    if (user && testId) {
      try {
        await supabase.from('nbt_test_attempts').insert({
          user_id: user.id,
          test_id: testId,
          section: test?.section || section,
          status: 'completed',
          started_at: new Date(startTimeRef.current).toISOString(),
          completed_at: new Date().toISOString(),
          time_taken_seconds: timeSpent,
          answered_questions: Object.keys(answers).length,
          correct_answers: correct,
          total_score: correct,
          max_score: questions.length,
          percentage,
          answers: answers as any,
        });
      } catch (err) {
        console.error('Error saving test attempt:', err);
      }
    }

    setShowResults(true);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-[60vh]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  // Generation overlay - full page blocking
  if (isGenerating) {
    return (
      <div className="fixed inset-0 z-[200] bg-background flex items-center justify-center">
        <div className="flex flex-col items-center justify-center text-center px-6 space-y-8 max-w-lg">
          <div className="relative">
            <div className="w-24 h-24 bg-primary/20 rounded-full flex items-center justify-center animate-pulse">
              <Sparkles className="w-12 h-12 text-primary" />
            </div>
          </div>
          <div className="space-y-3">
            <h2 className="text-2xl font-black text-foreground">Generating Your Test...</h2>
            <p className="text-muted-foreground max-w-md mx-auto">{generationMessage}</p>
          </div>
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
          <p className="text-xs text-muted-foreground">
            ⚠️ Please don't navigate away. Your test is being generated.
          </p>
        </div>
      </div>
    );
  }

  // No questions - offer to generate
  if (questions.length === 0) {
    return (
      <AppLayout>
        <div className="max-w-none mx-auto py-12 px-6 text-center space-y-6">
          <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
            <Sparkles className="w-10 h-10 text-primary" />
          </div>
          <h2 className="text-3xl font-black">{test?.title || 'Your Test'}</h2>
          <p className="text-muted-foreground text-lg">
            {test?.total_questions || 30} questions • {test?.section || section}
          </p>
          <Button onClick={handleGenerateTest} size="lg" className="rounded-full px-10 h-14 font-bold shadow-lg shadow-primary/20">
            <Sparkles className="w-5 h-5 mr-2" /> Generate Test
          </Button>
        </div>
      </AppLayout>
    );
  }

  // Pre-start screen
  if (!testStarted && !showResults) {
    return (
      <AppLayout>
        <div className="max-w-none mx-auto py-12 px-6 text-center space-y-8">
          <div className="w-24 h-24 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
            <Award className="w-12 h-12 text-primary" />
          </div>
          <h1 className="text-4xl font-black">{test?.title || 'NBT Test'}</h1>
          <div className="flex justify-center gap-4">
            <Badge variant="outline" className="text-sm px-4 py-1">{test?.section || section}</Badge>
            <Badge variant="outline" className="text-sm px-4 py-1">{questions.length} Questions</Badge>
            {test?.time_limit_minutes && (
              <Badge variant="outline" className="text-sm px-4 py-1">{test.time_limit_minutes} min</Badge>
            )}
          </div>
          <p className="text-muted-foreground">Total marks: {questions.length}</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button variant="outline" onClick={() => navigate('/nbt')} className="rounded-full px-8">
              <ArrowLeft className="w-4 h-4 mr-2" /> Back
            </Button>
            <Button onClick={() => { setTestStarted(true); startTimeRef.current = Date.now(); }} size="lg" className="rounded-full px-10 h-14 font-bold shadow-lg shadow-primary/20">
              Start Test
            </Button>
          </div>
        </div>
      </AppLayout>
    );
  }

  // Results
  if (showResults) {
    const correct = questions.filter(q => answers[q.id] === q.correct_answer).length;
    const percentage = questions.length > 0 ? Math.round((correct / questions.length) * 100) : 0;
    const timeSpent = Math.floor((Date.now() - startTimeRef.current) / 1000);

    return (
      <AppLayout>
        <ScrollArea className="h-[calc(100vh-120px)]">
          <div className="max-w-none mx-auto py-12 px-6 space-y-8">
            <div className="text-center space-y-4">
              <div className="w-24 h-24 bg-primary/20 rounded-full flex items-center justify-center mx-auto">
                <Award className="w-12 h-12 text-primary" />
              </div>
              <h1 className="text-4xl font-black text-foreground">Test Complete!</h1>
              <Card className="bg-gradient-to-br from-primary/15 to-primary/5 border-2 border-primary/30">
                <CardContent className="p-8">
                  <div className="text-6xl font-bold text-primary mb-2">{percentage}%</div>
                  <p className="text-lg text-foreground">{correct} out of {questions.length} correct</p>
                  <p className="text-sm text-muted-foreground mt-2">
                    <Clock className="w-4 h-4 inline mr-1" />
                    Time: {Math.floor(timeSpent / 60)}m {timeSpent % 60}s
                  </p>
                </CardContent>
              </Card>
            </div>

            <div className="space-y-4">
              <h2 className="text-2xl font-bold">Review</h2>
              {questions.map((q, i) => {
                const isCorrect = answers[q.id] === q.correct_answer;
                return (
                  <Card key={q.id} className={isCorrect ? 'border-green-500/30 bg-green-50/30 dark:bg-green-950/10' : 'border-red-500/30 bg-red-50/30 dark:bg-red-950/10'}>
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <div className={cn("w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 text-white", isCorrect ? "bg-green-500" : "bg-red-500")}>
                          {isCorrect ? '✓' : '✗'}
                        </div>
                        <div className="flex-1">
                          <p className="font-semibold mb-1">Q{i + 1}: {q.question_text}</p>
                          <p className="text-sm">Your answer: <span className={isCorrect ? 'text-green-600' : 'text-red-600'}>{answers[q.id] || 'Not answered'}</span></p>
                          {!isCorrect && <p className="text-sm">Correct: <span className="text-green-600">{q.correct_answer}</span></p>}
                          {q.explanation && (
                            <div className="mt-3 p-4 bg-muted/50 border border-border rounded-lg text-sm text-foreground prose prose-sm dark:prose-invert max-w-none">
                              <span className="font-semibold block mb-2 text-primary">Explanation:</span>
                              <ReactMarkdown remarkPlugins={[remarkGfm]}>{q.explanation}</ReactMarkdown>
                            </div>
                          )}
                          <Badge variant="outline" className="mt-2 text-xs">{q.difficulty}</Badge>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <Button variant="secondary" onClick={() => navigate('/nbt/practice')} className="flex-1">Back to Practice</Button>
              <Button onClick={() => navigate('/nbt')} className="flex-1">NBT Hub</Button>
              <Button variant="outline" onClick={() => { setAnswers({}); setCurrentIndex(0); setShowResults(false); setTestStarted(false); }} className="flex-1">Retake</Button>
            </div>
          </div>
        </ScrollArea>
      </AppLayout>
    );
  }

  // Active test metrics
  const progress = ((currentIndex + 1) / questions.length) * 100;

  return (
    <AppLayout>
      <ScrollArea className="h-[calc(100vh-80px)]">
        <div className="max-w-none mx-auto py-4 sm:py-6 px-3 sm:px-6 space-y-4 sm:space-y-6">
          {/* Header - mobile optimized */}
          <div className="flex items-center justify-between gap-2">
            <Button variant="ghost" size="sm" onClick={() => navigate('/nbt')} className="shrink-0 px-2 sm:px-3">
              <ArrowLeft className="w-4 h-4 sm:mr-2" />
              <span className="hidden sm:inline">Exit Test</span>
            </Button>
            <div className="flex items-center gap-2 sm:gap-4">
              {timeLeft !== null && (
                <div className={cn("flex items-center gap-1 sm:gap-2 bg-secondary/50 px-2 sm:px-4 py-1.5 sm:py-2 rounded-full font-mono text-xs sm:text-sm", timeLeft < 60 && "text-destructive")}>
                  <Clock className="w-3 h-3 sm:w-4 sm:h-4" /> {formatTime(timeLeft)}
                </div>
              )}
              <span className="text-xs sm:text-sm font-bold text-muted-foreground">{currentIndex + 1}/{questions.length}</span>
            </div>
          </div>

          <Progress value={progress} className="h-1.5 sm:h-2" />

          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs">{test?.section || section}</Badge>
            <h2 className="font-bold text-sm sm:text-lg truncate">{test?.title || 'NBT Test'}</h2>
          </div>

          <Card className="border-2">
            <CardContent className="p-4 sm:p-8 space-y-4 sm:space-y-6">
              <h3 className="text-base sm:text-xl font-bold text-foreground leading-snug">{currentQ.question_text}</h3>
              <div className="space-y-2 sm:space-y-3">
                {currentQ.options.map((opt, i) => (
                  <div
                    key={i}
                    onClick={() => setAnswers({ ...answers, [currentQ.id]: opt })}
                    className={cn(
                      "p-3 sm:p-4 rounded-xl border-2 cursor-pointer transition-all",
                      answers[currentQ.id] === opt ? "border-primary bg-primary/10" : "border-border hover:border-primary/50"
                    )}
                  >
                    <div className="flex items-start gap-2 sm:gap-3">
                      <div className={cn("w-7 h-7 sm:w-8 sm:h-8 rounded-lg border-2 flex items-center justify-center font-bold text-xs sm:text-sm shrink-0", answers[currentQ.id] === opt ? "border-primary bg-primary text-primary-foreground" : "border-border")}>
                        {String.fromCharCode(65 + i)}
                      </div>
                      <span className="font-medium text-sm sm:text-base leading-snug pt-0.5">{opt}</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <div className="flex gap-3 sm:gap-4">
            <Button variant="outline" disabled={currentIndex === 0} onClick={() => setCurrentIndex(currentIndex - 1)} className="flex-1 h-11 sm:h-10 text-sm">
              <ChevronLeft className="w-4 h-4 mr-1" /> Previous
            </Button>
            <Button
              disabled={!answers[currentQ.id]}
              onClick={() => {
                if (currentIndex < questions.length - 1) {
                  setCurrentIndex(currentIndex + 1);
                } else {
                  handleFinish();
                }
              }}
              className="flex-1 h-11 sm:h-10 text-sm"
            >
              {currentIndex === questions.length - 1 ? 'Finish' : 'Next'}
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </div>
      </ScrollArea>
    </AppLayout>
  );
};

export default NBTTestTaking;
