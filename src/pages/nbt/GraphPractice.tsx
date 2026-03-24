import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import GraphRenderer from '@/components/study/GraphRenderer';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  BarChart3, 
  LineChart, 
  PieChart, 
  TrendingUp, 
  ArrowLeft, 
  ChevronRight,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Clock,
  Award,
  Zap,
  Loader2,
  Brain,
  Sparkles,
  Target,
  History,
  RotateCcw,
  Play
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import AppLayout from '@/components/layout/AppLayout';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useAIContext } from '@/contexts/AIContext';

interface Question {
  id: string;
  question: string;
  options: string[];
  correctAnswer: number;
  explanation: string;
  graphData?: any;
  graphIndex?: number; // which graph group this belongs to
}

interface PracticeHistoryItem {
  id: string;
  graph_type: string;
  difficulty: string;
  total_questions: number;
  correct_answers: number;
  score_percentage: number;
  time_taken_seconds: number;
  completed_at: string;
  questions_data: any;
}

const GraphPractice = () => {
  const { type } = useParams<{ type: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const { setAiContext } = useAIContext();
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [isAnswered, setIsAnswered] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(600);
  const [startTime, setStartTime] = useState<number>(0);
  const [isGenerating, setIsGenerating] = useState(false);
  const [questionCount, setQuestionCount] = useState(5);
  const [nbtSection, setNbtSection] = useState<'MAT' | 'AQL'>('AQL');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [hasStarted, setHasStarted] = useState(false);
  const [practiceHistory, setPracticeHistory] = useState<PracticeHistoryItem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const graphTypeInfo = {
    'bar-chart': { title: 'Bar Chart Analysis', icon: BarChart3, color: 'text-blue-500', chartType: 'bar' },
    'line-graph': { title: 'Line Graph Trends', icon: LineChart, color: 'text-green-500', chartType: 'line' },
    'pie-chart': { title: 'Pie Chart Percentages', icon: PieChart, color: 'text-purple-500', chartType: 'pie' },
    'trend-analysis': { title: 'Trend Analysis', icon: TrendingUp, color: 'text-amber-500', chartType: 'line' },
  }[type || 'bar-chart'] || { title: 'Data Interpretation', icon: BarChart3, color: 'text-primary', chartType: 'bar' };

  // Update AI context whenever the current question changes
  useEffect(() => {
    if (!hasStarted || !questions.length) return;
    const q = questions[currentQuestionIndex];
    if (!q) return;
    
    setAiContext({
      currentPage: 'nbt-graph-practice',
      location: `NBT Graph Practice - ${graphTypeInfo.title}`,
      activeDocument: {
        id: `graph-practice-${type}`,
        name: `${graphTypeInfo.title} Practice`,
        type: 'graph-practice',
        content: JSON.stringify({
          currentQuestion: {
            question: q.question,
            options: q.options,
            correctAnswer: q.options[q.correctAnswer],
            explanation: q.explanation,
          },
          graphData: q.graphData,
          questionNumber: currentQuestionIndex + 1,
          totalQuestions: questions.length,
          graphType: type,
          isAnswered,
          selectedAnswer: selectedOption !== null ? q.options[selectedOption] : null,
        }),
      },
    });
  }, [currentQuestionIndex, hasStarted, questions, isAnswered, selectedOption]);

  // Fetch past practice history
  useEffect(() => {
    const fetchHistory = async () => {
      if (!user) return;
      setLoadingHistory(true);
      try {
        const { data, error } = await supabase
          .from('graph_practice_history')
          .select('*')
          .eq('user_id', user.id)
          .eq('graph_type', type || 'bar-chart')
          .order('created_at', { ascending: false })
          .limit(10);

        if (error) {
          console.error('Error fetching practice history:', error);
        } else if (data) {
          setPracticeHistory(data as PracticeHistoryItem[]);
        }
      } catch (err) {
        console.error('Unexpected error fetching practice history:', err);
      } finally {
        setLoadingHistory(false);
      }
    };

    fetchHistory();
  }, [user, type]);

  const savePracticeResult = async () => {
    if (!user) return;
    try {
      const timeTaken = Math.round((Date.now() - startTime) / 1000);
      const percentage = Math.round((score / questions.length) * 100);

      // Save questions WITH graphData so retakes preserve the graph
      const { data: insertData, error: insertError } = await supabase.from('graph_practice_history').insert([{
        user_id: user.id,
        graph_type: type || 'bar-chart',
        total_questions: questions.length,
        correct_answers: score,
        score_percentage: percentage,
        time_taken_seconds: timeTaken,
        questions_data: questions as any,
      }]);

      if (insertError) {
        console.error('Error inserting practice result:', insertError);
        toast({
          title: 'Failed to Save Results',
          description: insertError.message || 'Could not save your practice session. Please try again.',
          variant: 'destructive',
        });
        return;
      }

      toast({
        title: 'Results Saved',
        description: 'Your practice session has been saved successfully.',
        variant: 'default',
      });

      const { data: historyData, error: fetchError } = await supabase
        .from('graph_practice_history')
        .select('*')
        .eq('user_id', user.id)
        .eq('graph_type', type || 'bar-chart')
        .order('created_at', { ascending: false })
        .limit(10);

      if (fetchError) {
        console.error('Error fetching practice history:', fetchError);
      } else if (historyData) {
        setPracticeHistory(historyData as PracticeHistoryItem[]);
      }
    } catch (err: any) {
      console.error('Error saving practice result:', err);
      toast({
        title: 'Error',
        description: err.message || 'Failed to save practice session.',
        variant: 'destructive',
      });
    }
  };

  const handleRetakePast = (item: PracticeHistoryItem) => {
    if (!item.questions_data || !Array.isArray(item.questions_data) || item.questions_data.length === 0) {
      toast({ title: 'Cannot Retake', description: 'This session has no saved question data.', variant: 'destructive' });
      return;
    }
    const pastQuestions = item.questions_data as Question[];
    // Re-shuffle options for each question
    const reshuffled = pastQuestions.map((q: any) => {
      const correctAnswerText = q.options?.[q.correctAnswer];
      if (!correctAnswerText || !q.options) return q;
      const shuffled = [...q.options].sort(() => Math.random() - 0.5);
      return {
        ...q,
        options: shuffled,
        correctAnswer: shuffled.indexOf(correctAnswerText),
      };
    });
    
    setQuestions(reshuffled);
    setHasStarted(true);
    setStartTime(Date.now());
    setTimeLeft(reshuffled.length * 120);
    setCurrentQuestionIndex(0);
    setSelectedOption(null);
    setIsAnswered(false);
    setScore(0);
    setShowResults(false);
  };

  const handleGenerateQuestions = async () => {
    setIsGenerating(true);
    try {
      // Use selected nbtSection from state
      const topicMap: Record<string, string> = {
        'bar-chart': 'NBT bar chart data interpretation',
        'line-graph': 'NBT line graph and trend analysis',
        'pie-chart': 'NBT pie chart percentage calculations',
        'trend-analysis': 'NBT trend analysis and extrapolation',
      };

      const { data, error } = await supabase.functions.invoke('generate-graph-questions', {
        body: {
          numQuestions: questionCount,
          topic: topicMap[type || 'bar-chart'] || 'NBT data interpretation',
          nbtSection,
        }
      });

      if (error) throw error;

      // New structure: data.graphs is an array of graph scenarios, each with subQuestions
      const graphs = data?.graphs || data?.questions || [];
      
      if (!graphs || graphs.length === 0) {
        throw new Error('No graph data received from generator');
      }

      // Flatten: each subQuestion becomes its own Question, sharing the parent graphData
      const mappedQuestions: Question[] = [];
      let globalIndex = 0;

      for (let graphIdx = 0; graphIdx < graphs.length; graphIdx++) {
        const graph = graphs[graphIdx];
        const subQuestions = graph.subQuestions || [];
        const graphDataForGroup = graph.graphData;

        for (let sqIdx = 0; sqIdx < subQuestions.length && globalIndex < questionCount; sqIdx++) {
          const subQ = subQuestions[sqIdx];

          // Use the options array directly from the API (already formatted with letters)
          let options = subQ.options || [];

          // If options is empty, create placeholder options
          if (!options || options.length === 0) {
            options = ['A) Option A', 'B) Option B', 'C) Option C', 'D) Option D'];
          }

          // Handle case where answer is just a letter (A/B/C/D)
          let correctIndex = 0;
          const answerLetter = subQ.answer || 'A';

          if (answerLetter.length === 1) {
            // It's a letter, find the corresponding index
            correctIndex = answerLetter.charCodeAt(0) - 65; // A=0, B=1, C=2, D=3
          } else {
            // Find the index of the correct answer text in options
            correctIndex = options.findIndex((opt: string) => opt.includes(answerLetter));
            if (correctIndex === -1) correctIndex = 0;
          }

          // Ensure correctIndex is valid
          correctIndex = Math.min(correctIndex, options.length - 1);

          // Shuffle options but track the correct answer
          const correctAnswerText = options[correctIndex];
          const shuffled = [...options].sort(() => Math.random() - 0.5);
          const newCorrectIndex = shuffled.indexOf(correctAnswerText);

          mappedQuestions.push({
            id: globalIndex.toString(),
            question: subQ.question || `Question ${globalIndex + 1}`,
            options: shuffled,
            correctAnswer: newCorrectIndex,
            explanation: subQ.calculation || subQ.explanation || `Answer: ${correctAnswerText}`,
            graphData: graphDataForGroup, // same graph for all questions in this group
            graphIndex: graphIdx,
          });
          globalIndex++;
        }
      }
      
      if (mappedQuestions.length === 0) {
        throw new Error('Could not map any questions from the response');
      }

      setQuestions(mappedQuestions);
      setHasStarted(true);
      setStartTime(Date.now());
      setTimeLeft(questionCount * 120);
    } catch (err: any) {
      console.error('Error generating questions:', err);
      toast({
        title: 'Generation Failed',
        description: err.message || 'Failed to generate NBT interpretation questions.',
        variant: 'destructive',
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const currentQuestion = questions[currentQuestionIndex] || questions[0];

  // Show which graph group we're on
  const currentGraphGroup = currentQuestion?.graphIndex ?? 0;
  const questionsInCurrentGroup = questions.filter(q => q.graphIndex === currentGraphGroup);
  const questionWithinGroup = questionsInCurrentGroup.findIndex(q => q.id === currentQuestion?.id) + 1;

  useEffect(() => {
    if (hasStarted && timeLeft > 0 && !showResults) {
      const timer = setInterval(() => setTimeLeft(prev => prev - 1), 1000);
      return () => clearInterval(timer);
    }
  }, [timeLeft, showResults, hasStarted]);

  const handleOptionSelect = (index: number) => {
    if (isAnswered) return;
    setSelectedOption(index);
  };

  const handleCheckAnswer = () => {
    if (selectedOption === null) return;
    setIsAnswered(true);
    if (selectedOption === currentQuestion.correctAnswer) {
      setScore(prev => prev + 1);
    }
  };

  const handleNextQuestion = () => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
      setSelectedOption(null);
      setIsAnswered(false);
    } else {
      setShowResults(true);
      savePracticeResult();
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const resetPractice = () => {
    setHasStarted(false);
    setShowResults(false);
    setCurrentQuestionIndex(0);
    setSelectedOption(null);
    setIsAnswered(false);
    setScore(0);
    setQuestions([]);
  };

  // Render the appropriate chart based on the CURRENT question's graphData
  const renderChart = () => {
    const activeGraphData = currentQuestion?.graphData;
    
    if (!activeGraphData) {
      const Icon = graphTypeInfo.icon;
      return (
        <div className="w-full h-full border-2 border-dashed border-border rounded-xl flex items-center justify-center bg-secondary/10 min-h-[280px]">
          <div className="text-center space-y-3">
            <Icon className={cn("w-16 h-16 mx-auto opacity-20", graphTypeInfo.color)} />
            <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
              {graphTypeInfo.title} Data View
            </p>
          </div>
        </div>
      );
    }

    // Math function graphs (MAT section)
    if (activeGraphData.functions && activeGraphData.functions.length > 0) {
      return (
        <GraphRenderer 
          data={{
            functions: activeGraphData.functions,
            points: activeGraphData.points || [],
            shapes: activeGraphData.shapes || [],
            config: activeGraphData.config || { xMin: -10, xMax: 10, yMin: -10, yMax: 10, step: 2 }
          }}
          width={380}
          height={380}
        />
      );
    }

    // Data interpretation charts
    if (activeGraphData.labels && activeGraphData.datasets) {
      const labels = activeGraphData.labels || [];
      const dataset = activeGraphData.datasets?.[0] || { data: [], label: '' };
      const values = dataset.data || [];
      const maxValue = Math.max(...values, 1);
      const chartType = graphTypeInfo.chartType;

      // PIE CHART
      if (chartType === 'pie' || type === 'pie-chart') {
        const total = values.reduce((a: number, b: number) => a + b, 0);
        const colors = [
          'hsl(var(--primary))', 'hsl(220, 70%, 55%)', 'hsl(280, 60%, 55%)', 
          'hsl(340, 65%, 50%)', 'hsl(160, 55%, 45%)', 'hsl(40, 80%, 50%)',
          'hsl(200, 65%, 50%)', 'hsl(120, 50%, 45%)'
        ];
        let cumulativeAngle = 0;

        return (
          <div className="w-full flex flex-col items-center gap-4 p-4">
            <h4 className="text-center font-bold text-foreground text-sm">{activeGraphData.title || 'Pie Chart'}</h4>
            <svg viewBox="0 0 200 200" className="w-full max-w-[250px]">
              {values.map((value: number, i: number) => {
                const percentage = total > 0 ? value / total : 0;
                const angle = percentage * 360;
                const startAngle = cumulativeAngle;
                cumulativeAngle += angle;
                
                const startRad = (startAngle - 90) * (Math.PI / 180);
                const endRad = (startAngle + angle - 90) * (Math.PI / 180);
                const largeArc = angle > 180 ? 1 : 0;
                
                const x1 = 100 + 80 * Math.cos(startRad);
                const y1 = 100 + 80 * Math.sin(startRad);
                const x2 = 100 + 80 * Math.cos(endRad);
                const y2 = 100 + 80 * Math.sin(endRad);
                
                const midRad = ((startAngle + angle / 2) - 90) * (Math.PI / 180);
                const labelX = 100 + 55 * Math.cos(midRad);
                const labelY = 100 + 55 * Math.sin(midRad);

                return (
                  <g key={i}>
                    <path
                      d={`M 100 100 L ${x1} ${y1} A 80 80 0 ${largeArc} 1 ${x2} ${y2} Z`}
                      fill={colors[i % colors.length]}
                      stroke="hsl(var(--background))"
                      strokeWidth="2"
                    />
                    {percentage > 0.05 && (
                      <text x={labelX} y={labelY} textAnchor="middle" dominantBaseline="middle" fontSize="10" fontWeight="bold" fill="white" stroke="none">
                        {Math.round(percentage * 100)}%
                      </text>
                    )}
                  </g>
                );
              })}
            </svg>
            <div className="flex flex-wrap justify-center gap-2">
              {labels.map((label: string, i: number) => (
                <div key={i} className="flex items-center gap-1.5 text-xs">
                  <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: colors[i % colors.length] }} />
                  <span className="text-muted-foreground">{label}</span>
                </div>
              ))}
            </div>
          </div>
        );
      }

      // LINE GRAPH
      if (chartType === 'line' || type === 'line-graph' || type === 'trend-analysis') {
        const padding = 40;
        const chartW = 350;
        const chartH = 250;
        const innerW = chartW - padding * 2;
        const innerH = chartH - padding * 2;
        
        const points = values.map((v: number, i: number) => {
          const x = padding + (labels.length > 1 ? (i / (labels.length - 1)) * innerW : innerW / 2);
          const y = padding + innerH - (maxValue > 0 ? (v / maxValue) * innerH : 0);
          return { x, y, value: v };
        });

        return (
          <div className="w-full flex flex-col items-center gap-2 p-4">
            <h4 className="text-center font-bold text-foreground text-sm">{activeGraphData.title || 'Line Graph'}</h4>
            <svg viewBox={`0 0 ${chartW} ${chartH}`} className="w-full">
              {[0, 0.25, 0.5, 0.75, 1].map(pct => {
                const y = padding + innerH - pct * innerH;
                return <line key={pct} x1={padding} y1={y} x2={padding + innerW} y2={y} stroke="hsl(var(--border))" strokeWidth="0.5" />;
              })}
              <polyline
                points={points.map((p: any) => `${p.x},${p.y}`).join(' ')}
                fill="none"
                stroke="hsl(var(--primary))"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {points.map((p: any, i: number) => (
                <g key={i}>
                  <circle cx={p.x} cy={p.y} r="4" fill="hsl(var(--primary))" stroke="hsl(var(--background))" strokeWidth="2" />
                  <text x={p.x} y={p.y - 10} textAnchor="middle" fontSize="10" fontWeight="bold" fill="hsl(var(--foreground))">{p.value}</text>
                  <text x={p.x} y={chartH - 5} textAnchor="middle" fontSize="9" fill="hsl(var(--muted-foreground))">
                    {labels[i]?.length > 6 ? labels[i].substring(0, 6) + '..' : labels[i]}
                  </text>
                </g>
              ))}
            </svg>
          </div>
        );
      }

      // BAR CHART (default)
      return (
        <div className="w-full min-h-[280px] p-4 flex flex-col">
          <h4 className="text-center font-bold mb-4 text-foreground text-sm">{activeGraphData.title || 'Data'}</h4>
          <div className="flex items-end justify-center gap-2 sm:gap-3 flex-1 min-h-[220px]">
            {labels.map((label: string, i: number) => {
              const value = values[i] || 0;
              const heightPct = maxValue > 0 ? (value / maxValue) * 100 : 0;
              return (
                <div key={i} className="flex flex-col items-center gap-1 flex-1 max-w-[60px]">
                  <span className="text-xs font-bold text-foreground">{value}</span>
                  <div 
                    className="w-full bg-primary/80 rounded-t-lg transition-all" 
                    style={{ height: `${Math.max(heightPct * 2, 10)}px` }}
                  />
                  <span className="text-[9px] sm:text-[10px] text-muted-foreground text-center leading-tight break-words max-w-full">
                    {label.length > 8 ? label.substring(0, 8) + '..' : label}
                  </span>
                </div>
              );
            })}
          </div>
          {dataset.label && (
            <p className="text-center text-xs text-muted-foreground mt-2">{dataset.label}</p>
          )}
        </div>
      );
    }

    // Fallback
    const Icon = graphTypeInfo.icon;
    return (
      <div className="w-full h-full border-2 border-dashed border-border rounded-xl flex items-center justify-center bg-secondary/10 min-h-[280px]">
        <div className="text-center space-y-3">
          <Icon className={cn("w-16 h-16 mx-auto opacity-20", graphTypeInfo.color)} />
          <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
            {graphTypeInfo.title} Data View
          </p>
        </div>
      </div>
    );
  };

  if (showResults) {
    const percentage = questions.length > 0 ? Math.round((score / questions.length) * 100) : 0;
    return (
      <AppLayout>
        <div className="max-w-2xl mx-auto py-12 text-center space-y-8 px-6">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="w-24 h-24 bg-primary/20 rounded-full flex items-center justify-center mx-auto mb-4"
          >
            <Award className="w-12 h-12 text-primary" />
          </motion.div>
          <div className="space-y-2">
            <h1 className="text-4xl font-black">Practice Complete!</h1>
            <p className="text-muted-foreground text-lg">Great work on mastering {graphTypeInfo.title}</p>
          </div>

          <Card className="border-none shadow-xl bg-secondary/30">
            <CardContent className="p-10">
              <div className="grid grid-cols-2 gap-8">
                <div>
                  <p className="text-sm font-bold text-muted-foreground uppercase tracking-widest mb-1">Your Score</p>
                  <p className="text-5xl font-black text-foreground">{score}/{questions.length}</p>
                </div>
                <div>
                  <p className="text-sm font-bold text-muted-foreground uppercase tracking-widest mb-1">Accuracy</p>
                  <p className="text-5xl font-black text-primary">{percentage}%</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
            <Button variant="outline" onClick={() => navigate('/nbt')} className="rounded-full px-8 h-12 font-bold">
              Back to NBT Hub
            </Button>
            <Button onClick={resetPractice} className="rounded-full px-8 h-12 font-bold shadow-lg shadow-primary/20">
              <RotateCcw className="w-4 h-4 mr-2" />
              New Practice Session
            </Button>
          </div>
        </div>
      </AppLayout>
    );
  }

  if (!hasStarted) {
    const Icon = graphTypeInfo.icon;
    return (
      <AppLayout>
        {/* Generation overlay - blurred popup modal */}
        <Dialog open={isGenerating} onOpenChange={() => {}}>
          <DialogContent className="sm:max-w-md [&>button]:hidden" onPointerDownOutside={(e) => e.preventDefault()} onEscapeKeyDown={(e) => e.preventDefault()}>
            <div className="flex flex-col items-center text-center px-2 py-6 space-y-6">
              <div className="w-20 h-20 bg-primary/20 rounded-full flex items-center justify-center animate-pulse">
                <Sparkles className="w-10 h-10 text-primary" />
              </div>
              <div className="space-y-2">
                <h2 className="text-xl font-black text-foreground">Generating Questions...</h2>
                <p className="text-muted-foreground text-sm">Creating NBT-focused {graphTypeInfo.title.toLowerCase()} questions. Please wait.</p>
              </div>
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          </DialogContent>
        </Dialog>

        <div className="max-w-4xl mx-auto py-6 sm:py-12 px-4 sm:px-6">
          <Button variant="ghost" size="sm" onClick={() => navigate('/nbt')} className="mb-6 sm:mb-8 text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to NBT Hub
          </Button>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8">
            {/* Main Setup */}
            <div className="lg:col-span-2 flex flex-col items-center text-center space-y-6">
              <div className={cn("w-16 h-16 sm:w-20 sm:h-20 rounded-3xl bg-primary/10 flex items-center justify-center mb-4 ring-8 ring-primary/5", graphTypeInfo.color)}>
                <Icon className="w-8 h-8 sm:w-10 sm:h-10" />
              </div>

              <div className="space-y-2">
                <h1 className="text-2xl sm:text-4xl font-black text-foreground">{graphTypeInfo.title}</h1>
                <p className="text-muted-foreground text-sm sm:text-lg max-w-xl">
                  Master data interpretation with AI-generated practice questions designed for the NBT.
                </p>
              </div>

              <Card className="w-full border-none bg-secondary/30 shadow-sm mt-8">
                <CardContent className="p-4 sm:p-8 space-y-6">
                  {/* NBT Section Selection */}
                  <div className="space-y-4">
                    <label className="text-sm font-bold text-muted-foreground uppercase tracking-widest text-left block">
                      NBT Section
                    </label>
                    <div className="grid grid-cols-2 gap-2 sm:gap-3">
                      {['MAT', 'AQL'].map((section) => (
                        <button
                          key={section}
                          onClick={() => setNbtSection(section as any)}
                          className={cn(
                            "py-3 rounded-xl border-2 font-bold transition-all text-sm sm:text-base",
                            nbtSection === section
                              ? "border-primary bg-primary text-primary-foreground shadow-lg shadow-primary/20"
                              : "border-border bg-background hover:border-primary/30"
                          )}
                        >
                          {section}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Question Count Selection */}
                  <div className="space-y-4">
                    <label className="text-sm font-bold text-muted-foreground uppercase tracking-widest text-left block">
                      Number of Questions
                    </label>
                    <div className="grid grid-cols-4 gap-2 sm:gap-3">
                      {[5, 10, 15, 20].map((count) => (
                        <button
                          key={count}
                          onClick={() => setQuestionCount(count)}
                          className={cn(
                            "py-3 rounded-xl border-2 font-bold transition-all text-sm sm:text-base",
                            questionCount === count
                              ? "border-primary bg-primary text-primary-foreground shadow-lg shadow-primary/20"
                              : "border-border bg-background hover:border-primary/30"
                          )}
                        >
                          {count}
                        </button>
                      ))}
                    </div>
                  </div>

                  <Button
                    onClick={handleGenerateQuestions}
                    disabled={isGenerating}
                    className="w-full rounded-2xl py-6 sm:py-8 font-black text-lg sm:text-xl shadow-xl shadow-primary/20 h-auto"
                  >
                    <Sparkles className="w-5 h-5 sm:w-6 sm:h-6 mr-2 sm:mr-3" />
                    Generate {questionCount} Questions
                  </Button>
                </CardContent>
              </Card>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full pt-10">
                <div className="flex flex-col items-center p-4">
                  <Brain className="w-6 h-6 text-primary mb-2" />
                  <p className="font-bold text-sm">AI-Powered</p>
                  <p className="text-xs text-muted-foreground mt-1">Personalized content based on your skill level</p>
                </div>
                <div className="flex flex-col items-center p-4">
                  <Target className="w-6 h-6 text-primary mb-2" />
                  <p className="font-bold text-sm">NBT Aligned</p>
                  <p className="text-xs text-muted-foreground mt-1">Content focused on actual NBT standards</p>
                </div>
                <div className="flex flex-col items-center p-4">
                  <Zap className="w-6 h-6 text-primary mb-2" />
                  <p className="font-bold text-sm">Instant Feedback</p>
                  <p className="text-xs text-muted-foreground mt-1">Detailed explanations for every answer</p>
                </div>
              </div>
            </div>

            {/* Past Practice History Sidebar */}
            <div className="space-y-4">
              <h3 className="text-lg font-black flex items-center gap-2">
                <History className="w-5 h-5 text-primary" />
                Past Practice
              </h3>
              {loadingHistory ? (
                <div className="text-center py-8 text-muted-foreground text-sm">Loading history...</div>
              ) : practiceHistory.length === 0 ? (
                <Card className="border-dashed border-2 border-border">
                  <CardContent className="p-6 text-center">
                    <p className="text-muted-foreground text-sm">No past practice sessions yet. Start your first one!</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-3 max-h-[500px] overflow-y-auto">
                  {practiceHistory.map((item) => {
                    const scoreColor = item.score_percentage >= 80 ? 'text-green-600' : item.score_percentage >= 50 ? 'text-amber-600' : 'text-red-600';
                    const hasQuestionData = item.questions_data && Array.isArray(item.questions_data) && item.questions_data.length > 0;
                    return (
                      <Card key={item.id} className="hover:shadow-md transition-shadow">
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between mb-2">
                            <Badge variant="outline" className="capitalize text-xs">{item.difficulty}</Badge>
                            <span className={cn("text-2xl font-black", scoreColor)}>{item.score_percentage}%</span>
                          </div>
                          <div className="flex items-center justify-between text-xs text-muted-foreground">
                            <span>{item.correct_answers}/{item.total_questions} correct</span>
                            <span>{new Date(item.completed_at).toLocaleDateString()}</span>
                          </div>
                          {item.time_taken_seconds > 0 && (
                            <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                              <Clock className="w-3 h-3" />
                              {formatTime(item.time_taken_seconds)}
                            </div>
                          )}
                          {hasQuestionData && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="w-full mt-3 rounded-lg text-xs font-bold"
                              onClick={() => handleRetakePast(item)}
                            >
                              <Play className="w-3 h-3 mr-1.5" />
                              Retake
                            </Button>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-5xl mx-auto space-y-4 sm:space-y-6 px-3 sm:px-0">
        {/* Header */}
        <div className="flex items-center justify-between gap-2">
          <Button variant="ghost" size="sm" onClick={() => navigate('/nbt')} className="text-muted-foreground px-2 sm:px-3">
            <ArrowLeft className="w-4 h-4 sm:mr-2" />
            <span className="hidden sm:inline">Exit Practice</span>
          </Button>
          <div className="flex items-center gap-2 sm:gap-4">
            <Badge variant="secondary" className="text-xs">
              Graph {currentGraphGroup + 1} · Q{questionWithinGroup}
            </Badge>
            <div className="flex items-center gap-1 sm:gap-2 bg-secondary/50 px-2 sm:px-4 py-1.5 sm:py-2 rounded-full font-mono text-xs sm:text-sm">
              <Clock className="w-3 h-3 sm:w-4 sm:h-4 text-primary" />
              {formatTime(timeLeft)}
            </div>
            <div className="text-xs sm:text-sm font-bold text-muted-foreground uppercase tracking-widest">
              {currentQuestionIndex + 1}/{questions.length}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-8">
          {/* Left: Graph/Chart Area */}
          <div className="space-y-4">
            <Card className="border-none shadow-md bg-card flex items-center justify-center relative overflow-hidden group">
              <div className="p-4 w-full h-full flex flex-col items-center justify-center">
                {renderChart()}
              </div>
            </Card>
            <Card className="border-none shadow-sm bg-primary/5">
              <CardContent className="p-4 flex gap-3 text-sm">
                <HelpCircle className="w-5 h-5 text-primary shrink-0" />
                <p className="text-muted-foreground italic">
                  Tip: This graph is shared across {questionsInCurrentGroup.length} questions. Analyze it carefully before answering.
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Right: Question & Options */}
          <div className="space-y-6">
            <div className="space-y-4">
              <h2 className="text-lg sm:text-2xl font-bold text-foreground leading-snug">
                {currentQuestion?.question || 'Loading...'}
              </h2>
              <Progress value={(currentQuestionIndex / questions.length) * 100} className="h-1.5" />
            </div>

            <div className="space-y-3">
              {currentQuestion?.options?.map((option, index) => (
                <button
                  key={index}
                  onClick={() => handleOptionSelect(index)}
                  className={cn(
                    "w-full text-left p-4 sm:p-5 rounded-2xl border-2 transition-all duration-200 group relative overflow-hidden",
                    selectedOption === index 
                      ? "border-primary bg-primary/5 shadow-md" 
                      : "border-border hover:border-primary/30 hover:bg-secondary/30",
                    isAnswered && index === currentQuestion.correctAnswer && "border-green-500 bg-green-500/10",
                    isAnswered && selectedOption === index && index !== currentQuestion.correctAnswer && "border-destructive bg-destructive/10"
                  )}
                >
                  <div className="flex items-center gap-3 sm:gap-4">
                    <div className={cn(
                      "w-8 h-8 sm:w-10 sm:h-10 rounded-xl border-2 flex items-center justify-center font-bold text-xs sm:text-sm transition-colors shrink-0",
                      selectedOption === index ? "border-primary bg-primary text-primary-foreground" : "border-border group-hover:border-primary/50"
                    )}>
                      {String.fromCharCode(65 + index)}
                    </div>
                    <span className="font-bold text-sm sm:text-lg break-words">{option}</span>
                  </div>
                  
                  {isAnswered && index === currentQuestion.correctAnswer && (
                    <CheckCircle2 className="absolute top-1/2 -translate-y-1/2 right-4 sm:right-6 w-5 h-5 sm:w-6 sm:h-6 text-green-500" />
                  )}
                  {isAnswered && selectedOption === index && index !== currentQuestion.correctAnswer && (
                    <AlertCircle className="absolute top-1/2 -translate-y-1/2 right-4 sm:right-6 w-5 h-5 sm:w-6 sm:h-6 text-destructive" />
                  )}
                </button>
              ))}
            </div>

            <AnimatePresence>
              {isAnswered && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  className="overflow-hidden"
                >
                  <Card className={cn(
                    "border-none shadow-sm",
                    selectedOption === currentQuestion.correctAnswer ? "bg-green-500/5" : "bg-destructive/5"
                  )}>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
                        {selectedOption === currentQuestion.correctAnswer ? (
                          <><CheckCircle2 className="w-4 h-4 text-green-500" /> Correct!</>
                        ) : (
                          <><AlertCircle className="w-4 h-4 text-destructive" /> Incorrect</>
                        )}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-muted-foreground whitespace-pre-line text-sm">{currentQuestion.explanation}</p>
                    </CardContent>
                  </Card>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="pt-4">
              {!isAnswered ? (
                <Button 
                  onClick={handleCheckAnswer} 
                  disabled={selectedOption === null}
                  className="w-full rounded-full py-6 sm:py-7 font-black text-lg sm:text-xl shadow-lg shadow-primary/20"
                >
                  Check Answer
                </Button>
              ) : (
                <Button 
                  onClick={handleNextQuestion} 
                  className="w-full rounded-full py-6 sm:py-7 font-black text-lg sm:text-xl shadow-lg shadow-primary/20"
                >
                  {currentQuestionIndex === questions.length - 1 ? 'See Results' : 'Next Question'}
                  <ChevronRight className="w-6 h-6 ml-2" />
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default GraphPractice;
