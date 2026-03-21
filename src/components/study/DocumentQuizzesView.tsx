import { useState, useEffect, useCallback } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Plus, Sparkles, Loader2, Play, CheckCircle2, XCircle, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useAIContext } from '@/contexts/AIContext';
import { supabase } from '@/integrations/supabase/client';
import { useSubscription } from '@/hooks/useSubscription';
import { type MarkdownSection } from '@/lib/markdownUtils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
interface StudyDocument {
  id: string;
  file_name: string;
  processed_content: string | null;
}

interface Quiz {
  id: string;
  title: string;
  total_questions: number;
  completion_rate?: number;
  best_score?: number;
}

interface DocumentQuizzesViewProps {
  document: StudyDocument;
  lessonContent?: string;
  lessonSections?: MarkdownSection[];
  onQuizSelect?: (quizId: string) => void;
  subjectId?: string;
  onGeneratingChange?: (isGenerating: boolean) => void;
}

const DocumentQuizzesView: React.FC<DocumentQuizzesViewProps> = ({
  document,
  lessonContent,
  lessonSections = [],
  onQuizSelect,
  subjectId,
  onGeneratingChange
}) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { limits, tier, canCreateQuiz, canUseAi, incrementAiUsage } = useSubscription();
  const { context: aiContext, setAiContext } = useAIContext();
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [loading, setLoading] = useState(true);
  const [questionCount, setQuestionCount] = useState(10);
  const [totalMarks, setTotalMarks] = useState(10);
  const [selectedSectionIds, setSelectedSectionIds] = useState<string[]>([]);

  // Use global generation state
  const isGenerating = aiContext.generationState?.isGenerating && aiContext.generationState?.generationType === 'quiz' && aiContext.generationState?.documentId === document.id ? true : false;

  // Fetch existing quizzes for this document
  const fetchQuizzes = useCallback(async () => {
    if (!user || !document) return;
    
    setLoading(true);
    try {
      // Fetch quizzes
      const { data: quizData, error: quizError } = await supabase
        .from('quizzes')
        .select('id, title, total_questions')
        .eq('user_id', user.id)
        .ilike('title', `%${document.file_name}%`)
        .order('created_at', { ascending: false });

      if (quizError) throw quizError;

      if (quizData && quizData.length > 0) {
        // Fetch best scores for these quizzes
        const quizIds = quizData.map(q => q.id);
        const { data: perfData } = await supabase
          .from('quiz_performance_analytics')
          .select('quiz_id, percentage')
          .in('quiz_id', quizIds)
          .eq('user_id', user.id);

        const bestScores: Record<string, number> = {};
        perfData?.forEach(p => {
          if (!bestScores[p.quiz_id] || p.percentage > bestScores[p.quiz_id]) {
            bestScores[p.quiz_id] = p.percentage;
          }
        });

        const formattedQuizzes = quizData.map(q => ({
          ...q,
          best_score: bestScores[q.id]
        }));

        setQuizzes(formattedQuizzes);
      } else {
        setQuizzes([]);
      }
    } catch (error) {
      console.error('Error fetching quizzes:', error);
    } finally {
      setLoading(false);
    }
  }, [user, document]);

  useEffect(() => {
    fetchQuizzes();
  }, [fetchQuizzes]);


  const handleGenerateQuiz = async () => {
    if (!document || !user) return;

    // Use selected sections content if available, otherwise fall back to full lesson content
    let contentToUse: string | null = null;
    if (selectedSectionIds.length > 0 && lessonSections.length > 0) {
      const selectedSections = lessonSections.filter(s => selectedSectionIds.includes(s.id));
      contentToUse = selectedSections.map(s => s.content).join('\n\n---\n\n');
    }

    if (!contentToUse) {
      contentToUse = lessonContent || document.processed_content;
    }
    if (!contentToUse || contentToUse.trim().length === 0) {
      toast({
        title: 'No content available',
        description: 'Please generate lessons first before creating a quiz.',
        variant: 'destructive',
      });
      return;
    }


    if (tier === 'free' && !canCreateQuiz()) {
      toast({
        title: 'Quiz Limit Reached',
        description: 'Free users can only create 1 quiz. Please upgrade to Pro for unlimited quizzes.',
        variant: 'destructive',
      });
      return;
    }

    if (tier === 'free' && limits.maxQuizQuestions < questionCount) {
      toast({
        title: 'Limit exceeded',
        description: `Free users can generate max ${limits.maxQuizQuestions} questions. Upgrade for more.`,
        variant: 'destructive',
      });
      return;
    }

    if (!canUseAi()) {
      toast({
        title: 'Daily limit reached',
        description: 'You have reached your daily AI usage limit. Upgrade your plan for more quizzes!',
        variant: 'destructive',
      });
      return;
    }

    // Set global generation state
    setAiContext({
      generationState: {
        isGenerating: true,
        generationType: 'quiz',
        documentId: document.id,
      }
    });
    onGeneratingChange?.(true);
    try {
      // Call AI to generate quiz questions
      const { data, error } = await supabase.functions.invoke('ai-generate', {
        body: {
          type: 'quiz',
          content: contentToUse,
          count: questionCount,
        },
      });

      if (error) throw error;
      if (!data?.data || !Array.isArray(data.data)) {
        throw new Error('Invalid response from AI');
      }

      const questions = data.data;

      // Create the quiz in the database
      const quizTitle = `${document.file_name} - Quiz (${totalMarks} marks)`;
      const { data: quizData, error: quizError } = await supabase
        .from('quizzes')
        .insert({
          user_id: user.id,
          title: quizTitle,
          description: `Generated from ${document.file_name}`,
          total_questions: questions.length,
          is_ai_generated: true,
          time_limit_minutes: Math.ceil(totalMarks * 1.5),
          subject_id: subjectId || null,
        })
        .select()
        .single();

      if (quizError) throw quizError;

      // Increment usage count
      await incrementAiUsage();

      // Insert the questions
      const pointsPerQuestion = Math.round((totalMarks / questions.length) * 10) / 10;
      const questionsToInsert = questions.map((q: any, idx: number) => ({
        quiz_id: quizData.id,
        question: q.question,
        options: q.options,
        correct_answer: q.correct_answer,
        explanation: q.explanation || '',
        question_type: 'multiple_choice',
        points: pointsPerQuestion,
        order_index: idx,
      }));

      const { error: questionsError } = await supabase
        .from('quiz_questions')
        .insert(questionsToInsert);

      if (questionsError) throw questionsError;

      toast({
        title: 'Quiz generated!',
        description: `Created ${questions.length} questions worth ${totalMarks} marks.`,
      });

      // Refresh the list
      fetchQuizzes();
    } catch (error: any) {
      console.error('Error generating quiz:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to generate quiz',
        variant: 'destructive',
      });
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

  // Question count options based on tier
  const questionOptions = tier === 'free' ? [10] : [10, 20, 30, 40, 50];

  return (
    <ScrollArea className="h-full">
      <div className="p-4 space-y-4">
        {/* Generation Options */}
        <div className="space-y-3 p-3 bg-secondary/30 rounded-lg">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="questionCount" className="text-xs">Questions</Label>
              <Select 
                value={questionCount.toString()} 
                onValueChange={(value) => setQuestionCount(parseInt(value))}
              >
                <SelectTrigger id="questionCount" className="h-8 text-sm">
                  <SelectValue placeholder="Select count" />
                </SelectTrigger>
                <SelectContent>
                  {questionOptions.map((count) => (
                    <SelectItem key={count} value={count.toString()}>
                      {count} questions
                    </SelectItem>
                  ))}
                  {tier === 'free' && (
                    <SelectItem value="locked" disabled className="text-muted-foreground">
                      🔒 20-50 (Upgrade)
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="totalMarks" className="text-xs">Total Marks</Label>
              <Input
                id="totalMarks"
                type="number"
                min={5}
                max={100}
                value={totalMarks}
                onChange={(e) => setTotalMarks(parseInt(e.target.value) || 10)}
                className="h-8 text-sm"
              />
            </div>
          </div>
          {lessonSections.length > 0 && (
            <div className="space-y-2">
              <Label className="text-xs">Select Topics (Optional)</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full h-auto min-h-8 justify-between font-normal text-xs px-3 py-2">
                    <span className="whitespace-normal text-left">
                      {selectedSectionIds.length === 0
                        ? "All topics will be used"
                        : `${selectedSectionIds.length} Topic${selectedSectionIds.length > 1 ? 's' : ''} Selected`}
                    </span>
                    <Plus className="ml-2 h-3.5 w-3.5 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                  <div className="p-2 border-b">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full justify-start text-xs h-7"
                      onClick={(e) => { e.preventDefault(); setSelectedSectionIds([]); }}
                    >
                      <Check className={`mr-2 h-3 w-3 ${selectedSectionIds.length === 0 ? "opacity-100" : "opacity-0"}`} />
                      All Topics
                    </Button>
                  </div>
                  <ScrollArea className="h-[180px]">
                    <div className="p-2 space-y-1">
                      {lessonSections.map((section) => (
                        <div
                          key={section.id}
                          className="flex items-center space-x-2 px-2 py-1.5 rounded-md hover:bg-muted cursor-pointer transition-colors"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            if (selectedSectionIds.includes(section.id)) {
                              setSelectedSectionIds(selectedSectionIds.filter(id => id !== section.id));
                            } else {
                              setSelectedSectionIds([...selectedSectionIds, section.id]);
                            }
                          }}
                        >
                          <Checkbox
                            id={`quiz-lesson-${section.id}`}
                            checked={selectedSectionIds.includes(section.id)}
                            className="h-3.5 w-3.5"
                          />
                          <Label
                            htmlFor={`quiz-lesson-${section.id}`}
                            className="text-[11px] flex-1 cursor-pointer whitespace-normal break-words"
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
          )}
          <Button
            onClick={handleGenerateQuiz}
            disabled={isGenerating}
            className="w-full gap-2 text-xs h-8"
            size="sm"
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-3 h-3 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Sparkles className="w-3 h-3" />
                Generate Quiz
              </>
            )}
          </Button>
        </div>

        {loading ? (
          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-foreground">
              <Skeleton className="h-4 w-24" />
            </h2>
            {[1, 2, 3].map((i) => (
              <div key={i} className="w-full p-3 bg-card border border-border rounded-lg">
                <div className="flex items-center justify-between">
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-2/3" />
                    <Skeleton className="h-3 w-1/3" />
                  </div>
                  <Skeleton className="w-4 h-4 rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : quizzes.length > 0 ? (
          <div className="space-y-3">
            <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
              <Play className="w-4 h-4 text-primary" />
              Your Quizzes
            </h2>
            <div className="grid grid-cols-1 gap-3">
              {quizzes.map((quiz) => (
                <button
                  key={quiz.id}
                  onClick={() => onQuizSelect?.(quiz.id)}
                  className="w-full p-4 bg-card border border-border/50 rounded-xl hover:border-primary/50 hover:bg-primary/5 transition-all text-left group shadow-sm hover:shadow-md"
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-foreground truncate group-hover:text-primary transition-colors">{quiz.title}</p>
                      <div className="flex items-center gap-3 mt-1.5">
                        <Badge variant="outline" className="text-[10px] h-5 px-1.5">
                          {quiz.total_questions} questions
                        </Badge>
                        {quiz.best_score !== undefined && (
                          <Badge variant="secondary" className="text-[10px] h-5 px-1.5 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                            Best: {Math.round(quiz.best_score)}%
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
            <p className="text-sm font-medium text-foreground mb-2">No quizzes yet</p>
            <p className="text-xs text-muted-foreground max-w-xs">
              Set your options above and generate a quiz
            </p>
          </div>
        )}
      </div>
    </ScrollArea>
  );
};

export default DocumentQuizzesView;
