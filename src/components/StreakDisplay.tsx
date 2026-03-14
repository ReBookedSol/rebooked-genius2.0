import { motion } from 'framer-motion';
import { Flame, Trophy } from 'lucide-react';
import { useEffect } from 'react';
import { useUserPoints } from '@/hooks/useUserPoints';
import { useTranslation } from '@/hooks/use-translation';

export const StreakDisplay = () => {
  const { points, loading, refreshPoints } = useUserPoints();
  const { t } = useTranslation();

  // Refresh streak data when component mounts, periodically, and on study events
  useEffect(() => {
    refreshPoints();

    // Refresh every 30 seconds
    const interval = setInterval(refreshPoints, 30000);

    // Refresh when page becomes visible
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        refreshPoints();
      }
    };

    // Refresh immediately when a study session completes
    const handleStudyCompleted = () => {
      refreshPoints();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('studySessionCompleted', handleStudyCompleted);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('studySessionCompleted', handleStudyCompleted);
    };
  }, [refreshPoints]);

  if (loading) {
    return (
      <div className="flex items-center gap-6 animate-pulse">
        <div className="h-10 w-24 bg-muted rounded-xl" />
        <div className="h-10 w-24 bg-muted rounded-xl" />
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-center gap-4"
    >
      {/* Current Streak */}
      <motion.div
        whileHover={{ scale: 1.05 }}
        className="flex items-center gap-2 bg-gradient-to-r from-accent-peach/50 to-accent-peach/30 px-4 py-2 rounded-xl"
      >
        <Flame className="w-5 h-5 text-orange-500" />
        <div>
          <p className="text-lg font-bold text-foreground">{points.currentStreak}</p>
          <p className="text-xs text-muted-foreground">{t('streak.dayStreak')}</p>
        </div>
      </motion.div>

      {/* Best Streak */}
      {points.longestStreak > points.currentStreak && (
        <motion.div
          whileHover={{ scale: 1.05 }}
          className="flex items-center gap-2 bg-gradient-to-r from-accent-mint/50 to-accent-mint/30 px-4 py-2 rounded-xl"
        >
          <Trophy className="w-5 h-5 text-primary" />
          <div>
            <p className="text-lg font-bold text-foreground">{points.longestStreak}</p>
            <p className="text-xs text-muted-foreground">{t('streak.bestStreak')}</p>
          </div>
        </motion.div>
      )}
    </motion.div>
  );
};

export default StreakDisplay;
