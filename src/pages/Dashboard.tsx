import { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { usePageAnimation } from '@/hooks/use-page-animation';
import {
  Clock,
  BookOpen,
  TrendingUp,
  CheckCircle2,
  Bell,
  ChevronRight,
  Brain,
  Layers,
  Palette,
  FileText,
  MessageSquare,
  BarChart3,
  Timer,
  Settings,
  Home,
  GraduationCap
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { useAuth } from '@/contexts/AuthContext';
import { useAIContext } from '@/contexts/AIContext';
import { supabase } from '@/integrations/supabase/client';
import AppLayout from '@/components/layout/AppLayout';
import StreakDisplay from '@/components/StreakDisplay';
import AddReminderDialog from '@/components/AddReminderDialog';
import FirstLoginModal from '@/components/FirstLoginModal';
import EventCalendar from '@/components/EventCalendar';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from '@/hooks/use-translation';
import { useSubscription } from '@/hooks/useSubscription';

interface Reminder {
  id: string;
  title: string;
  due_date: string;
  priority: string;
  is_completed: boolean;
}

interface StudyStats {
  totalStudyMinutes: number;
  averageScore: number;
  testsCompleted: number;
  studyStreak: number;
  flashcardsMastered: number;
  knowledgeItems: number;
}

const Dashboard = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { setAiContext } = useAIContext();
  const { shouldAnimate } = usePageAnimation('Dashboard');
  const { t } = useTranslation();
  const { storage, tier } = useSubscription();
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [stats, setStats] = useState<StudyStats>({
    totalStudyMinutes: 0,
    averageScore: 0,
    testsCompleted: 0,
    studyStreak: 0,
    flashcardsMastered: 0,
    knowledgeItems: 0,
  });
  const [loading, setLoading] = useState(true);
  const [showFirstLoginModal, setShowFirstLoginModal] = useState(false);
  const [userFullName, setUserFullName] = useState<string>('');
  const [recentDocument, setRecentDocument] = useState<{ id: string; name: string } | null>(null);
  const [recentPaper, setRecentPaper] = useState<{ id: string; name: string } | null>(null);

  const firstName = userFullName?.split(' ')[0] || user?.user_metadata?.full_name?.split(' ')[0] || 'Student';

  // Build Quick Actions dynamically
  interface QuickAction {
    icon: React.ElementType;
    label: string;
    path: string;
    color: string;
    title?: string;
  }

  const baseActions: QuickAction[] = [
    { icon: Home, label: t('nav.dashboard'), path: '/', color: 'bg-primary/10 text-primary' },
    { icon: Palette, label: t('nav.whiteboard'), path: '/whiteboard', color: 'bg-accent-pink text-accent-pink-foreground' },
    { icon: FileText, label: t('nav.pastPapers'), path: '/papers', color: 'bg-accent-yellow text-accent-yellow-foreground' },
    { icon: BarChart3, label: t('nav.insights'), path: '/analytics', color: 'bg-secondary text-secondary-foreground' },
    { icon: Settings, label: t('nav.settings'), path: '/settings', color: 'bg-muted text-muted-foreground' },
  ];

  const quickActions: QuickAction[] = [
    ...baseActions,
    ...(recentDocument ? [{ icon: BookOpen, label: t('common.recent'), path: `/study/${recentDocument.id}`, color: 'bg-accent-mint text-accent-mint-foreground', title: recentDocument.name }] : []),
    ...(recentPaper ? [{ icon: GraduationCap, label: t('common.paper'), path: `/papers`, color: 'bg-accent-lavender text-accent-lavender-foreground', title: recentPaper.name }] : []),
  ];

  const fetchDashboardData = useCallback(async () => {
    if (!user) return;

    try {
      // Fetch reminders
      const { data: reminderData } = await supabase
        .from('reminders')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_completed', false)
        .order('due_date', { ascending: true })
        .limit(5);

      if (reminderData) setReminders(reminderData);

      // Fetch most recent document
      const { data: recentDocData } = await supabase
        .from('study_documents')
        .select('id, file_name')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (recentDocData) {
        setRecentDocument({ id: recentDocData.id, name: recentDocData.file_name });
      }

      // Fetch most recent past paper (from documents or a specific table)
      const { data: recentPaperData } = await supabase
        .from('study_documents')
        .select('id, file_name')
        .eq('user_id', user.id)
        // Using common keywords to identify past papers in study_documents
        .or('file_name.ilike.%paper%,file_name.ilike.%past%,file_name.ilike.%exam%')
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (recentPaperData) {
        setRecentPaper({ id: recentPaperData.id, name: recentPaperData.file_name });
      }

      // Fetch analytics - only current month to match analytics page
      const currentMonthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
      const currentMonthEnd = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString().split('T')[0];
      const { data: analyticsData } = await supabase
        .from('study_analytics')
        .select('*')
        .eq('user_id', user.id)
        .gte('date', currentMonthStart)
        .lte('date', currentMonthEnd)
        .order('date', { ascending: false });

      // Fetch user points for streak
      const { data: userPoints } = await supabase
        .from('user_points')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      // Fetch flashcard stats (excluding NBT decks)
      const { data: flashcardDecks } = await supabase
        .from('flashcard_decks')
        .select('mastered_cards, title, nbt_lesson_id')
        .eq('user_id', user.id);

      // Fetch knowledge items count
      const { count: knowledgeCount } = await supabase
        .from('knowledge_base')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('is_active', true);

      // Fetch all subject summaries to calculate average across subjects
      const { data: subjectSummaries } = await supabase
        .from('subject_analytics_summary')
        .select('*')
        .eq('user_id', user.id);

      let subjectAvgSum = 0;
      let subjectCount = 0;

      if (subjectSummaries && subjectSummaries.length > 0) {
        // For each subject, we need to calculate its performance
        // Since combined performance isn't in the DB, we'll use average_quiz_score as a proxy
        // OR we can fetch the actual assessments. For dashboard performance, let's use the summary data.
        subjectSummaries.forEach(s => {
          if (s.average_quiz_score > 0 || s.progress_percentage > 0) {
            // We'll average the quiz score and flashcard progress as a simple proxy for subject performance
            // if we want to be very accurate we'd need a more complex query or stored property
            let score = 0;
            let weights = 0;
            if (s.average_quiz_score > 0) {
              score += s.average_quiz_score;
              weights++;
            }
            if (s.progress_percentage > 0) {
              score += s.progress_percentage;
              weights++;
            }

            if (weights > 0) {
              subjectAvgSum += (score / weights);
              subjectCount++;
            }
          }
        });
      }

      if (analyticsData && analyticsData.length > 0) {
        const totalMinutes = analyticsData.reduce((acc, d) => acc + (d.total_study_minutes || 0), 0);
        const testsCount = analyticsData.reduce((acc, d) => acc + (d.tests_attempted || 0), 0);

        // Use subject-based average if available, otherwise fallback to test-based
        const averageScore = subjectCount > 0
          ? subjectAvgSum / subjectCount
          : (testsCount > 0
              ? analyticsData.reduce((acc, d) => acc + (Number(d.average_score || 0) * (d.tests_attempted || 0)), 0) / testsCount
              : 0);

        const nonNBTDecks = (flashcardDecks || []).filter(d => !d.title?.toUpperCase().includes('NBT') && !d.nbt_lesson_id);
        const flashcardsMastered = nonNBTDecks.reduce((acc, d) => acc + (d.mastered_cards || 0), 0);

        setStats({
          totalStudyMinutes: totalMinutes,
          averageScore: Math.round(averageScore),
          testsCompleted: testsCount,
          studyStreak: userPoints?.current_streak || 0,
          flashcardsMastered,
          knowledgeItems: knowledgeCount || 0,
        });
      } else if (userPoints) {
        setStats(prev => ({
          ...prev,
          studyStreak: userPoints.current_streak || 0,
        }));
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchDashboardData();

    // Listen for study timer completion to update stats immediately
    const handleStudyComplete = () => {
      fetchDashboardData();
    };
    
    window.addEventListener('studySessionCompleted', handleStudyComplete);
    return () => window.removeEventListener('studySessionCompleted', handleStudyComplete);
  }, [fetchDashboardData]);

  // Subscribe to real-time updates to study_analytics
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`study_analytics_${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'study_analytics',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          // Refresh dashboard data when new study analytics are added
          fetchDashboardData();
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
          // Refresh dashboard data when study analytics are updated
          fetchDashboardData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, fetchDashboardData]);

  useEffect(() => {
    setAiContext({
      currentPage: 'dashboard',
      location: 'Student Dashboard Overview',
      activeAnalytics: {
        view: 'summary',
        context: `User stats: ${Math.round(stats.totalStudyMinutes / 60)}h study time, ${stats.averageScore}% avg score, ${stats.studyStreak} day streak, ${stats.flashcardsMastered} flashcards mastered.`,
        totalStudyMinutes: stats.totalStudyMinutes,
        averageScore: stats.averageScore,
        testsCompleted: stats.testsCompleted,
        studyStreak: stats.studyStreak,
        flashcardsMastered: stats.flashcardsMastered,
      },
      activeDocument: null,
      activePaper: null
    });
  }, [stats.totalStudyMinutes, stats.averageScore, stats.studyStreak, stats.flashcardsMastered, stats.testsCompleted, setAiContext]);

  // Check if this is the user's first login and fetch user's full name
  useEffect(() => {
    const checkFirstLoginAndFetchName = async () => {
      if (!user) return;

      try {
        const { data: profile } = await supabase
          .from('profiles')
          .select('login_count, full_name')
          .eq('user_id', user.id)
          .maybeSingle();

        // Set the user's full name from profile
        if (profile?.full_name) {
          setUserFullName(profile.full_name);
        }

        // Show modal if login_count is 0, null, or undefined
        if (!profile?.login_count || profile.login_count === 0) {
          setShowFirstLoginModal(true);
        }
      } catch (error) {
        console.error('Error checking first login:', error);
      }
    };

    checkFirstLoginAndFetchName();
  }, [user]);

  // Check for due reminders and insert notifications
  useEffect(() => {
    if (!user) return;

    const checkDueReminders = async () => {
      const now = new Date();
      const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

      // Fetch all non-completed reminders that are due within 24 hours or past due
      const { data: dueReminders } = await supabase
        .from('reminders')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_completed', false)
        .lte('due_date', tomorrow.toISOString());

      if (dueReminders && dueReminders.length > 0) {
        for (const reminder of dueReminders) {
          const dueDate = new Date(reminder.due_date);
          const isPastDue = dueDate <= now;
          const hoursUntil = (dueDate.getTime() - now.getTime()) / (1000 * 60 * 60);

          let notificationTitle = `Reminder: ${reminder.title}`;
          let message = `Your reminder "${reminder.title}" is due soon.`;
          let type = 'reminder_near';

          if (isPastDue) {
            notificationTitle = `Reminder Due: ${reminder.title}`;
            message = `Your reminder "${reminder.title}" is now due.`;
            type = 'reminder_due';
          } else if (hoursUntil <= 1) {
            notificationTitle = `Reminder Starting Soon: ${reminder.title}`;
            message = `Your reminder "${reminder.title}" is due in less than an hour.`;
            type = 'reminder_hour';
          }

          // Check if notification already exists to avoid duplicates
          // Use a combination of title and type to allow multiple stages of notifications
          const { data: existing } = await supabase
            .from('notifications')
            .select('id')
            .eq('user_id', user.id)
            .eq('title', notificationTitle)
            .maybeSingle();

          if (!existing) {
            await supabase.from('notifications').insert({
              user_id: user.id,
              title: notificationTitle,
              message: message,
              type: type,
            });

            toast({
              title: notificationTitle,
              description: message,
            });
          }
        }
      }
    };

    checkDueReminders();
    const interval = setInterval(checkDueReminders, 60000); // Check every minute
    return () => clearInterval(interval);
  }, [user, toast]);

  // Check storage usage and warn if near 90%
  useEffect(() => {
    if (!storage || !user) return;
    if (storage.percentageUsed >= 90 && !sessionStorage.getItem('storage_90_warned')) {
      sessionStorage.setItem('storage_90_warned', 'true');
      toast({
        title: '⚠️ Storage Almost Full',
        description: `You're using ${storage.percentageUsed}% of your storage. Consider deleting unused documents or upgrading your plan.`,
      });
      // Also save as a notification
      supabase.from('notifications').insert({
        user_id: user.id,
        title: '⚠️ Storage Almost Full',
        message: `You're using ${storage.percentageUsed}% of your storage.`,
        type: 'storage_warning',
        link: '/settings/storage',
      }).then(() => {});
    }
  }, [storage, user, toast]);

  const handleCompleteReminder = async (reminderId: string) => {
    try {
      const { error } = await supabase
        .from('reminders')
        .update({ is_completed: true, completed_at: new Date().toISOString() })
        .eq('id', reminderId);

      if (error) throw error;

      setReminders(prev => prev.filter(r => r.id !== reminderId));
      toast({
        title: t('dashboardSections.completed'),
        description: t('dashboardSections.reminderMarkedDone'),
      });
    } catch (error) {
      console.error('Error completing reminder:', error);
    }
  };


  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-destructive';
      case 'medium': return 'bg-amber-500';
      default: return 'bg-muted-foreground';
    }
  };

  return (
    <AppLayout>
      <FirstLoginModal
        isOpen={showFirstLoginModal}
        onClose={() => setShowFirstLoginModal(false)}
      />
      <div className="space-y-6">
        {/* Header with Streak Display */}
        <motion.div
          initial={shouldAnimate ? { opacity: 0, y: 20 } : { opacity: 1, y: 0 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4"
        >
          <div>
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-display font-bold text-foreground">
              Welcome back, {firstName}! 👋
            </h1>
            <p className="text-muted-foreground mt-1 text-xs sm:text-sm lg:text-base">
              {format(new Date(), 'EEEE, MMMM d, yyyy')}
            </p>
          </div>
          <StreakDisplay />
        </motion.div>

        {/* Stats Cards */}
        <motion.div
          initial={shouldAnimate ? { opacity: 0, y: 20 } : { opacity: 1, y: 0 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: shouldAnimate ? 0.1 : 0 }}
          className="grid grid-cols-2 lg:grid-cols-3 gap-3 lg:gap-4"
        >
          <Card className="bg-gradient-to-br from-primary/10 to-primary/5">
            <CardContent className="p-3 sm:p-4 lg:p-6">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-primary/20 flex items-center justify-center">
                  <Clock className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
                </div>
                <div>
                  <p className="text-base sm:text-lg lg:text-xl font-bold text-foreground">
                    {Math.floor(stats.totalStudyMinutes / 60)}h {Math.round(stats.totalStudyMinutes % 60)}m
                  </p>
                  <p className="text-[10px] sm:text-xs text-muted-foreground">{t('dashboardCards.studyTime')}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-accent-mint/30 to-accent-mint/10">
            <CardContent className="p-3 sm:p-4 lg:p-6">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-accent-mint flex items-center justify-center">
                  <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5 text-accent-mint-foreground" />
                </div>
                <div>
                  <p className="text-base sm:text-lg lg:text-xl font-bold text-foreground">{stats.averageScore}%</p>
                  <p className="text-[10px] sm:text-xs text-muted-foreground">{t('dashboardCards.avgScore')}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-accent-lavender/30 to-accent-lavender/10 col-span-2 lg:col-span-1">
            <CardContent className="p-3 sm:p-4 lg:p-6">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-accent-lavender flex items-center justify-center">
                  <Layers className="w-4 h-4 sm:w-5 sm:h-5 text-accent-lavender-foreground" />
                </div>
                <div>
                  <p className="text-base sm:text-lg lg:text-xl font-bold text-foreground">{stats.testsCompleted}</p>
                  <p className="text-[10px] sm:text-xs text-muted-foreground">{t('dashboardCards.quizzesDone')}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Quick Actions */}
        <motion.div
          initial={shouldAnimate ? { opacity: 0, y: 20 } : { opacity: 1, y: 0 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: shouldAnimate ? 0.15 : 0 }}
        >
          <Card>
            <CardHeader className="pb-2 lg:pb-3">
              <CardTitle className="text-base lg:text-lg">{t('dashboardSections.quickActions')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex justify-center items-center gap-2 sm:gap-3 md:gap-4 w-full flex-wrap">
                {quickActions.map((action, index) => (
                  <Link key={action.label} to={action.path} title={action.title || action.label} className="flex-shrink-0">
                    <motion.div
                      initial={shouldAnimate ? { opacity: 0, scale: 0.9 } : { opacity: 1, scale: 1 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: shouldAnimate ? 0.02 * index : 0 }}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      className="flex flex-col items-center gap-1 p-2 sm:p-2.5 md:p-3 rounded-lg hover:bg-secondary/50 transition-colors cursor-pointer"
                    >
                      <div className={`w-9 h-9 sm:w-10 sm:h-10 md:w-11 md:h-11 rounded-lg flex items-center justify-center flex-shrink-0 ${action.color}`}>
                        <action.icon className="w-4 h-4 sm:w-5 sm:h-5 md:w-5 md:h-5" />
                      </div>
                      <span className="text-[10px] sm:text-xs md:text-xs text-center font-medium text-foreground leading-tight line-clamp-2 max-w-[55px] sm:max-w-[60px] md:max-w-[65px]">
                        {action.label}
                      </span>
                    </motion.div>
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Calendar and Reminders Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
          {/* Calendar Section */}
          <motion.div
            initial={shouldAnimate ? { opacity: 0, y: 20 } : { opacity: 1, y: 0 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: shouldAnimate ? 0.2 : 0 }}
            className="w-full"
          >
            <EventCalendar onEventClick={(event) => console.log('Event clicked:', event)} />
          </motion.div>

          {/* Reminders Section */}
          <motion.div
            initial={shouldAnimate ? { opacity: 0, y: 20 } : { opacity: 1, y: 0 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: shouldAnimate ? 0.3 : 0 }}
            className="w-full"
          >
            <Card className="h-full">
              <CardHeader className="flex flex-row items-center justify-between py-3 lg:py-4">
                <CardTitle className="flex items-center gap-2 text-base lg:text-lg">
                  <Bell className="w-4 h-4 lg:w-5 lg:h-5 text-primary" />
                  {t('dashboardSections.reminders')}
                </CardTitle>
                <AddReminderDialog onReminderAdded={fetchDashboardData} />
              </CardHeader>
              <CardContent>
                {reminders.length === 0 ? (
                  <div className="text-center py-6 lg:py-8">
                    <Bell className="w-10 h-10 lg:w-12 lg:h-12 text-muted-foreground mx-auto mb-3 lg:mb-4" />
                    <p className="text-sm text-muted-foreground">{t('dashboardSections.noReminders')}</p>
                  </div>
                ) : (
                  <div className="space-y-2 lg:space-y-3">
                    {reminders.map((reminder, index) => (
                      <motion.div
                        key={reminder.id}
                        initial={shouldAnimate ? { opacity: 0, x: 20 } : { opacity: 1, x: 0 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: shouldAnimate ? 0.1 * index : 0 }}
                        className="flex items-start gap-3 p-2 lg:p-3 rounded-xl bg-secondary/50"
                      >
                        <Checkbox
                          checked={reminder.is_completed}
                          onCheckedChange={() => handleCompleteReminder(reminder.id)}
                          className="mt-0.5"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-foreground text-sm truncate">{reminder.title}</p>
                          <p className="text-xs text-muted-foreground">
                            Due: {format(new Date(reminder.due_date), 'MMM d, h:mm a')}
                          </p>
                        </div>
                        <div className={`w-2 h-2 rounded-full ${getPriorityColor(reminder.priority)}`} />
                      </motion.div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>

    </AppLayout>
  );
};

export default Dashboard;
