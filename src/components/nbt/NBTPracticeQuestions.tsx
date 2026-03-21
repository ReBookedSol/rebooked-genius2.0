import { motion } from 'framer-motion';
import { Target, Clock, BarChart3, Plus, CheckCircle2, AlertCircle, FileText, Loader2, ChevronRight, BookOpen } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNBTPracticeTests, useNBTTestAttempts } from '@/hooks/use-nbt-practice-tests';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
  DialogDescription
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

interface NBTTest {
  id: string;
  title: string;
  date: string;
  score: number;
  maxScore: number;
  duration: number;
  section?: string;
}

interface NBTPracticeQuestionsProps {
  onTestCreated: (test: NBTTest) => void;
}

// NBT MAT topics based on official exemplar structure
const MAT_TOPICS = [
  'Functions and their Graphs',
  'Algebraic Processes',
  'Number Sense',
  'Transformations',
  'Trigonometry',
  'Spatial Awareness',
  'Data Handling & Probability',
  'Calculus',
  'Sequences & Series',
  'Financial Mathematics',
];

// NBT AQL topics based on official exemplar structure  
const AQL_TOPICS = [
  'Academic Literacy - Comprehension',
  'Academic Literacy - Vocabulary',
  'Academic Literacy - Grammar & Syntax',
  'Academic Literacy - Inferencing',
  'Academic Literacy - Critical Reasoning',
  'Quantitative Literacy - Data Interpretation',
  'Quantitative Literacy - Percentages & Ratios',
  'Quantitative Literacy - Tables & Charts',
  'Quantitative Literacy - Probability',
  'Quantitative Literacy - Financial Calculations',
];

const NBTPracticeQuestions = ({ onTestCreated }: NBTPracticeQuestionsProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Simplified creation: mode (full/topic), section, topic, question count
  const [testMode, setTestMode] = useState<'full' | 'topic'>('full');
  const [testSection, setTestSection] = useState<'AQL' | 'MAT'>('AQL');
  const [selectedTopic, setSelectedTopic] = useState('');
  const [questionCount, setQuestionCount] = useState('50');

  const { tests, loading: testsLoading, error: testsError, createTest } = useNBTPracticeTests({ onlyPublished: false });
  const { attempts } = useNBTTestAttempts();

  const currentTopics = testSection === 'MAT' ? MAT_TOPICS : AQL_TOPICS;

  // Reset topic when section changes
  useEffect(() => {
    setSelectedTopic('');
  }, [testSection]);

  // Auto-set question count based on mode
  useEffect(() => {
    if (testMode === 'full') {
      setQuestionCount('50');
    } else {
      setQuestionCount('10');
    }
  }, [testMode]);

  const handleCreateTest = async () => {
    if (!user) return;

    const title = testMode === 'full'
      ? `Full ${testSection} Test`
      : `${testSection}: ${selectedTopic}`;

    if (testMode === 'topic' && !selectedTopic) {
      toast({ title: 'Select a topic', description: 'Please select a topic for your test.', variant: 'destructive' });
      return;
    }

    try {
      setIsSubmitting(true);

      const createdTest = await createTest({
        user_id: user.id,
        title,
        description: testMode === 'full' 
          ? `Full ${testSection} simulation with ${questionCount} questions`
          : `Topic-specific: ${selectedTopic}`,
        section: testSection,
        time_limit_minutes: testMode === 'full' ? 120 : 30,
        total_questions: parseInt(questionCount),
        is_published: false,
        is_official: false,
      } as any);

      toast({ title: 'Test created!', description: 'You can now generate questions.' });
      setIsCreateModalOpen(false);
      resetCreation();

      if (createdTest?.id) {
        const params = new URLSearchParams({ section: testSection });
        if (testMode === 'topic' && selectedTopic) params.set('topic', selectedTopic);
        navigate(`/nbt/test/${createdTest.id}?${params.toString()}`);
      }
    } catch (error) {
      console.error('Error creating custom test:', error);
      toast({ title: 'Error', description: 'Failed to create test.', variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetCreation = () => {
    setTestMode('full');
    setTestSection('AQL');
    setSelectedTopic('');
    setQuestionCount('50');
  };

  const containerVariants = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.1 } } };
  const itemVariants = { hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0, transition: { duration: 0.5 } } };

  const handleStartTest = (test: any) => {
    if (test.id.startsWith('demo-')) {
      toast({ title: 'Demo Test', description: 'Create a custom test to start a real test.' });
      return;
    }
    navigate(`/nbt/test/${test.id}?section=${test.section || 'AQL'}`);
  };

  const getTestAttempt = (testId: string) => attempts?.find((a: any) => a.test_id === testId);

  const TestCard = ({ test }: { test: any }) => {
    const attempt = getTestAttempt(test.id);
    return (
      <button
        onClick={() => handleStartTest(test)}
        className="w-full p-4 bg-card border border-border/50 rounded-xl hover:border-primary/50 hover:bg-primary/5 transition-all text-left group shadow-sm hover:shadow-md"
      >
        <div className="flex items-center justify-between gap-4">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-foreground truncate group-hover:text-primary transition-colors">{test.title}</p>
            <div className="flex items-center gap-2 mt-1.5">
              <Badge variant="outline" className="text-[10px] h-5 px-1.5">
                {test.total_questions} questions
              </Badge>
              {attempt && (
                <Badge variant="secondary" className={cn(
                  "text-[10px] h-5 px-1.5",
                  (attempt.percentage || 0) >= 70 ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" :
                  (attempt.percentage || 0) >= 50 ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" :
                  "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                )}>
                  Best: {Math.round(attempt.percentage || 0)}%
                </Badge>
              )}
            </div>
          </div>
          <div className="w-8 h-8 rounded-lg bg-primary/5 flex items-center justify-center group-hover:bg-primary/10 transition-colors flex-shrink-0">
            <Target className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
          </div>
        </div>
      </button>
    );
  };

  if (testsError) {
    return (
      <div className="flex items-center gap-3 p-4 bg-destructive/10 border border-destructive/30 rounded-lg">
        <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0" />
        <p className="font-medium text-destructive">Error loading tests: {testsError}</p>
      </div>
    );
  }

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="show" className="space-y-6 w-full">
      {/* Header */}
      <motion.div variants={itemVariants}>
        <Card className="border-none shadow-md overflow-hidden bg-gradient-to-r from-primary/10 to-transparent">
          <CardContent className="p-8 flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="text-center md:text-left space-y-2">
              <h2 className="text-3xl font-black text-foreground">Practice Tests</h2>
              <p className="text-muted-foreground text-lg max-w-lg">
                Create full NBT simulations or topic-specific tests.
              </p>
            </div>
            <Dialog open={isCreateModalOpen} onOpenChange={(open) => { setIsCreateModalOpen(open); if (!open) resetCreation(); }}>
              <DialogTrigger asChild>
                <Button size="lg" className="rounded-full px-8 font-bold shadow-lg shadow-primary/20" onClick={() => setIsCreateModalOpen(true)}>
                  <Plus className="w-5 h-5 mr-2" /> Create Test
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[480px]">
                <DialogHeader>
                  <DialogTitle className="text-2xl font-black">Create NBT Test</DialogTitle>
                  <DialogDescription>Choose your test type and section</DialogDescription>
                </DialogHeader>

                <div className="space-y-6 py-4">
                  {/* Test Mode */}
                  <div className="space-y-3">
                    <Label className="text-sm font-bold">Test Type</Label>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        onClick={() => setTestMode('full')}
                        className={cn(
                          "p-4 rounded-xl border-2 font-bold transition-all text-center",
                          testMode === 'full'
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border hover:border-primary/30"
                        )}
                      >
                        <div className="text-lg mb-1">Full Test</div>
                        <div className={cn("text-xs", testMode === 'full' ? "text-primary-foreground/70" : "text-muted-foreground")}>50 questions</div>
                      </button>
                      <button
                        onClick={() => setTestMode('topic')}
                        className={cn(
                          "p-4 rounded-xl border-2 font-bold transition-all text-center",
                          testMode === 'topic'
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border hover:border-primary/30"
                        )}
                      >
                        <div className="text-lg mb-1">By Topic</div>
                        <div className={cn("text-xs", testMode === 'topic' ? "text-primary-foreground/70" : "text-muted-foreground")}>10-20 questions</div>
                      </button>
                    </div>
                  </div>

                  {/* Section */}
                  <div className="space-y-3">
                    <Label className="text-sm font-bold">Section</Label>
                    <div className="grid grid-cols-2 gap-3">
                      {(['AQL', 'MAT'] as const).map((s) => (
                        <button
                          key={s}
                          onClick={() => setTestSection(s)}
                          className={cn(
                            "p-3 rounded-xl border-2 font-bold transition-all text-center",
                            testSection === s
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-border hover:border-primary/30"
                          )}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Topic (only for topic mode) */}
                  {testMode === 'topic' && (
                    <>
                      <div className="space-y-3">
                        <Label className="text-sm font-bold">Topic</Label>
                        <Select value={selectedTopic} onValueChange={setSelectedTopic}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a topic..." />
                          </SelectTrigger>
                          <SelectContent>
                            {currentTopics.map((topic) => (
                              <SelectItem key={topic} value={topic}>{topic}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-3">
                        <Label className="text-sm font-bold">Number of Questions</Label>
                        <div className="grid grid-cols-3 gap-3">
                          {['10', '15', '20'].map((count) => (
                            <button
                              key={count}
                              onClick={() => setQuestionCount(count)}
                              className={cn(
                                "p-3 rounded-xl border-2 font-bold transition-all",
                                questionCount === count
                                  ? "border-primary bg-primary text-primary-foreground"
                                  : "border-border hover:border-primary/30"
                              )}
                            >
                              {count}
                            </button>
                          ))}
                        </div>
                      </div>
                    </>
                  )}

                  <Button 
                    className="w-full rounded-full h-12 font-bold" 
                    onClick={handleCreateTest} 
                    disabled={isSubmitting || (testMode === 'topic' && !selectedTopic)}
                  >
                    {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                    {testMode === 'full' ? `Create Full ${testSection} Test (50 questions)` : `Create ${testSection} Test`}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </CardContent>
        </Card>
      </motion.div>

      {/* Tests List */}
      <Tabs defaultValue="all-tests" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="all-tests">All Tests</TabsTrigger>
          <TabsTrigger value="past-attempts">Past Attempts</TabsTrigger>
        </TabsList>

        <TabsContent value="all-tests" className="space-y-4 mt-6">
          {testsLoading ? (
            <div className="text-center py-8"><Loader2 className="w-5 h-5 animate-spin mx-auto" /></div>
          ) : tests.length === 0 ? (
            <Card className="bg-secondary/50">
              <CardContent className="p-6 text-center">
                <AlertCircle className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">No tests yet. Create your first custom test!</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {tests.map((test) => <TestCard key={test.id} test={test} />)}
            </div>
          )}
        </TabsContent>

        <TabsContent value="past-attempts" className="space-y-4 mt-6">
          {!attempts || attempts.length === 0 ? (
            <Card className="bg-secondary/50">
              <CardContent className="p-6 text-center">
                <p className="text-muted-foreground">No past attempts yet. Complete a test first!</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {attempts.map((attempt: any) => (
                <Card key={attempt.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4 flex items-center justify-between">
                    <div>
                      <p className="font-bold">{attempt.section} Test</p>
                      <p className="text-xs text-muted-foreground">
                        {attempt.completed_at ? new Date(attempt.completed_at).toLocaleDateString() : 'N/A'} • {Math.round((attempt.time_taken_seconds || 0) / 60)} min
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge className={cn(
                        "font-bold",
                        (attempt.percentage || 0) >= 70 ? "bg-green-100 text-green-700" : (attempt.percentage || 0) >= 50 ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700"
                      )}>
                        {attempt.percentage || 0}%
                      </Badge>
                      <Button size="sm" variant="outline" onClick={() => navigate(`/nbt/test/${attempt.test_id}?section=${attempt.section}`)}>
                        Retake
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Features */}
      <motion.div variants={itemVariants}>
        <Card>
          <CardHeader><CardTitle>What's Included</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center flex-shrink-0">
                  <CheckCircle2 className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h4 className="font-medium text-foreground">Step-by-Step Solutions</h4>
                  <p className="text-sm text-muted-foreground">Detailed explanations for every question</p>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center flex-shrink-0">
                  <BarChart3 className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h4 className="font-medium text-foreground">Performance Analytics</h4>
                  <p className="text-sm text-muted-foreground">Track accuracy per topic</p>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center flex-shrink-0">
                  <Clock className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h4 className="font-medium text-foreground">Timed Mode</h4>
                  <p className="text-sm text-muted-foreground">Simulate real exam conditions</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
};

export default NBTPracticeQuestions;
