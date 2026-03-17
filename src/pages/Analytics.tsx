import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BarChart3, TrendingUp, Clock, Target, Calendar, BookOpen, Trophy, Flame, Star, Lock, CheckCircle2, Award, Zap, Crown, Brain, FileText, ChevronDown, ChevronUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useAIContext } from '@/contexts/AIContext';
import { usePageAnimation } from '@/hooks/use-page-animation';
import { supabase } from '@/integrations/supabase/client';
import AppLayout from '@/components/layout/AppLayout';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, LineChart, Line } from 'recharts';
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { useUserPoints } from '@/hooks/useUserPoints';
import { useSubscription } from '@/hooks/useSubscription';
import { useSubjectAnalytics } from '@/hooks/useSubjectAnalytics';
import { UpgradeModal } from '@/components/subscription/UpgradeModal';
import { SubjectPerformanceSection } from '@/components/analytics/SubjectPerformanceSection';


interface AnalyticsData {
  date: string;
  total_study_minutes: number;
  tests_attempted: number;
  average_score: number;
  pages_completed?: number;
  sessions_count?: number;
}

interface SubjectPerformance {
  subject: string;
  averageScore: number;
  testsCompleted: number;
}

interface SubjectTimeData {
  subjectName: string;
  studyMinutes: number;
  percentage: number;
}

interface FlashcardMasteryData {
  subjectName: string;
  mastered: number;
  total: number;
  percentage: number;
  decks: {
    title: string;
    mastered: number;
    total: number;
    percentage: number;
  }[];
}

interface PastPaperTrend {
  date: string;
  score: number;
  subject?: string;
}

const iconMap: Record<string, any> = {
  'footprints': Zap,
  'bug': Target,
  'graduation-cap': Award,
  'help-circle': Target,
  'brain': Star,
  'trophy': Trophy,
  'flame': Flame,
  'layers': Star,
  'award': Award,
  'clock': Target,
  'star': Star,
};



const Insights = () => {
  const { user } = useAuth();
  const { shouldAnimate } = usePageAnimation('Insights');
  const { getAllSubjectAnalytics } = useSubjectAnalytics();
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData[]>([]);
  const [subjectPerformance, setSubjectPerformance] = useState<SubjectPerformance[]>([]);
  const [subjectTimeData, setSubjectTimeData] = useState<SubjectTimeData[]>([]);
  const [flashcardMastery, setFlashcardMastery] = useState<FlashcardMasteryData[]>([]);
  const [pastPaperTrends, setPastPaperTrends] = useState<PastPaperTrend[]>([]);
  const [examPerformance, setExamPerformance] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('analytics');
  const [selectedMonthOffset, setSelectedMonthOffset] = useState(0); // 0 = current, 1 = last month, 2 = 2 months ago
  const [availableMonths, setAvailableMonths] = useState<number[]>([0]); // offsets with data
  const { achievements, unlockedAchievements, points, loading: achievementsLoading, isAchievementUnlocked } = useUserPoints();
  const { tier } = useSubscription();
  const { setAiContext } = useAIContext();
  const isPaidUser = tier === 'tier1' || tier === 'tier2';
  const [isUnlocking, setIsUnlocking] = useState(false);
  const [flippedAchievementId, setFlippedAchievementId] = useState<string | null>(null);
  const [expandedFlashcardSubjects, setExpandedFlashcardSubjects] = useState<Set<string>>(new Set());
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);


  const getUnlockDescription = (achievement: any) => {
    const { requirement_type, requirement_value } = achievement;
    switch (requirement_type) {
      case 'total_points':
        return `Reach ${requirement_value} total points`;
      case 'level':
        return `Reach level ${requirement_value}`;
      case 'study_sessions':
        return `Complete ${requirement_value} study session${requirement_value > 1 ? 's' : ''}`;
      case 'streak_days':
        return `Maintain a study streak of ${requirement_value} day${requirement_value > 1 ? 's' : ''}`;
      case 'total_study_minutes':
        return `Study for a total of ${requirement_value} minute${requirement_value > 1 ? 's' : ''}${requirement_value >= 60 ? ` (${Math.round(requirement_value/60)} hours)` : ''}`;
      case 'flashcards_created':
        return `Create ${requirement_value} flashcard${requirement_value > 1 ? 's' : ''}`;
      case 'flashcards_mastered':
        return `Master ${requirement_value} flashcard${requirement_value > 1 ? 's' : ''}`;
      case 'quizzes_completed':
        return `Complete ${requirement_value} quiz${requirement_value > 1 ? 'zes' : ''}`;
      case 'perfect_quizzes':
        return `Get 100% on ${requirement_value} quiz${requirement_value > 1 ? 'zes' : ''}`;
      default:
        return achievement.description;
    }
  };

  const getAchievementProgress = (achievement: any) => {
    const { requirement_type, requirement_value } = achievement;
    let current = 0;
    
    switch (requirement_type) {
      case 'total_points':
        current = earnedPoints;
        break;
      case 'level':
        current = points.level;
        break;
      case 'study_sessions':
      case 'quizzes_completed':
        current = stats.testsCompleted;
        break;
      case 'streak_days':
        current = points.currentStreak || stats.studyStreak;
        break;
      case 'total_study_minutes':
        current = stats.totalStudyMinutes;
        break;
      case 'flashcards_created':
        current = stats.knowledgeItems;
        break;
      case 'flashcards_mastered':
        current = stats.flashcardsMastered;
        break;
      case 'perfect_quizzes':
        // Rough estimation if we don't have this stat directly
        current = Math.floor(stats.testsCompleted * (stats.averageScore / 100));
        break;
      default:
        current = 0;
    }
    
    const percentage = Math.min(100, Math.max(0, (current / (requirement_value || 1)) * 100));
    return { current, percentage };
  };

  useEffect(() => {
    const justUpgraded = localStorage.getItem('just_upgraded_premium');
    if (justUpgraded === 'true' && isPaidUser) {
      setIsUnlocking(true);
      localStorage.removeItem('just_upgraded_premium');

      const timer = setTimeout(() => {
        setIsUnlocking(false);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [isPaidUser]);

  useEffect(() => {
    if (user) {
      fetchAnalytics();
    }
  }, [user, tier, selectedMonthOffset]);

  // Subscribe to real-time updates to study_analytics
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`analytics_${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'study_analytics',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          // Refresh analytics when new study analytics are added
          fetchAnalytics();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'study_analytics',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          // Refresh analytics when study analytics are updated
          fetchAnalytics();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  // Determine which months have data (run once on mount / user change)
  useEffect(() => {
    if (!user) return;
    const detectMonths = async () => {
      const months: number[] = [];
      for (let offset = 0; offset < 3; offset++) {
        const d = subMonths(new Date(), offset);
        const s = startOfMonth(d).toISOString().split('T')[0];
        const e = endOfMonth(d).toISOString().split('T')[0];
        const { count } = await supabase
          .from('study_analytics')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .gte('date', s)
          .lte('date', e);
        if ((count ?? 0) > 0) months.push(offset);
      }
      if (months.length === 0) months.push(0); // always show current
      setAvailableMonths(months);
    };
    detectMonths();
  }, [user]);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      const selectedDate = subMonths(new Date(), selectedMonthOffset);
      const rangeStart = startOfMonth(selectedDate).toISOString().split('T')[0];
      const rangeEnd = endOfMonth(selectedDate).toISOString().split('T')[0];

      const { data } = await supabase
        .from('study_analytics')
        .select('*')
        .eq('user_id', user?.id)
        .gte('date', rangeStart)
        .lte('date', rangeEnd)
        .order('date', { ascending: true });

      if (data) {
        setAnalyticsData(data);
      }

      // Fetch subject time data for paid users from study_time_analytics for consistency
      if (isPaidUser) {
        const { data: timeData } = await supabase
          .from('study_time_analytics')
          .select('total_minutes, subject_id, subjects(name)')
          .eq('user_id', user?.id)
          .gte('study_date', rangeStart)
          .lte('study_date', rangeEnd);

        if (timeData && timeData.length > 0) {
          // Group by subject and calculate total time
          const subjectMap: Record<string, number> = {};
          const subjectNameMap: Record<string, string> = {};
          let totalMinutes = 0;

          timeData.forEach((item: any) => {
            const subjectName = item.subjects?.name || 'General Study';
            const subjectId = item.subject_id || 'general';
            const duration = item.total_minutes || 0;

            subjectMap[subjectId] = (subjectMap[subjectId] || 0) + duration;
            subjectNameMap[subjectId] = subjectName;
            totalMinutes += duration;
          });

          // Convert to array and calculate percentages
          const subjectTimes = Object.entries(subjectMap).map(([subjectId, minutes]) => ({
            subjectName: subjectNameMap[subjectId],
            studyMinutes: minutes,
            percentage: totalMinutes > 0 ? Math.round((minutes / totalMinutes) * 100) : 0,
          }))
          .sort((a, b) => b.studyMinutes - a.studyMinutes);

          setSubjectTimeData(subjectTimes);
        }

        // Fetch quiz performance by subject using the unified hook
        const subjectSummaries = await getAllSubjectAnalytics();

        if (subjectSummaries && subjectSummaries.length > 0) {
          // Fetch subject names
          const { data: subjectNames } = await supabase
            .from('subjects')
            .select('id, name')
            .in('id', subjectSummaries.map(s => s.subject_id));

          const nameMap = new Map(subjectNames?.map(s => [s.id, s.name]));

          const subjectPerf: SubjectPerformance[] = subjectSummaries.map(summary => ({
            subject: nameMap.get(summary.subject_id) || 'Unknown Subject',
            averageScore: Math.round(summary.progress_percentage),
            testsCompleted: summary.total_quizzes_taken + summary.total_exams_taken,
          })).sort((a, b) => b.testsCompleted - a.testsCompleted);

          setSubjectPerformance(subjectPerf);
        }

        // Fetch Flashcard Mastery (filtered by month - using updated_at)
        const { data: deckData } = await supabase
          .from('flashcard_decks')
          .select('id, title, total_cards, mastered_cards, subject_id, subjects(name), updated_at, nbt_lesson_id')
          .eq('user_id', user?.id)
          .gte('updated_at', startOfMonth(selectedDate).toISOString())
          .lte('updated_at', endOfMonth(selectedDate).toISOString());

        if (deckData) {
          // Filter out NBT flashcard decks
          const nonNBTDecks = deckData.filter((deck: any) =>
            !deck.title?.toUpperCase().includes('NBT') && !deck.nbt_lesson_id
          );
          const subjectGroupMap: Record<string, FlashcardMasteryData> = {};

          nonNBTDecks.forEach((deck: any) => {
            const subjectId = deck.subject_id || 'general';
            const subjectName = deck.subjects?.name || 'General Flashcards';

            if (!subjectGroupMap[subjectId]) {
              subjectGroupMap[subjectId] = {
                subjectName,
                mastered: 0,
                total: 0,
                percentage: 0,
                decks: []
              };
            }

            const mastery = {
              title: deck.title,
              mastered: deck.mastered_cards || 0,
              total: deck.total_cards || 0,
              percentage: deck.total_cards ? Math.round((deck.mastered_cards / deck.total_cards) * 100) : 0
            };

            subjectGroupMap[subjectId].mastered += mastery.mastered;
            subjectGroupMap[subjectId].total += mastery.total;
            subjectGroupMap[subjectId].decks.push(mastery);
          });

          const mastery = Object.values(subjectGroupMap).map(group => ({
            ...group,
            percentage: group.total > 0 ? Math.round((group.mastered / group.total) * 100) : 0
          })).filter(g => g.total > 0);

          setFlashcardMastery(mastery);
        }

        // Fetch Past Paper Attempts (filtered by month)
        let allPaperData: any[] = [];
        let paperPage = 0;
        let paperHasMore = true;
        const pageSize = 1000;

        while (paperHasMore) {
          const { data: paperData, error: paperError } = await supabase
            .from('past_paper_attempts')
            .select('completed_at, score, max_score, documents(title)')
            .eq('user_id', user?.id)
            .gte('completed_at', startOfMonth(selectedDate).toISOString())
            .lte('completed_at', endOfMonth(selectedDate).toISOString())
            .order('completed_at', { ascending: true })
            .range(paperPage * pageSize, (paperPage + 1) * pageSize - 1);

          if (paperError) throw paperError;

          if (paperData && paperData.length > 0) {
            allPaperData = [...allPaperData, ...paperData];
            if (paperData.length < pageSize) {
              paperHasMore = false;
            } else {
              paperPage++;
            }
          } else {
            paperHasMore = false;
          }
        }

        if (allPaperData) {
          const trends = allPaperData.map(attempt => ({
            date: format(new Date(attempt.completed_at), 'MMM d'),
            score: Math.round((attempt.score / attempt.max_score) * 100),
            title: (attempt.documents as any)?.title
          }));
          setPastPaperTrends(trends);
        }

        // Fetch Exam Performance (filtered by month)
        let allExamData: any[] = [];
        let examPage = 0;
        let examHasMore = true;

        while (examHasMore) {
          const { data: examData, error: examError } = await supabase
            .from('quiz_performance_analytics')
            .select('score, max_score, percentage, completed_at')
            .eq('user_id', user?.id)
            .gte('completed_at', startOfMonth(selectedDate).toISOString())
            .lte('completed_at', endOfMonth(selectedDate).toISOString())
            .order('completed_at', { ascending: true })
            .range(examPage * pageSize, (examPage + 1) * pageSize - 1);

          if (examError) throw examError;

          if (examData && examData.length > 0) {
            allExamData = [...allExamData, ...examData];
            if (examData.length < pageSize) {
              examHasMore = false;
            } else {
              examPage++;
            }
          } else {
            examHasMore = false;
          }
        }

        if (allExamData) {
          const processedExams = (allExamData as any[]).map((exam: any) => ({
            date: format(new Date(exam.completed_at), 'MMM d'),
            score: Math.round(exam.percentage || 0)
          }));
          setExamPerformance(processedExams);
        }
      }
    } catch (error) {
      const errorMessage = (error as any)?.message || (error as any)?.error_description || String(error);
      console.error('Error fetching analytics:', errorMessage, error);
    } finally {
      setLoading(false);
    }
  };

  const categories = [
    { id: 'study', label: 'Study', color: 'bg-accent-mint' },
    { id: 'quiz', label: 'Quizzes', color: 'bg-accent-lavender' },
    { id: 'streak', label: 'Streaks', color: 'bg-accent-peach' },
    { id: 'flashcard', label: 'Flashcards', color: 'bg-accent-pink' },
    { id: 'milestone', label: 'Milestones', color: 'bg-accent-yellow' },
    { id: 'nbt', label: 'NBT', color: 'bg-primary/20' },
  ];

  const getAchievementsByCategory = (category: string) => {
    // All achievements are visible to everyone
    return achievements.filter(a => a.category === category);
  };

  // Calculate summary stats
  const totalStudyHours = Math.round(
    analyticsData.reduce((acc, d) => acc + (d.total_study_minutes || 0), 0) / 60
  );
  const totalTests = analyticsData.reduce((acc, d) => acc + (d.tests_attempted || 0), 0);
  const avgScore = totalTests > 0
    ? Math.round(
        analyticsData.reduce((acc, d) => acc + (Number(d.average_score || 0) * (d.tests_attempted || 0)), 0) / totalTests
      )
    : 0;
  const studyDays = analyticsData.filter((d) => d.total_study_minutes > 0).length;
  const totalStudyMinutes = analyticsData.reduce((acc, d) => acc + (d.total_study_minutes || 0), 0);

  // Create stats object for achievement progress calculations
  const stats = {
    testsCompleted: totalTests,
    studyStreak: points.currentStreak || 0,
    totalStudyMinutes: totalStudyMinutes,
    knowledgeItems: flashcardMastery.reduce((acc, d) => acc + d.total, 0),
    flashcardsMastered: flashcardMastery.reduce((acc, d) => acc + d.mastered, 0),
    averageScore: avgScore,
  };

  // Prepare chart data
  const chartData = analyticsData.map((d) => ({
    date: format(new Date(d.date), 'MMM d'),
    studyMinutes: d.total_study_minutes || 0,
    score: Number(d.average_score) || 0,
    tests: d.tests_attempted || 0,
  }));

  // Weekly breakdown - calculated from actual analytics data
  const getWeeklyData = () => {
    const weeks: Record<string, number> = {
      'Mon': 0, 'Tue': 0, 'Wed': 0, 'Thu': 0, 'Fri': 0, 'Sat': 0, 'Sun': 0
    };
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    analyticsData.forEach((d) => {
      const date = new Date(d.date);
      const dayName = dayNames[date.getDay()];
      weeks[dayName] += d.total_study_minutes || 0;
    });

    return [
      { day: 'Mon', minutes: weeks['Mon'] },
      { day: 'Tue', minutes: weeks['Tue'] },
      { day: 'Wed', minutes: weeks['Wed'] },
      { day: 'Thu', minutes: weeks['Thu'] },
      { day: 'Fri', minutes: weeks['Fri'] },
      { day: 'Sat', minutes: weeks['Sat'] },
      { day: 'Sun', minutes: weeks['Sun'] },
    ];
  };

  const weeklyData = getWeeklyData();

  // Achievements stats - all achievements visible to everyone
  const visibleAchievements = achievements;

  const visibleUnlocked = unlockedAchievements;

  const totalPoints = visibleAchievements.reduce((acc, a) => acc + (a.points || 0), 0);
  const earnedPoints = visibleUnlocked.reduce((acc, a) => acc + (a.points || 0), 0);
  const progressPercentage = totalPoints > 0 ? (earnedPoints / totalPoints) * 100 : 0;

  useEffect(() => {
    setAiContext({
      currentPage: 'analytics',
      location: activeTab === 'analytics' ? 'Learning Insights & Analytics' : 'User Achievements & Badges',
      activeAnalytics: {
        view: activeTab,
        context: activeTab === 'analytics'
          ? `User has studied for ${totalStudyHours} hours across ${studyDays} active days with an average score of ${avgScore}%`
          : `User has unlocked ${visibleUnlocked.length} of ${visibleAchievements.length} achievements (Level ${points.level})`,
        totalStudyMinutes: analyticsData.reduce((acc, d) => acc + (d.total_study_minutes || 0), 0),
        averageScore: avgScore,
        testsCompleted: totalTests,
        subjectPerformance: subjectPerformance,
        nbtAnalytics: {
          testsTaken: 0, // This would need to be fetched from NBT test attempts
          averageScore: 0, // This would need to be calculated from NBT test attempts
        }
      },
      activeDocument: null,
      activePaper: null
    });
  }, [activeTab, totalStudyHours, studyDays, avgScore, visibleUnlocked.length, visibleAchievements.length, points.level, analyticsData, totalTests, subjectPerformance, setAiContext]);

  if (loading && achievementsLoading) {
    return (
      <AppLayout>
        <div className="space-y-6 animate-pulse">
          <div className="h-32 bg-muted rounded-xl" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="h-24 bg-muted rounded-xl" />
            ))}
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <motion.div
          initial={shouldAnimate ? { opacity: 0, y: 20 } : { opacity: 1, y: 0 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h1 className="text-2xl sm:text-3xl font-display font-bold text-foreground">Insights</h1>
          <p className="text-xs sm:text-sm md:text-base text-muted-foreground mt-1">
            {activeTab === 'analytics'
              ? 'Track your learning progress'
              : 'Unlock achievements and earn points'
            }
          </p>
        </motion.div>

        {/* Tabs */}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab('analytics')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                activeTab === 'analytics'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-secondary text-foreground hover:bg-secondary/80'
              }`}
            >
              Analytics
            </button>
            <button
              onClick={() => setActiveTab('achievements')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                activeTab === 'achievements'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-secondary text-foreground hover:bg-secondary/80'
              }`}
            >
              Achievements
            </button>
          </div>
        </div>

        {/* Analytics Tab */}
        {activeTab === 'analytics' && (
          <>
            {/* Month Selector - only show months with data */}
            <div className="flex items-center gap-2 flex-wrap">
              {availableMonths.map((offset) => {
                const month = subMonths(new Date(), offset);
                const label = offset === 0 ? 'This Month' : format(month, 'MMMM yyyy');
                return (
                  <button
                    key={offset}
                    onClick={() => setSelectedMonthOffset(offset)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      selectedMonthOffset === offset
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-secondary text-foreground hover:bg-secondary/80'
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>

            {/* Animated content wrapper keyed by month */}
            <AnimatePresence mode="wait">
            <motion.div
              key={`month-${selectedMonthOffset}`}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3, ease: 'easeInOut' }}
              className="space-y-6"
            >

            {/* Stats Overview */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="grid grid-cols-2 lg:grid-cols-4 gap-4"
            >
              <Card className="border-none shadow-sm bg-gradient-to-br from-primary/10 to-transparent">
                <CardContent className="p-4 sm:p-5 lg:p-6">
                  <div className="flex items-center gap-2 sm:gap-4">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-primary flex items-center justify-center flex-shrink-0 shadow-lg shadow-primary/20">
                      <Clock className="w-5 h-5 sm:w-6 sm:h-6 text-primary-foreground" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-lg sm:text-2xl font-bold text-foreground truncate">
                        {Math.floor(totalStudyHours)}h {Math.round((totalStudyHours % 1) * 60)}m
                      </p>
                      <p className="text-[10px] sm:text-sm text-muted-foreground truncate font-medium">Study Time</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-none shadow-sm bg-gradient-to-br from-accent-mint/10 to-transparent">
                <CardContent className="p-4 sm:p-5 lg:p-6">
                  <div className="flex items-center gap-2 sm:gap-4">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-accent-mint flex items-center justify-center flex-shrink-0 shadow-lg shadow-accent-mint/20">
                      <Target className="w-5 h-5 sm:w-6 sm:h-6 text-accent-mint-foreground" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-lg sm:text-2xl font-bold text-foreground truncate">{avgScore}%</p>
                      <p className="text-[10px] sm:text-sm text-muted-foreground truncate font-medium">Avg Score</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-none shadow-sm bg-gradient-to-br from-accent-lavender/10 to-transparent">
                <CardContent className="p-4 sm:p-5 lg:p-6">
                  <div className="flex items-center gap-2 sm:gap-4">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-accent-lavender flex items-center justify-center flex-shrink-0 shadow-lg shadow-accent-lavender/20">
                      <BookOpen className="w-5 h-5 sm:w-6 sm:h-6 text-accent-lavender-foreground" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-lg sm:text-2xl font-bold text-foreground truncate">{totalTests}</p>
                      <p className="text-[10px] sm:text-sm text-muted-foreground truncate font-medium">Quizzes</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-none shadow-sm bg-gradient-to-br from-accent-peach/10 to-transparent">
                <CardContent className="p-4 sm:p-5 lg:p-6">
                  <div className="flex items-center gap-2 sm:gap-4">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-accent-peach flex items-center justify-center flex-shrink-0 shadow-lg shadow-accent-peach/20">
                      <Calendar className="w-5 h-5 sm:w-6 sm:h-6 text-accent-peach-foreground" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-lg sm:text-2xl font-bold text-foreground truncate">{studyDays}</p>
                      <p className="text-[10px] sm:text-sm text-muted-foreground truncate font-medium">Active Days</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Charts */}
            <div className="grid lg:grid-cols-2 gap-6">
              {/* Study Time Chart */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
              >
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <TrendingUp className="w-5 h-5 text-primary" />
                      Study Time Trend
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-64 sm:h-80 md:h-96 lg:h-[300px] w-full">
                      {chartData.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={chartData}>
                            <defs>
                              <linearGradient id="colorStudy" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                                <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                            <XAxis dataKey="date" className="text-muted-foreground" fontSize={12} />
                            <YAxis className="text-muted-foreground" fontSize={12} />
                            <Tooltip
                              contentStyle={{
                                backgroundColor: 'hsl(var(--card))',
                                border: '1px solid hsl(var(--border))',
                                borderRadius: '8px',
                              }}
                            />
                            <Area
                              type="monotone"
                              dataKey="studyMinutes"
                              stroke="hsl(var(--primary))"
                              fillOpacity={1}
                              fill="url(#colorStudy)"
                            />
                          </AreaChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="h-full flex items-center justify-center">
                          <p className="text-muted-foreground">No data yet. Start studying to see your progress!</p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>

              {/* Weekly Breakdown */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
              >
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <BarChart3 className="w-5 h-5 text-primary" />
                      Weekly Breakdown
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-64 sm:h-80 md:h-96 lg:h-[300px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={weeklyData}>
                          <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                          <XAxis dataKey="day" className="text-muted-foreground" fontSize={12} />
                          <YAxis className="text-muted-foreground" fontSize={12} />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: 'hsl(var(--card))',
                              border: '1px solid hsl(var(--border))',
                              borderRadius: '8px',
                            }}
                          />
                          <Bar dataKey="minutes" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            </div>

            {/* Premium Analytics Section */}
            {!isPaidUser ? (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
              >
                <Card className="relative overflow-hidden border-dashed border-2">
                  <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-accent/10" />
                  <CardContent className="p-8 relative">
                    <div className="flex flex-col items-center text-center space-y-4">
                      <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center">
                        <Crown className="w-8 h-8 text-primary" />
                      </div>
                      <div>
                        <h3 className="text-xl font-bold text-foreground mb-2">Unlock Premium Analytics</h3>
                        <p className="text-muted-foreground max-w-md">
                          Get detailed score trends, subject performance breakdowns, study habit analysis, and personalized improvement recommendations.
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-3 justify-center">
                        <Badge variant="secondary" className="gap-1">
                          <TrendingUp className="w-3 h-3" />
                          Score Trends
                        </Badge>
                        <Badge variant="secondary" className="gap-1">
                          <Target className="w-3 h-3" />
                          Subject Analysis
                        </Badge>
                        <Badge variant="secondary" className="gap-1">
                          <TrendingUp className="w-3 h-3" />
                          Performance Insights
                        </Badge>
                      </div>
                      <Button onClick={() => setIsUpgradeModalOpen(true)} className="gap-2 mt-2">
                        <Crown className="w-4 h-4" />
                        Upgrade Now
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ) : (
              /* Premium Analytics for Paid Users */
              <motion.div
                className="grid lg:grid-cols-2 gap-6"
                initial={isUnlocking ? { opacity: 0, scale: 0.95, filter: 'blur(10px)' } : false}
                animate={isUnlocking ? { opacity: 1, scale: 1, filter: 'blur(0px)' } : {}}
                transition={{ duration: 0.8, ease: "easeOut" }}
              >
                {/* Flashcard Mastery - Moved up and redesigned */}
                {(
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 }}
                    className="lg:col-span-2"
                  >
                    <Card className="overflow-hidden border-border/50 shadow-md bg-card">
                      <CardHeader className="pb-4">
                        <div className="flex items-center justify-between">
                          <div className="space-y-1">
                            <CardTitle className="flex items-center gap-2 text-xl font-bold">
                              <Brain className="w-5 h-5 text-pink-500" />
                              Flashcard Progress
                            </CardTitle>
                            <p className="text-xs text-muted-foreground">Detailed breakdown of your card mastery across all decks</p>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        {flashcardMastery.length > 0 ? (
                          <div className="space-y-8">
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                              <div className="space-y-1">
                                <p className="text-2xl font-bold text-foreground">
                                  {flashcardMastery.reduce((acc, d) => acc + d.mastered, 0)}
                                </p>
                                <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">Mastered</p>
                              </div>
                              <div className="space-y-1">
                                <p className="text-2xl font-bold text-foreground">
                                  {Math.round(flashcardMastery.reduce((acc, d) => acc + d.percentage, 0) / flashcardMastery.length)}%
                                </p>
                                <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">Avg Mastery</p>
                              </div>
                              <div className="space-y-1">
                                <p className="text-2xl font-bold text-foreground">
                                  {flashcardMastery.length}
                                </p>
                                <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">Decks</p>
                              </div>
                              <div className="space-y-1">
                                <p className="text-2xl font-bold text-foreground">
                                  {flashcardMastery.reduce((acc, d) => acc + d.total, 0)}
                                </p>
                                <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">Total Cards</p>
                              </div>
                            </div>

                            <div className="space-y-4">
                              {flashcardMastery.map((group) => (
                                <div key={group.subjectName} className="space-y-2 border border-border/40 rounded-lg p-3">
                                  <div
                                    className="flex justify-between items-center cursor-pointer group/subject"
                                    onClick={() => {
                                      const next = new Set(expandedFlashcardSubjects);
                                      if (next.has(group.subjectName)) next.delete(group.subjectName);
                                      else next.add(group.subjectName);
                                      setExpandedFlashcardSubjects(next);
                                    }}
                                  >
                                    <div className="flex items-center gap-2">
                                      <span className="font-bold text-sm text-foreground group-hover/subject:text-primary transition-colors">
                                        {group.subjectName}
                                      </span>
                                      {expandedFlashcardSubjects.has(group.subjectName) ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                                    </div>
                                    <span className="text-[10px] font-bold text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                                      {group.mastered}/{group.total} cards • <span className="text-pink-500">{group.percentage}%</span>
                                    </span>
                                  </div>
                                  <div className="w-full bg-secondary h-2 rounded-full overflow-hidden">
                                    <div
                                      className="bg-pink-500 h-full rounded-full transition-all duration-700"
                                      style={{ width: `${group.percentage}%` }}
                                    />
                                  </div>

                                  {expandedFlashcardSubjects.has(group.subjectName) && (
                                    <motion.div
                                      initial={{ height: 0, opacity: 0 }}
                                      animate={{ height: 'auto', opacity: 1 }}
                                      className="space-y-3 pt-3 mt-2 border-t border-border/40 overflow-hidden"
                                    >
                                      {group.decks.map((deck, idx) => (
                                        <div key={idx} className="space-y-1.5 pl-4 border-l-2 border-pink-500/20">
                                          <div className="flex justify-between items-end">
                                            <span className="text-xs font-medium text-foreground">{deck.title}</span>
                                            <span className="text-[9px] text-muted-foreground">{deck.mastered}/{deck.total} cards</span>
                                          </div>
                                          <div className="w-full bg-secondary/50 h-1 rounded-full overflow-hidden">
                                            <div
                                              className="bg-pink-500/60 h-full rounded-full transition-all duration-500"
                                              style={{ width: `${deck.percentage}%` }}
                                            />
                                          </div>
                                        </div>
                                      ))}
                                    </motion.div>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <div className="h-48 flex flex-col items-center justify-center text-center space-y-3">
                            <div className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center">
                              <Brain className="w-6 h-6 text-muted-foreground" />
                            </div>
                            <div>
                              <p className="text-sm font-medium text-foreground">No data available</p>
                              <p className="text-xs text-muted-foreground">Start creating and studying flashcards!</p>
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </motion.div>
                )}

                {/* Score Trend */}
                <motion.div
                  initial={isUnlocking ? { y: 20, opacity: 0 } : { opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: isUnlocking ? 0.2 : 0.5 }}
                >
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <TrendingUp className="w-5 h-5 text-primary" />
                        Score Trend
                        <Badge variant="secondary" className="ml-2 text-xs">Premium</Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="h-56 sm:h-64 md:h-72 lg:h-[250px]">
                        {chartData.length > 0 ? (
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={chartData}>
                              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                              <XAxis dataKey="date" className="text-muted-foreground" fontSize={12} />
                              <YAxis domain={[0, 100]} className="text-muted-foreground" fontSize={12} />
                              <Tooltip
                                contentStyle={{
                                  backgroundColor: 'hsl(var(--card))',
                                  border: '1px solid hsl(var(--border))',
                                  borderRadius: '8px',
                                }}
                              />
                              <Line 
                                type="monotone" 
                                dataKey="score" 
                                stroke="#10B981" 
                                strokeWidth={2}
                                dot={{ fill: '#10B981', strokeWidth: 2 }}
                              />
                            </LineChart>
                          </ResponsiveContainer>
                        ) : (
                          <div className="h-full flex items-center justify-center">
                            <p className="text-muted-foreground">Complete some tests to see your score trend!</p>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>

                {/* Tests per Day */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 }}
                >
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Target className="w-5 h-5 text-primary" />
                        Daily Test Activity
                        <Badge variant="secondary" className="ml-2 text-xs">Premium</Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="h-56 sm:h-64 md:h-72 lg:h-[250px]">
                        {chartData.length > 0 ? (
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={chartData}>
                              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                              <XAxis dataKey="date" className="text-muted-foreground" fontSize={12} />
                              <YAxis className="text-muted-foreground" fontSize={12} />
                              <Tooltip
                                contentStyle={{
                                  backgroundColor: 'hsl(var(--card))',
                                  border: '1px solid hsl(var(--border))',
                                  borderRadius: '8px',
                                }}
                              />
                              <Bar dataKey="tests" fill="#F59E0B" radius={[4, 4, 0, 0]} />
                            </BarChart>
                          </ResponsiveContainer>
                        ) : (
                          <div className="h-full flex items-center justify-center">
                            <p className="text-muted-foreground">Complete some tests to see your activity!</p>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>

                {/* Study Efficiency Summary */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.6 }}
                  className="lg:col-span-2"
                >
                  <Card className="bg-gradient-to-br from-primary/5 to-accent/5">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Award className="w-5 h-5 text-primary" />
                        Performance Summary
                        <Badge variant="secondary" className="ml-2 text-xs">Premium</Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="text-center p-4 bg-background rounded-xl">
                          <p className="text-3xl font-bold text-primary">{points.currentStreak}</p>
                          <p className="text-sm text-muted-foreground">Current Streak</p>
                        </div>
                        <div className="text-center p-4 bg-background rounded-xl">
                          <p className="text-3xl font-bold text-green-500">{points.longestStreak}</p>
                          <p className="text-sm text-muted-foreground">Best Streak</p>
                        </div>
                        <div className="text-center p-4 bg-background rounded-xl">
                          <p className="text-3xl font-bold text-amber-500">{points.level}</p>
                          <p className="text-sm text-muted-foreground">Current Level</p>
                        </div>
                        <div className="text-center p-4 bg-background rounded-xl">
                          <p className="text-3xl font-bold text-purple-500">{points.totalPoints}</p>
                          <p className="text-sm text-muted-foreground">Total Points</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>


                {/* Subject Distribution */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.8 }}
                >
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <BarChart3 className="w-5 h-5 text-primary" />
                        Time Spent Per Subject
                        <Badge variant="secondary" className="ml-2 text-xs">Premium</Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {subjectTimeData.length > 0 ? (
                        <div className="space-y-4">
                          {subjectTimeData.map((subject, index) => {
                            const colors = ['hsl(var(--primary))', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];
                            const color = colors[index % colors.length];
                            const hours = Math.floor(subject.studyMinutes / 60);
                            const minutes = subject.studyMinutes % 60;

                            return (
                              <div key={subject.subjectName} className="space-y-2">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <div
                                      className="w-3 h-3 rounded-full"
                                      style={{ backgroundColor: color }}
                                    />
                                    <span className="font-medium text-foreground">{subject.subjectName}</span>
                                  </div>
                                  <div className="text-right">
                                    <p className="font-semibold text-foreground">
                                      {hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`}
                                    </p>
                                    <p className="text-xs text-muted-foreground">{subject.percentage}%</p>
                                  </div>
                                </div>
                                <div className="w-full bg-secondary rounded-full h-2 overflow-hidden">
                                  <div
                                    className="h-full rounded-full transition-all duration-500"
                                    style={{
                                      width: `${subject.percentage}%`,
                                      backgroundColor: color,
                                    }}
                                  />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="h-32 flex items-center justify-center">
                          <p className="text-muted-foreground">Start studying to see your subject breakdown!</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </motion.div>

                {/* Quiz Performance by Subject - always show */}
                {(
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.9 }}
                    className="lg:col-span-2"
                  >
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <Target className="w-5 h-5 text-primary" />
                          Quiz Performance by Subject
                          <Badge variant="secondary" className="ml-2 text-xs">Premium</Badge>
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        {subjectPerformance.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                          {subjectPerformance.map((subj) => {
                            const scoreColor = subj.averageScore >= 80
                              ? 'text-green-600 dark:text-green-400'
                              : subj.averageScore >= 60
                              ? 'text-amber-600 dark:text-amber-400'
                              : 'text-red-600 dark:text-red-400';
                            const bgColor = subj.averageScore >= 80
                              ? 'bg-green-100 dark:bg-green-900/30'
                              : subj.averageScore >= 60
                              ? 'bg-amber-100 dark:bg-amber-900/30'
                              : 'bg-red-100 dark:bg-red-900/30';

                            return (
                              <div key={subj.subject} className={`p-4 rounded-xl ${bgColor} border border-border`}>
                                <div className="flex items-center justify-between mb-2">
                                  <span className="font-medium text-foreground">{subj.subject}</span>
                                  <span className={`text-xl font-bold ${scoreColor}`}>{subj.averageScore}%</span>
                                </div>
                                <div className="flex items-center justify-between text-sm text-muted-foreground">
                                  <span>{subj.testsCompleted} quizzes</span>
                                  <span>Avg score</span>
                                </div>
                                <Progress value={subj.averageScore} className="h-2 mt-2" />
                              </div>
                            );
                          })}
                        </div>
                        ) : (
                          <div className="h-32 flex items-center justify-center">
                            <p className="text-muted-foreground">Complete quizzes to see subject performance breakdown!</p>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </motion.div>
                )}


                {/* Past Paper Score Trend - always show */}
                {(
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 1.1 }}
                  >
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <FileText className="w-5 h-5 text-primary" />
                          Past Paper Results Trend
                          <Badge variant="secondary" className="ml-2 text-xs">Premium</Badge>
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        {pastPaperTrends.length > 0 ? (
                        <div className="h-[250px]">
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={pastPaperTrends}>
                              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                              <XAxis dataKey="date" className="text-muted-foreground" fontSize={12} />
                              <YAxis domain={[0, 100]} className="text-muted-foreground" fontSize={12} />
                              <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }} />
                              <Line type="step" dataKey="score" stroke="#F59E0B" strokeWidth={3} dot={{ r: 6, fill: '#F59E0B' }} name="Paper Score (%)" />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                        ) : (
                          <div className="h-32 flex items-center justify-center">
                            <p className="text-muted-foreground">Complete past papers and add marks to see your trend!</p>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </motion.div>
                )}

                {/* Exam Performance Trend - always show */}
                {(
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 1.2 }}
                  >
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <Award className="w-5 h-5 text-primary" />
                          Course Exam Performance
                          <Badge variant="secondary" className="ml-2 text-xs">Premium</Badge>
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        {examPerformance.length > 0 ? (
                        <div className="h-[250px]">
                          <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={examPerformance}>
                              <defs>
                                <linearGradient id="colorExams" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="5%" stopColor="#10B981" stopOpacity={0.3} />
                                  <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                                </linearGradient>
                              </defs>
                              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                              <XAxis dataKey="date" className="text-muted-foreground" fontSize={12} />
                              <YAxis domain={[0, 100]} className="text-muted-foreground" fontSize={12} />
                              <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }} />
                              <Area type="monotone" dataKey="score" stroke="#10B981" fillOpacity={1} fill="url(#colorExams)" name="Exam Score (%)" />
                            </AreaChart>
                          </ResponsiveContainer>
                        </div>
                        ) : (
                          <div className="h-32 flex items-center justify-center">
                            <p className="text-muted-foreground">Complete exams to see your performance trend!</p>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </motion.div>
                )}

                {/* Subject Performance Breakdown - Premium Feature */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 1.3 }}
                  className="lg:col-span-2"
                >
                  <SubjectPerformanceSection monthOffset={selectedMonthOffset} />
                </motion.div>
              </motion.div>
            )}

            </motion.div>
            </AnimatePresence>
          </>
        )}

        {/* Achievements Tab */}
        {activeTab === 'achievements' && (
          <>
            {/* Header Stats */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <Card className="bg-gradient-to-r from-primary/10 to-accent-lavender/20">
                <CardContent className="p-6">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
                    <div className="flex items-center gap-4">
                      <div className="w-16 h-16 rounded-2xl bg-primary/20 flex items-center justify-center">
                        <Trophy className="w-8 h-8 text-primary" />
                      </div>
                      <div>
                        <h2 className="text-2xl font-display font-bold text-foreground">
                          Achievements
                        </h2>
                        <p className="text-muted-foreground">
                          {visibleUnlocked.length} of {visibleAchievements.length} unlocked
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-8">
                      <div className="text-center">
                        <p className="text-3xl font-bold text-primary">{points.level}</p>
                        <p className="text-sm text-muted-foreground">Level</p>
                      </div>
                      <div className="text-center">
                        <p className="text-3xl font-bold text-foreground">{earnedPoints}</p>
                        <p className="text-sm text-muted-foreground">Points Earned</p>
                      </div>
                      <div className="text-center">
                        <p className="text-3xl font-bold text-accent-peach-foreground">{points.currentStreak}</p>
                        <p className="text-sm text-muted-foreground">Day Streak</p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-6">
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-muted-foreground">Overall Progress</span>
                      <span className="font-medium">{Math.round(progressPercentage)}%</span>
                    </div>
                    <Progress value={progressPercentage} className="h-3" />
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Achievements by Category */}
            {categories.map((category, categoryIndex) => {
              const categoryAchievements = getAchievementsByCategory(category.id);
              if (categoryAchievements.length === 0) return null;

              return (
                <motion.div
                  key={category.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 * categoryIndex }}
                >
                  <div className="flex items-center gap-3 mb-4">
                    <div className={`w-3 h-3 rounded-full ${category.color}`} />
                    <h2 className="text-xl font-semibold text-foreground">{category.label}</h2>
                    <Badge variant="secondary">
                      {categoryAchievements.filter(a => isAchievementUnlocked(a.id)).length}/{categoryAchievements.length}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {categoryAchievements.map((achievement, index) => {
                      const unlocked = isAchievementUnlocked(achievement.id);
                      const isPremiumAchievement = achievement.is_premium === true;
                      const IconComponent = iconMap[achievement.icon_name] || Star;
                      const isLocked = !unlocked;
                      const isFlipped = flippedAchievementId === achievement.id;

                      return (
                        <motion.div
                          key={achievement.id}
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: 0.05 * index }}
                          onClick={() => setFlippedAchievementId(isFlipped ? null : achievement.id)}
                          className="cursor-pointer perspective-1000"
                        >
                          <motion.div
                            animate={{ rotateY: isFlipped ? 180 : 0 }}
                            transition={{ type: 'spring', stiffness: 260, damping: 20 }}
                            className="relative w-full preserve-3d h-full min-h-[140px]"
                          >
                            {/* Front of Card */}
                            <Card className={`relative overflow-hidden transition-all backface-hidden h-full ${
                              unlocked
                                ? 'hover:shadow-hover border-primary/20'
                                : 'opacity-60 grayscale'
                            }`}>
                              <CardContent className="p-4">
                                <div className="flex items-start gap-4">
                                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                                    unlocked ? category.color : 'bg-muted'
                                  }`}>
                                    {unlocked ? (
                                      <IconComponent className="w-6 h-6 text-foreground" />
                                    ) : (
                                      <Lock className="w-5 h-5 text-muted-foreground" />
                                    )}
                                  </div>
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <h3 className="font-semibold text-foreground">{achievement.name}</h3>
                                      {unlocked && (
                                        <CheckCircle2 className="w-4 h-4 text-green-500" />
                                      )}
                                      {isPremiumAchievement && (
                                        <Badge variant="secondary" className="text-xs bg-amber-500/20 text-amber-700 dark:text-amber-300">
                                          <Crown className="w-3 h-3 mr-1" />
                                          Premium
                                        </Badge>
                                      )}
                                    </div>
                                    <p className="text-sm text-muted-foreground mt-1">
                                      {achievement.description}
                                    </p>
                                    <div className="flex items-center gap-2 mt-2">
                                      <Badge variant="outline" className="text-xs">
                                        +{achievement.points} pts
                                      </Badge>
                                      <p className="text-[10px] text-muted-foreground italic">Click to see how to unlock</p>
                                    </div>
                                  </div>
                                </div>
                              </CardContent>
                              {unlocked && (
                                <div className="absolute top-0 right-0 w-16 h-16 overflow-hidden">
                                  <div className="absolute top-2 right-[-20px] w-16 bg-primary text-primary-foreground text-xs font-medium py-1 rotate-45 text-center">
                                    ✓
                                  </div>
                                </div>
                              )}
                            </Card>

                            {/* Back of Card (How to unlock) */}
                            <Card className="absolute inset-0 overflow-hidden rotate-y-180 backface-hidden border-primary/40 bg-primary/5 h-full">
                              <CardContent className="p-4 flex flex-col items-center justify-center text-center h-full">
                                <Trophy className="w-8 h-8 text-primary mb-2" />
                                <h3 className="font-bold text-foreground text-sm mb-1">How to obtain this achievement</h3>
                                <p className="text-sm text-foreground font-medium">
                                  {getUnlockDescription(achievement)}
                                </p>
                                
                                {!unlocked && (
                                  <div className="w-full mt-4 space-y-1 px-2">
                                    <div className="flex justify-between text-xs text-muted-foreground">
                                      <span>Progress</span>
                                      <span>{Math.floor(getAchievementProgress(achievement).percentage)}%</span>
                                    </div>
                                    <Progress value={getAchievementProgress(achievement).percentage} className="h-2" />
                                    <p className="text-[10px] text-muted-foreground text-right mt-1">
                                      {getAchievementProgress(achievement).current} / {achievement.requirement_value}
                                    </p>
                                  </div>
                                )}

                                <p className="text-[10px] text-muted-foreground mt-3 italic">Click to flip back</p>
                              </CardContent>
                            </Card>
                          </motion.div>
                        </motion.div>
                      );
                    })}
                  </div>
                </motion.div>
              );
            })}
          </>
        )}
      </div>
      <UpgradeModal open={isUpgradeModalOpen} onOpenChange={setIsUpgradeModalOpen} currentTier={tier === 'tier1' || tier === 'tier2' ? tier : 'free'} />
    </AppLayout>
  );
};

export default Insights;
