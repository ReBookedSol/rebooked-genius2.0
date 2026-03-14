import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Play, Pause, Square, Timer, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useStudyTimer } from '@/hooks/useStudyTimer';
import { useStudyTimeTracking } from '@/hooks/useStudyTimeTracking';
import { useTranslation } from '@/hooks/use-translation';

const TIMER_VISIBLE_KEY = 'mobile_timer_visible';

export const MobileStudyTimer = () => {
  const timer = useStudyTimer();
  const { endSession } = useStudyTimeTracking();
  const { t } = useTranslation();
  const prevIsRunningRef = useRef(timer.isRunning);
  const [isVisible, setIsVisible] = useState(() => {
    try {
      const saved = localStorage.getItem(TIMER_VISIBLE_KEY);
      return saved !== 'false';
    } catch {
      return true;
    }
  });

  useEffect(() => {
    localStorage.setItem(TIMER_VISIBLE_KEY, String(isVisible));
  }, [isVisible]);

  // Sync analytics when timer stops (desktop StudyTimer handles the DB session creation,
  // mobile just needs to detect stop transition)
  useEffect(() => {
    prevIsRunningRef.current = timer.isRunning;
  }, [timer.isRunning]);

  // Show timer button when hidden
  if (!isVisible) {
    return (
      <motion.button
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        className="fixed bottom-20 right-4 z-40 w-12 h-12 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center lg:hidden"
        onClick={() => setIsVisible(true)}
      >
        <Timer className="w-5 h-5" />
      </motion.button>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="fixed bottom-20 left-4 right-4 z-40 lg:hidden"
    >
      <div className="bg-card border border-border rounded-2xl shadow-lg p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Timer className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{t('components.studyTimer')}</p>
              <p className="text-xl font-mono font-bold text-foreground">
                {timer.formattedTime}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {!timer.isRunning ? (
              <Button
                size="sm"
                onClick={() => timer.start()}
                className="h-9"
              >
                <Play className="w-4 h-4 mr-1" />
                {t('components.start')}
              </Button>
            ) : (
              <>
                {timer.isPaused ? (
                  <Button size="icon" onClick={timer.resume} className="h-9 w-9" title={t('components.resume')}>
                    <Play className="w-4 h-4" />
                  </Button>
                ) : (
                  <Button size="icon" variant="secondary" onClick={timer.pause} className="h-9 w-9" title={t('components.pause')}>
                    <Pause className="w-4 h-4" />
                  </Button>
                )}
                <Button size="icon" variant="destructive" onClick={timer.stop} className="h-9 w-9">
                  <Square className="w-4 h-4" />
                </Button>
              </>
            )}
            <Button
              size="icon"
              variant="ghost"
              onClick={() => setIsVisible(false)}
              className="h-9 w-9"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default MobileStudyTimer;
