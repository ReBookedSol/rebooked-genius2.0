import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent
} from '@/components/ui/tabs';
import {
  BarChart3,
  BookOpen,
  Clock,
  Award,
  Plus,
  ChevronRight,
  Zap,
  Target,
  Brain,
  TrendingUp,
  FileText,
  Upload,
  Link as LinkIcon,
  Menu,
  X,
  Sparkles,
  Lock,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import AppLayout from '@/components/layout/AppLayout';
import { useTranslation } from '@/hooks/use-translation';
import { usePageAnimation } from '@/hooks/use-page-animation';
import { useAIContext } from '@/contexts/AIContext';
import { AIGenerateButton } from '@/components/AIGenerateButton';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useSubscription } from '@/hooks/useSubscription';
import { useNBTTestAttempts } from '@/hooks/use-nbt-practice-tests';
import { UpgradeModal } from '@/components/subscription/UpgradeModal';
import NBTIntroduction from '@/components/nbt/NBTIntroduction';
import NBTStudyMaterials from '@/components/nbt/NBTStudyMaterials';
import NBTPracticeQuestions from '@/components/nbt/NBTPracticeQuestions';
import NBTDataInterpretation from '@/components/nbt/NBTDataInterpretation';
import NBTProgressTracking from '@/components/nbt/NBTProgressTracking';
import NBTLogistics from '@/components/nbt/NBTLogistics';
import NBTUniversityGuidance from '@/components/nbt/NBTUniversityGuidance';
import NBTMindsetTools from '@/components/nbt/NBTMindsetTools';
import CombinedUploadSection from '@/components/study/CombinedUploadSection';
import { cn } from '@/lib/utils';

interface NBTTest {
  id: string;
  title: string;
  date: string;
  score: number;
  maxScore: number;
  duration: number;
  section?: string;
  memo_url?: string;
}

interface TabItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  description: string;
}

const NBT = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { toast } = useToast();
  const { tier, canAccessNbt } = useSubscription();
  const { setAiContext } = useAIContext();
  const { shouldAnimate } = usePageAnimation('NBT');
  const isPremium = canAccessNbt();
  const [activeTab, setActiveTab] = useState(isPremium ? 'progress' : 'introduction');
  const { attempts: fetchedAttempts, loading: attemptsLoading } = useNBTTestAttempts();
  const [tests, setTests] = useState<NBTTest[]>([]);
  const [showUpgrade, setShowUpgrade] = useState(false);

  // Sync fetched attempts to tests state
  useEffect(() => {
    if (fetchedAttempts && fetchedAttempts.length > 0) {
      const mappedTests: NBTTest[] = fetchedAttempts.map(attempt => ({
        id: attempt.id,
        title: attempt.section ? `${attempt.section} Test` : 'NBT Test',
        date: attempt.completed_at ? new Date(attempt.completed_at).toLocaleDateString() : new Date(attempt.created_at || '').toLocaleDateString(),
        score: Number(attempt.total_score || 0),
        maxScore: Number(attempt.max_score || 100),
        duration: Math.round((attempt.time_taken_seconds || 0) / 60),
        section: attempt.section || undefined,
      }));
      setTests(mappedTests);
    }
  }, [fetchedAttempts]);

  // Detect if user is on mobile
  // Mobile detection for sidebar is no longer needed as sidebar is replaced by tabs

  const averageScore = tests.length > 0
    ? Math.round(tests.reduce((acc, test) => acc + (test.score / test.maxScore) * 100, 0) / tests.length)
    : 0;

  const highestScore = tests.length > 0
    ? Math.max(...tests.map(t => Math.round((t.score / t.maxScore) * 100)))
    : 0;

  useEffect(() => {
    setAiContext({
      currentPage: 'nbt',
      location: `NBT Preparation - ${activeTab} section`,
      activeAnalytics: {
        view: 'nbt',
        context: `User has completed ${tests.length} NBT tests with an average score of ${averageScore}%. Current section: ${activeTab}.`,
        nbtAnalytics: {
          testsTaken: tests.length,
          averageScore: averageScore,
          sections: tests.map(t => ({ section: t.section || 'Unknown', score: Math.round((t.score / t.maxScore) * 100) }))
        }
      },
      activeDocument: null,
      activePaper: null
    });
  }, [activeTab, tests.length, averageScore, tests, setAiContext]);

  const tabs: TabItem[] = [
    {
      id: 'introduction',
      label: t('nbt.introduction'),
      icon: <BookOpen className="w-4 h-4" />,
      description: t('nbt.aboutNbtDesc'),
    },
    {
      id: 'study',
      label: t('nbt.studyMaterials'),
      icon: <Brain className="w-4 h-4" />,
      description: t('nbt.studyMaterialsDesc'),
    },
    {
      id: 'practice',
      label: t('nbt.practice'),
      icon: <Target className="w-4 h-4" />,
      description: t('nbt.practiceDesc'),
    },
    {
      id: 'progress',
      label: t('nbt.overviewProgress'),
      icon: <Award className="w-4 h-4" />,
      description: t('nbt.progressDesc'),
    },
  ];

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0, transition: { duration: 0.5 } },
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'introduction':
        return (
          <div className="space-y-6">
            <NBTIntroduction />
            <div className="border-t border-border pt-6">
              <h2 className="text-2xl font-bold text-foreground mb-4 flex items-center gap-2">
                <FileText className="w-6 h-6 text-primary" />
                {t('nbt.registrationLogistics')}
              </h2>
              <NBTLogistics />
            </div>
            <div className="border-t border-border pt-6">
              <h2 className="text-2xl font-bold text-foreground mb-4 flex items-center gap-2">
                <Zap className="w-6 h-6 text-primary" />
                {t('nbt.universityGuidance')}
              </h2>
              <NBTUniversityGuidance />
            </div>
            <div className="border-t border-border pt-6">
              <h2 className="text-2xl font-bold text-foreground mb-4 flex items-center gap-2">
                <Brain className="w-6 h-6 text-primary" />
                {t('nbt.mindsetExamPrep')}
              </h2>
              <NBTMindsetTools />
            </div>
          </div>
        );
      case 'study':
        return (
          <div className="space-y-8">
            <div className="w-full">
              <NBTStudyMaterials />
            </div>
          </div>
        );
      case 'practice':
        return (
          <div className="space-y-6">
            <NBTPracticeQuestions onTestCreated={(test) => setTests([...tests, test])} />
            <div className="border-t border-border pt-6">
              <h2 className="text-2xl font-bold text-foreground mb-4 flex items-center gap-2">
                <BarChart3 className="w-6 h-6 text-primary" />
                {t('nbt.dataInterpretation')}
              </h2>
              <NBTDataInterpretation />
            </div>
          </div>
        );
      case 'progress':
        return <NBTProgressTracking tests={tests} onManualEntry={(newTest) => setTests([newTest, ...tests])} />;
      default:
        return null;
    }
  };

  return (
    <AppLayout>
      <div className="flex flex-col min-h-[calc(100vh-120px)] gap-6 lg:gap-8 max-w-7xl mx-auto w-full px-4 lg:px-8">
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 mt-4">
          <div>
            <h1 className="text-3xl font-display font-black text-foreground tracking-tight leading-none">
              NBT <span className="text-primary">{t('nbt.genius')}</span>
            </h1>
            <p className="text-muted-foreground mt-2">{t('nbt.comprehensivePrep')}</p>
          </div>

          {!isPremium && (
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                className="rounded-full font-bold shadow-sm border-primary/20 hover:border-primary/50 text-primary"
                onClick={() => setShowUpgrade(true)}
              >
                <Sparkles className="w-4 h-4 mr-2" />
                Upgrade to Premium
              </Button>
            </div>
          )}
        </header>

        <Tabs value={activeTab} onValueChange={(val) => {
          if (!isPremium && val !== 'introduction') {
            setShowUpgrade(true);
            return;
          }
          setActiveTab(val);
        }} className="w-full">
          <div className="flex justify-center mb-6 sm:mb-10 pb-1">
            <TabsList className="inline-flex h-auto p-1.5 bg-muted/30 backdrop-blur-sm rounded-2xl border border-border/40 flex-wrap justify-center gap-1 w-full sm:w-auto">
              {tabs.map((tab) => (
                <TabsTrigger
                  key={tab.id}
                  value={tab.id}
                  className={cn(
                     "flex items-center gap-2 py-2 px-3 sm:px-4 rounded-xl transition-all duration-300",
                     "data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-sm data-[state=active]:ring-1 data-[state=active]:ring-border/50",
                    "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                  )}
                >
                  <div className={cn(
                    "transition-colors",
                    activeTab === tab.id ? "text-primary" : "text-muted-foreground"
                  )}>
                    {tab.icon}
                  </div>
                  <span className="font-semibold text-sm tracking-tight">{tab.label}</span>
                  {!isPremium && tab.id !== 'introduction' && (
                    <Lock className="w-3 h-3 text-muted-foreground/60" />
                  )}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
              className="w-full"
            >
              <TabsContent value={activeTab} className="mt-6 focus-visible:ring-0">
                {renderContent()}
              </TabsContent>
            </motion.div>
          </AnimatePresence>
        </Tabs>
      </div>

      {/* Upgrade Modal */}
      <UpgradeModal
        open={showUpgrade}
        onOpenChange={setShowUpgrade}
        currentTier={tier}
        highlightedFeature="NBT Preparation"
      />
    </AppLayout>
  );
};

export default NBT;
