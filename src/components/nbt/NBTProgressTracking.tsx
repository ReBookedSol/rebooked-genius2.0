import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, BarChart3, Target, Award, Brain, BookOpen, Clock, Zap, CheckCircle2, LineChart, PieChart } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';

import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { LineChart as RechartsLineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { format } from 'date-fns';

interface NBTTest {
  id: string;
  title: string;
  date: string;
  score: number;
  maxScore: number;
  duration: number;
  section?: string;
}

interface NBTProgressTrackingProps {
  tests: NBTTest[];
  onManualEntry?: (test: NBTTest) => void;
}

interface GraphHistoryItem {
  id: string;
  graph_type: string;
  difficulty: string;
  total_questions: number;
  correct_answers: number;
  score_percentage: number;
  time_taken_seconds: number;
  completed_at: string;
}

const NBTProgressTracking = ({ tests: actualTests }: NBTProgressTrackingProps) => {
  const { user } = useAuth();
  const [flashcardStats, setFlashcardStats] = useState({ mastered: 0, total: 0, decks: 0 });
  const [practiceStats, setPracticeStats] = useState({ correct: 0, total: 0, sections: new Map<string, { correct: number; total: number }>() });
  const [studyTimeMinutes, setStudyTimeMinutes] = useState(0);
  const [lessonsGenerated, setLessonsGenerated] = useState(0);
  const [graphPracticeStats, setGraphPracticeStats] = useState({ sessions: 0, avgScore: 0 });
  const [graphHistory, setGraphHistory] = useState<GraphHistoryItem[]>([]);
  const [graphByType, setGraphByType] = useState<Record<string, { sessions: number; avgScore: number; totalQuestions: number; correctAnswers: number }>>({});

  useEffect(() => {
    if (!user) return;

    const fetchAll = async () => {
      // Flashcard stats
      const { data: decks } = await supabase
        .from('flashcard_decks')
        .select('id, title, total_cards, mastered_cards')
        .eq('user_id', user.id)
        .ilike('title', '%NBT%');
      if (decks) {
        const mastered = decks.reduce((sum, d) => sum + (d.mastered_cards || 0), 0);
        const total = decks.reduce((sum, d) => sum + (d.total_cards || 0), 0);
        setFlashcardStats({ mastered, total, decks: decks.length });
      }

      // Practice question stats
      const { data: attempts } = await supabase
        .from('nbt_practice_attempts')
        .select('is_correct, section')
        .eq('user_id', user.id);
      if (attempts) {
        const sections = new Map<string, { correct: number; total: number }>();
        let correct = 0;
        attempts.forEach(a => {
          if (a.is_correct) correct++;
          const existing = sections.get(a.section) || { correct: 0, total: 0 };
          existing.total++;
          if (a.is_correct) existing.correct++;
          sections.set(a.section, existing);
        });
        setPracticeStats({ correct, total: attempts.length, sections });
      }

      // Lessons generated count
      const { count: lessonCount } = await supabase
        .from('nbt_generated_lessons')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id);
      setLessonsGenerated(lessonCount || 0);

      // Graph practice history - detailed
      const { data: graphData } = await supabase
        .from('graph_practice_history')
        .select('*')
        .eq('user_id', user.id)
        .order('completed_at', { ascending: false });
      
      if (graphData && graphData.length > 0) {
        setGraphHistory(graphData as GraphHistoryItem[]);
        const avg = Math.round(graphData.reduce((s, g) => s + g.score_percentage, 0) / graphData.length);
        const totalTime = graphData.reduce((s, g) => s + (g.time_taken_seconds || 0), 0);
        setGraphPracticeStats({ sessions: graphData.length, avgScore: avg });
        setStudyTimeMinutes(prev => prev + Math.round(totalTime / 60));

        // Group by graph type
        const byType: Record<string, { sessions: number; avgScore: number; totalQuestions: number; correctAnswers: number; scores: number[] }> = {};
        graphData.forEach(g => {
          if (!byType[g.graph_type]) {
            byType[g.graph_type] = { sessions: 0, avgScore: 0, totalQuestions: 0, correctAnswers: 0, scores: [] };
          }
          byType[g.graph_type].sessions++;
          byType[g.graph_type].totalQuestions += g.total_questions;
          byType[g.graph_type].correctAnswers += g.correct_answers;
          byType[g.graph_type].scores.push(g.score_percentage);
        });
        const simplified: Record<string, { sessions: number; avgScore: number; totalQuestions: number; correctAnswers: number }> = {};
        Object.entries(byType).forEach(([key, val]) => {
          simplified[key] = {
            sessions: val.sessions,
            avgScore: val.scores.length > 0 ? Math.round(val.scores.reduce((a, b) => a + b, 0) / val.scores.length) : 0,
            totalQuestions: val.totalQuestions,
            correctAnswers: val.correctAnswers,
          };
        });
        setGraphByType(simplified);
      }

      // Study time from test attempts
      const { data: testAttempts } = await supabase
        .from('nbt_test_attempts')
        .select('time_taken_seconds')
        .eq('user_id', user.id);
      if (testAttempts) {
        const totalSec = testAttempts.reduce((s, t) => s + (t.time_taken_seconds || 0), 0);
        setStudyTimeMinutes(prev => prev + Math.round(totalSec / 60));
      }
    };

    fetchAll();
  }, [user]);

  const tests = actualTests;

  const containerVariants = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.1 } } };
  const itemVariants = { hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0, transition: { duration: 0.5 } } };

  const totalTests = tests.length;
  const avgScore = totalTests > 0
    ? Math.round(tests.reduce((sum, t) => sum + (t.score / t.maxScore) * 100, 0) / totalTests)
    : 0;
  const bestScore = totalTests > 0
    ? Math.max(...tests.map(t => (t.score / t.maxScore) * 100))
    : 0;

  const sections = ['AQL', 'MAT'];
  const sectionStats = sections.map(section => {
    const sectionTests = tests.filter(t => t.section === section);
    const avg = sectionTests.length > 0
      ? Math.round(sectionTests.reduce((sum, t) => sum + (t.score / t.maxScore) * 100, 0) / sectionTests.length)
      : 0;
    return { section, tests: sectionTests.length, average: avg };
  });

  const sectionChartData = sectionStats.map(s => ({
    section: s.section,
    average: s.average,
    tests: s.tests,
  }));

  const graphTypeLabels: Record<string, { label: string; icon: React.ReactNode }> = {
    'bar-chart': { label: 'Bar Chart', icon: <BarChart3 className="w-4 h-4" /> },
    'line-graph': { label: 'Line Graph', icon: <LineChart className="w-4 h-4" /> },
    'pie-chart': { label: 'Pie Chart', icon: <PieChart className="w-4 h-4" /> },
    'trend-analysis': { label: 'Trend Analysis', icon: <TrendingUp className="w-4 h-4" /> },
  };

  // Prepare graph score progression data
  const graphProgressionData = graphHistory
    .slice(0, 20)
    .reverse()
    .map((g, i) => ({
      name: g.completed_at ? format(new Date(g.completed_at), 'MMM d') : `#${i + 1}`,
      score: g.score_percentage,
      type: graphTypeLabels[g.graph_type]?.label || g.graph_type,
    }));

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="show" className="space-y-6 w-full">
      {/* Header */}
      <motion.div variants={itemVariants}>
        <Card className="border-none shadow-md bg-gradient-to-r from-primary/10 to-transparent">
          <CardContent className="p-8">
            <h2 className="text-3xl font-black mb-2 text-foreground flex items-center gap-3">
              <Zap className="w-8 h-8 text-primary" />
              Your Progress & Analytics
            </h2>
            <p className="text-muted-foreground text-lg">
              Comprehensive overview of your NBT preparation journey.
            </p>
          </CardContent>
        </Card>
      </motion.div>

      {/* Key Stats Grid */}
      <motion.div variants={itemVariants} className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-none shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-2">
              <Award className="w-5 h-5 text-primary" />
              <span className="text-2xl font-black text-foreground">{totalTests}</span>
            </div>
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Tests Taken</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-500/10 to-green-500/5 border-none shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-2">
              <TrendingUp className="w-5 h-5 text-green-600" />
              <span className="text-2xl font-black text-foreground">{avgScore}%</span>
            </div>
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Avg Score</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-amber-500/10 to-amber-500/5 border-none shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-2">
              <Target className="w-5 h-5 text-amber-600" />
              <span className="text-2xl font-black text-foreground">{Math.round(bestScore)}%</span>
            </div>
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Best Score</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-500/10 to-blue-500/5 border-none shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-2">
              <Clock className="w-5 h-5 text-blue-600" />
              <span className="text-2xl font-black text-foreground">{studyTimeMinutes}m</span>
            </div>
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Study Time</p>
          </CardContent>
        </Card>
      </motion.div>

      {/* Activity Summary */}
      <motion.div variants={itemVariants} className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-none shadow-sm">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <BookOpen className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-lg font-bold text-foreground">{lessonsGenerated}</p>
              <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Lessons</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Brain className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-lg font-bold text-foreground">{flashcardStats.decks}</p>
              <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Decks</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-lg font-bold text-foreground">{practiceStats.total}</p>
              <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Questions</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <BarChart3 className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-lg font-bold text-foreground">{graphPracticeStats.sessions}</p>
              <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Graph Sessions</p>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Graph Interpretation Analytics */}
      {graphPracticeStats.sessions > 0 && (
        <motion.div variants={itemVariants}>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-primary" />
                Graph Interpretation Analytics
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Summary stats */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-secondary/30 rounded-xl p-4 text-center">
                  <p className="text-2xl font-black text-foreground">{graphPracticeStats.sessions}</p>
                  <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Total Sessions</p>
                </div>
                <div className="bg-secondary/30 rounded-xl p-4 text-center">
                  <p className="text-2xl font-black text-primary">{graphPracticeStats.avgScore}%</p>
                  <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Avg Score</p>
                </div>
                <div className="bg-secondary/30 rounded-xl p-4 text-center">
                  <p className="text-2xl font-black text-foreground">
                    {Object.values(graphByType).reduce((s, v) => s + v.totalQuestions, 0)}
                  </p>
                  <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Questions Done</p>
                </div>
                <div className="bg-secondary/30 rounded-xl p-4 text-center">
                  <p className="text-2xl font-black text-foreground">
                    {Object.values(graphByType).reduce((s, v) => s + v.correctAnswers, 0)}
                  </p>
                  <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Correct</p>
                </div>
              </div>

              {/* Performance by graph type */}
              <div className="space-y-3">
                <h4 className="text-sm font-bold text-muted-foreground uppercase tracking-wider">Performance by Graph Type</h4>
                {Object.entries(graphByType).map(([graphType, stats]) => {
                  const info = graphTypeLabels[graphType] || { label: graphType, icon: <BarChart3 className="w-4 h-4" /> };
                  const accuracy = stats.totalQuestions > 0 ? Math.round((stats.correctAnswers / stats.totalQuestions) * 100) : 0;
                  return (
                    <div key={graphType} className="p-4 bg-secondary/20 rounded-xl">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div className="text-primary">{info.icon}</div>
                          <span className="font-bold text-foreground text-sm">{info.label}</span>
                          <span className="text-xs text-muted-foreground">({stats.sessions} session{stats.sessions !== 1 ? 's' : ''})</span>
                        </div>
                        <span className="text-lg font-black text-foreground">{stats.avgScore}%</span>
                      </div>
                      <div className="w-full bg-secondary/50 rounded-full h-2.5 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-700 ${
                            stats.avgScore >= 80 ? 'bg-green-500' : stats.avgScore >= 60 ? 'bg-amber-500' : 'bg-destructive'
                          }`}
                          style={{ width: `${stats.avgScore}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-xs text-muted-foreground mt-1.5">
                        <span>{stats.correctAnswers}/{stats.totalQuestions} correct ({accuracy}%)</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Graph score progression chart */}
              {graphProgressionData.length >= 2 && (
                <div>
                  <h4 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-3">Score Progression</h4>
                  <ResponsiveContainer width="100%" height={200}>
                    <RechartsLineChart data={graphProgressionData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="name" className="text-xs" />
                      <YAxis domain={[0, 100]} className="text-xs" />
                      <Tooltip />
                      <Line type="monotone" dataKey="score" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3 }} />
                    </RechartsLineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Performance by Section */}
      <motion.div variants={itemVariants}>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-primary" />
              Performance by Section
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-5">
              {sectionStats.map((stat) => (
                <div key={stat.section}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-foreground">{stat.section}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-muted-foreground">
                        {stat.tests} test{stat.tests !== 1 ? 's' : ''}
                      </span>
                      <span className="text-lg font-black text-foreground w-14 text-right">
                        {stat.average}%
                      </span>
                    </div>
                  </div>
                  <div className="w-full bg-secondary/50 rounded-full h-3 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-700 ${
                        stat.average >= 80 ? 'bg-green-500' : stat.average >= 60 ? 'bg-amber-500' : 'bg-destructive'
                      }`}
                      style={{ width: `${stat.average}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>

            {sectionChartData.some(s => s.tests > 0) && (
              <div className="mt-6">
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={sectionChartData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="section" className="text-xs" />
                    <YAxis domain={[0, 100]} className="text-xs" />
                    <Tooltip />
                    <Bar dataKey="average" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Flashcard & Practice Analytics */}
      <motion.div variants={itemVariants} className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Brain className="w-5 h-5 text-primary" />
              Flashcard Mastery
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{flashcardStats.mastered} / {flashcardStats.total} mastered</span>
              <span className="font-bold text-foreground">
                {flashcardStats.total > 0 ? Math.round((flashcardStats.mastered / flashcardStats.total) * 100) : 0}%
              </span>
            </div>
            <Progress value={flashcardStats.total > 0 ? (flashcardStats.mastered / flashcardStats.total) * 100 : 0} className="h-2" />
            <p className="text-xs text-muted-foreground">{flashcardStats.decks} NBT deck{flashcardStats.decks !== 1 ? 's' : ''} • {flashcardStats.total} total cards</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <BookOpen className="w-5 h-5 text-primary" />
              Practice Question Accuracy
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{practiceStats.correct} / {practiceStats.total} correct</span>
              <span className="font-bold text-foreground">
                {practiceStats.total > 0 ? Math.round((practiceStats.correct / practiceStats.total) * 100) : 0}%
              </span>
            </div>
            <Progress value={practiceStats.total > 0 ? (practiceStats.correct / practiceStats.total) * 100 : 0} className="h-2" />
            {Array.from(practiceStats.sections.entries()).map(([section, stats]) => (
              <div key={section} className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">{section}</span>
                <span className="font-medium text-foreground">{stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0}% ({stats.correct}/{stats.total})</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </motion.div>

      {/* Score Progression Chart */}
      <motion.div variants={itemVariants}>
        <Card>
          <CardHeader>
            <CardTitle>Score Progression</CardTitle>
          </CardHeader>
          <CardContent>
            {tests.length >= 2 ? (
              <ResponsiveContainer width="100%" height={250}>
                <RechartsLineChart data={tests.map((t, i) => ({
                  name: t.date ? format(new Date(t.date), 'MMM d') : `#${i + 1}`,
                  score: Math.round((t.score / t.maxScore) * 100),
                }))}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="name" className="text-xs" />
                  <YAxis domain={[0, 100]} className="text-xs" />
                  <Tooltip />
                  <Line type="monotone" dataKey="score" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 4 }} />
                </RechartsLineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-48 bg-secondary/30 rounded-lg flex items-center justify-center">
                <p className="text-muted-foreground">Take 2+ tests to see your progression</p>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Test History */}
      <motion.div variants={itemVariants}>
        <Card>
          <CardHeader>
            <CardTitle>Test History</CardTitle>
          </CardHeader>
          <CardContent>
            {tests.length === 0 ? (
              <p className="text-center py-8 text-muted-foreground">
                No tests taken yet. Start a test to track your progress!
              </p>
            ) : (
              <div className="space-y-3">
                {[...tests].reverse().map((test, idx) => (
                  <div key={test.id} className="flex items-center gap-4 p-4 bg-secondary/30 rounded-lg">
                    <div className="flex-shrink-0">
                      <div className="w-12 h-12 rounded-lg bg-primary/20 flex items-center justify-center">
                        <span className="font-bold text-primary">#{totalTests - idx}</span>
                      </div>
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-foreground">{test.title}</p>
                      <p className="text-sm text-muted-foreground">{test.date}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className="font-bold text-foreground">
                          {Math.round((test.score / test.maxScore) * 100)}%
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {test.score}/{test.maxScore}
                        </p>
                      </div>
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold ${
                        test.score >= (test.maxScore * 0.8)
                          ? 'bg-green-500/20 text-green-600'
                          : test.score >= (test.maxScore * 0.6)
                          ? 'bg-amber-500/20 text-amber-600'
                          : 'bg-destructive/20 text-destructive'
                      }`}>
                        {Math.round((test.score / test.maxScore) * 100)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Areas for Improvement */}
      <motion.div variants={itemVariants}>
        <Card>
          <CardHeader>
            <CardTitle>Areas for Improvement</CardTitle>
          </CardHeader>
          <CardContent>
            {tests.length === 0 && practiceStats.total === 0 ? (
              <p className="text-muted-foreground text-sm">
                Complete some tests or practice questions to identify areas where you need more practice.
              </p>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground mb-4">
                  Based on your test results and practice performance:
                </p>
                {sectionStats
                  .sort((a, b) => a.average - b.average)
                  .map((stat) => {
                    const practiceData = practiceStats.sections.get(stat.section);
                    const practiceAccuracy = practiceData && practiceData.total > 0
                      ? Math.round((practiceData.correct / practiceData.total) * 100) : null;

                    return (
                      <div
                        key={stat.section}
                        className="p-4 bg-secondary/30 border border-border rounded-xl"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div>
                            <h4 className="font-bold text-foreground">{stat.section}</h4>
                            <p className="text-xs text-muted-foreground">
                              {stat.average === 0 && !practiceData && 'No data yet — start practicing!'}
                              {(stat.average > 0 || practiceData) && stat.average < 60 && 'Needs significant work'}
                              {stat.average >= 60 && stat.average < 75 && 'Needs improvement'}
                              {stat.average >= 75 && 'Good progress, keep practicing'}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-lg font-black text-foreground">{stat.average}%</p>
                            {practiceAccuracy !== null && (
                              <p className="text-[10px] text-muted-foreground">Practice: {practiceAccuracy}%</p>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
};

export default NBTProgressTracking;
