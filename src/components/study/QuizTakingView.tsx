import { useState, useEffect, useRef } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { ChevronLeft, ChevronRight, RotateCcw, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useQuizAnalytics } from '@/hooks/useQuizAnalytics';
import { useSubjectAnalytics } from '@/hooks/useSubjectAnalytics';

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
  total_questions: number;
  time_limit_minutes: number | null;
}

interface QuizTakingViewProps {
  quizId: string;
  onBack: () => void;
  subjectId?: string | null;
}

const QuizTakingView: React.FC<QuizTakingViewProps> = ({ quizId, onBack, subjectId: propSubjectId }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { recordQuizAttempt } = useQuizAnalytics();
  const { updateSubjectAnalytics } = useSubjectAnalytics();
  const quizStartTimeRef = useRef<number>(Date.now());
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string>('');
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [showResults, setShowResults] = useState(false);
  const [score, setScore] = useState(0);
  const [loading, setLoading] = useState(true);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [quizAttemptId, setQuizAttemptId] = useState<string | null>(null);
  const [subjectId, setSubjectId] = useState<string | null>(propSubjectId || null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch quiz and questions
  useEffect(() => {
    const fetchQuiz = async () => {
      if (!user) return;

      try {
        setLoading(true);
        const { data: quizData, error: quizError } = await supabase
          .from('quizzes')
          .select('*')
          .eq('id', quizId)
          .eq('user_id', user.id)
          .single();

        if (quizError) throw quizError;
        setQuiz(quizData as Quiz);

        // Only set subjectId if not provided via props, or use as fallback
        if (!propSubjectId) {
          setSubjectId(quizData.subject_id);
        }

        // Fetch questions
        const { data: questionData, error: questionError } = await supabase
          .from('quiz_questions')
          .select('*')
          .eq('quiz_id', quizId)
          .order('order_index', { ascending: true });

        if (questionError) throw questionError;
        setQuestions(questionData || []);

        // Set timer if quiz has time limit
        if (quizData.time_limit_minutes) {
          setTimeLeft(quizData.time_limit_minutes * 60);
        }
      } catch (error) {
        console.error('Error fetching quiz:', error);
        toast({
          title: 'Error',
          description: 'Failed to load quiz',
          variant: 'destructive',
        });
        onBack();
      } finally {
        setLoading(false);
      }
    };

    fetchQuiz();
  }, [quizId, user]);

  // Timer effect
  useEffect(() => {
    if (timeLeft !== null && timeLeft > 0 && !showResults) {
      const timer = setTimeout(() => setTimeLeft(timeLeft - 1), 1000);
      return () => clearTimeout(timer);
    } else if (timeLeft === 0) {
      handleFinishQuiz();
    }
  }, [timeLeft, showResults]);

  const handleNextQuestion = () => {
    if (selectedAnswer) {
      setAnswers({ ...answers, [questions[currentQuestionIndex].id]: selectedAnswer });
    }

    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
      setSelectedAnswer(answers[questions[currentQuestionIndex + 1]?.id] || '');
    } else {
      handleFinishQuiz();
    }
  };

  const handlePreviousQuestion = () => {
    if (selectedAnswer) {
      setAnswers({ ...answers, [questions[currentQuestionIndex].id]: selectedAnswer });
    }
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(currentQuestionIndex - 1);
      setSelectedAnswer(answers[questions[currentQuestionIndex - 1]?.id] || '');
    }
  };

  const handleFinishQuiz = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);

    if (selectedAnswer) {
      setAnswers({ ...answers, [questions[currentQuestionIndex].id]: selectedAnswer });
    }

    let correctCount = 0;
    const finalAnswers = selectedAnswer
      ? { ...answers, [questions[currentQuestionIndex].id]: selectedAnswer }
      : answers;

    questions.forEach((q) => {
      if (finalAnswers[q.id] === q.correct_answer) {
        correctCount++;
      }
    });

    const percentage = (correctCount / questions.length) * 100;
    setScore(percentage);

    // Record quiz attempt
    if (user && quiz) {
      const timeSpentSeconds = Math.floor((Date.now() - quizStartTimeRef.current) / 1000);
      const totalPoints = questions.length; // Assuming 1 point per question

      await recordQuizAttempt(
        quizId,
        subjectId || undefined,
        correctCount, // score
        totalPoints, // maxScore
        timeSpentSeconds,
        correctCount, // questionsCorrect
        questions.length, // totalQuestions
        quizAttemptId || undefined,
        undefined, // knowledgeId
        'quiz' // activityType
      );

      // Trigger analytics update for this subject
      if (subjectId) {
        await updateSubjectAnalytics(subjectId, true);
      }
    }

    setShowResults(true);
    setIsSubmitting(false);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <div className="p-3 sm:p-6 md:p-8 space-y-4 sm:space-y-8 max-w-4xl mx-auto pb-24 sm:pb-40">
        <div className="space-y-4">
          <Skeleton className="h-8 w-24 mb-2" />
          <div className="space-y-2">
            <Skeleton className="h-10 w-3/4" />
            <div className="flex items-center justify-between">
              <Skeleton className="h-6 w-32" />
              <Skeleton className="h-8 w-24" />
            </div>
          </div>
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-16" />
          </div>
          <Skeleton className="h-3 w-full rounded-full" />
        </div>
        <Card className="border-2">
          <CardContent className="p-8 md:p-10 space-y-8">
            <Skeleton className="h-12 w-full mb-6" />
            <div className="space-y-4">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-16 w-full rounded-lg" />
              ))}
            </div>
          </CardContent>
        </Card>
        <div className="grid grid-cols-2 gap-4 md:gap-6 pr-12 md:pr-16">
          <Skeleton className="h-12 md:h-14 rounded-lg" />
          <Skeleton className="h-12 md:h-14 rounded-lg" />
        </div>
      </div>
    );
  }

  if (!quiz || questions.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">No quiz data found</p>
      </div>
    );
  }

  if (showResults) {
    const timeSpentSeconds = Math.floor((Date.now() - quizStartTimeRef.current) / 1000);
    const timeSpentMinutes = Math.floor(timeSpentSeconds / 60);
    const remainingSeconds = timeSpentSeconds % 60;

    return (
      <ScrollArea className="h-full">
        <div className="p-3 sm:p-6 md:p-8 space-y-4 sm:space-y-8 max-w-4xl mx-auto pb-24 sm:pb-40">
          <div className="text-center space-y-3 sm:space-y-6">
            <h1 className="text-2xl sm:text-4xl md:text-5xl font-bold text-foreground">Quiz Completed! 🎉</h1>
            <p className="text-sm sm:text-lg md:text-xl text-muted-foreground">Here's how you performed</p>
            <Card className="bg-gradient-to-br from-primary/15 to-primary/5 border-2 border-primary/30">
              <CardContent className="p-4 sm:p-8 md:p-12">
                <div className="text-4xl sm:text-6xl md:text-7xl font-bold text-primary mb-2 sm:mb-4">{Math.round(score)}%</div>
                <p className="text-sm sm:text-lg md:text-xl text-foreground">
                  {Math.round((score / 100) * questions.length)} out of {questions.length} questions answered correctly
                </p>
                <div className="pt-3 sm:pt-6 mt-3 sm:mt-6 border-t border-border/30">
                  <div className="flex items-center justify-center gap-2 text-muted-foreground">
                    <Clock className="w-4 h-4 sm:w-5 sm:h-5" />
                    <span className="text-sm sm:text-base md:text-lg">Time spent: {timeSpentMinutes}m {remainingSeconds}s</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-3 sm:space-y-6">
            <h2 className="text-lg sm:text-2xl md:text-3xl font-bold text-foreground">Answer Review</h2>
            <div className="grid gap-3 sm:gap-4 md:gap-6">
              {questions.map((question, index) => {
                const userAnswer = answers[question.id];
                const isCorrect = userAnswer === question.correct_answer;
                return (
                  <Card key={question.id} className={isCorrect ? 'border-green-500/30 bg-green-50/30 dark:bg-green-950/10' : 'border-red-500/30 bg-red-50/30 dark:bg-red-950/10'}>
                    <CardContent className="p-3 sm:p-6 md:p-8">
                      <div className="flex items-start gap-2 sm:gap-4 mb-2 sm:mb-4">
                        <div className={`flex-shrink-0 w-7 h-7 sm:w-10 sm:h-10 rounded-full flex items-center justify-center font-bold text-sm sm:text-lg ${
                          isCorrect ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
                        }`}>
                          {isCorrect ? '✓' : '✗'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm sm:text-lg text-foreground mb-1 sm:mb-2">Question {index + 1}</p>
                          <p className="text-foreground text-xs sm:text-base mb-2 sm:mb-4">{question.question}</p>
                          <div className="space-y-1 sm:space-y-3 text-xs sm:text-base">
                            <div>
                              <span className="font-semibold text-foreground">Your answer: </span>
                              <span className={isCorrect ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>
                                {userAnswer || 'Not answered'}
                              </span>
                            </div>
                            {!isCorrect && (
                              <div>
                                <span className="font-semibold text-foreground">Correct answer: </span>
                                <span className="text-green-600 dark:text-green-400">{question.correct_answer}</span>
                              </div>
                            )}
                            {question.explanation && (
                              <div className="pt-2 sm:pt-3 border-t border-border/50">
                                <span className="font-semibold text-foreground">Explanation: </span>
                                <p className="text-muted-foreground mt-1 text-xs sm:text-base">{question.explanation}</p>
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
            <Button onClick={onBack} size="lg" className="h-10 sm:h-12 md:h-14 text-sm sm:text-base md:text-lg">
              Back to Quizzes
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setCurrentQuestionIndex(0);
                setSelectedAnswer('');
                setAnswers({});
                setShowResults(false);
                setScore(0);
                if (quiz.time_limit_minutes) {
                  setTimeLeft(quiz.time_limit_minutes * 60);
                }
              }}
              size="lg"
              className="h-10 sm:h-12 md:h-14 text-sm sm:text-base md:text-lg"
            >
              <RotateCcw className="w-4 h-4 sm:w-5 sm:h-5 mr-2" />
              Retake Quiz
            </Button>
          </div>
        </div>
      </ScrollArea>
    );
  }

  const currentQuestion = questions[currentQuestionIndex];
  const progress = ((currentQuestionIndex + 1) / questions.length) * 100;

  return (
    <ScrollArea className="h-full">
      <div className="p-3 sm:p-6 md:p-8 space-y-4 sm:space-y-8 max-w-4xl mx-auto pb-24 sm:pb-40">
        {/* Header */}
        <div className="space-y-2 sm:space-y-4">
          <Button variant="ghost" size="sm" onClick={onBack} className="text-muted-foreground hover:text-foreground text-xs sm:text-sm">
            <ChevronLeft className="w-4 h-4 sm:w-5 sm:h-5 mr-1 sm:mr-2" />
            Back to Quizzes
          </Button>
          <div className="space-y-1 sm:space-y-2">
            <h1 className="text-xl sm:text-3xl md:text-4xl font-bold text-foreground">{quiz.title}</h1>
            <div className="flex items-center justify-between">
              <p className="text-sm sm:text-lg text-muted-foreground">
                Question {currentQuestionIndex + 1} of {questions.length}
              </p>
              {timeLeft !== null && (
                <div className={`flex items-center gap-1 sm:gap-2 text-sm sm:text-lg font-semibold ${timeLeft < 60 ? 'text-destructive' : 'text-foreground'}`}>
                  <Clock className="w-4 h-4 sm:w-6 sm:h-6" />
                  {formatTime(timeLeft)}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="space-y-1 sm:space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs sm:text-sm font-medium text-muted-foreground">Progress</span>
            <span className="text-xs sm:text-sm font-medium text-primary">{currentQuestionIndex + 1} / {questions.length}</span>
          </div>
          <Progress value={progress} className="h-2 sm:h-3 rounded-full" />
        </div>

        {/* Question Card */}
        <Card className="border-2">
          <CardContent className="p-4 sm:p-8 md:p-10 space-y-4 sm:space-y-8">
            <h2 className="text-base sm:text-2xl md:text-3xl font-bold text-foreground leading-relaxed">
              {currentQuestion.question}
            </h2>

            {Array.isArray(currentQuestion.options) && currentQuestion.options.length > 0 ? (
              <RadioGroup value={selectedAnswer} onValueChange={setSelectedAnswer}>
                <div className="space-y-2 sm:space-y-3 md:space-y-4">
                  {currentQuestion.options.map((option: string, index: number) => (
                    <div
                      key={index}
                      className={`flex items-center space-x-2 sm:space-x-4 p-3 sm:p-5 md:p-6 rounded-lg border-2 transition-all cursor-pointer ${
                        selectedAnswer === option
                          ? 'border-primary bg-primary/10'
                          : 'border-border hover:border-primary/50 hover:bg-secondary/30'
                      }`}
                      onClick={() => setSelectedAnswer(option)}
                    >
                      <RadioGroupItem value={option} id={`option-${index}`} className="w-4 h-4 sm:w-6 sm:h-6" />
                      <Label htmlFor={`option-${index}`} className="flex-1 cursor-pointer text-xs sm:text-lg md:text-base">
                        {option}
                      </Label>
                    </div>
                  ))}
                </div>
              </RadioGroup>
            ) : (
              <div className="space-y-2 pt-2">
                <p className="text-sm font-medium text-muted-foreground mb-2">Write your answer below:</p>
                <textarea
                  className="w-full min-h-[120px] p-3 sm:p-4 rounded-lg border-2 border-border focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all resize-y text-sm sm:text-base bg-background"
                  placeholder="Type your answer here..."
                  value={selectedAnswer}
                  onChange={(e) => setSelectedAnswer(e.target.value)}
                />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Navigation */}
        <div className="grid grid-cols-2 gap-3 sm:gap-4 md:gap-6">
          <Button
            variant="outline"
            disabled={currentQuestionIndex === 0}
            onClick={handlePreviousQuestion}
            size="lg"
            className="h-10 sm:h-12 md:h-14 text-xs sm:text-base md:text-lg"
          >
            <ChevronLeft className="w-4 h-4 sm:w-5 sm:h-5 mr-1 sm:mr-2" />
            Previous
          </Button>
          <Button
            onClick={handleNextQuestion}
            size="lg"
            className="h-10 sm:h-12 md:h-14 text-xs sm:text-base md:text-lg"
            disabled={!selectedAnswer || isSubmitting}
          >
            {isSubmitting ? 'Submitting...' : currentQuestionIndex === questions.length - 1 ? 'Finish Quiz' : 'Next'}
            <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5 ml-1 sm:ml-2" />
          </Button>
        </div>
      </div>
    </ScrollArea>
  );
};

export default QuizTakingView;
