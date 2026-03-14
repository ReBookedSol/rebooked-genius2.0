import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Pause, Square, X, ChevronUp, Timer, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useStudyTimer } from '@/hooks/useStudyTimer';
import { useStudyTimeTracking } from '@/hooks/useStudyTimeTracking';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useSidebar } from '@/contexts/SidebarContext';
import { useToast } from '@/hooks/use-toast';

const TIMER_STATE_KEY = 'study_timer_state';

interface Subject {
  id: string;
  name: string;
  color: string;
}

interface TimerState {
  isMinimized: boolean;
  isClosed: boolean;
}

export const StudyTimer = () => {
  const { user } = useAuth();
  const timer = useStudyTimer();
  const { startSession, endSession } = useStudyTimeTracking();
  const { toast } = useToast();
  const { setChatVisible, setIsChatExpanded } = useSidebar();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [selectedSubject, setSelectedSubject] = useState<string>('');
  const [minutesInput, setMinutesInput] = useState<string>('25');
  const [swipeStartX, setSwipeStartX] = useState<number | null>(null);
  const timerRef = useRef<HTMLDivElement>(null);
  const dbSessionIdRef = useRef<string | null>(null);
  const prevIsRunningRef = useRef(false);

  // Initialize state from localStorage
  const [timerState, setTimerState] = useState<TimerState>(() => {
    try {
      const saved = localStorage.getItem(TIMER_STATE_KEY);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.error('Error parsing timer state:', e);
    }
    return { isMinimized: false, isClosed: false };
  });

  // Persist state to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem(TIMER_STATE_KEY, JSON.stringify(timerState));
  }, [timerState]);

  const setIsMinimized = (value: boolean) => {
    setTimerState(prev => ({ ...prev, isMinimized: value }));
  };

  const setIsClosed = (value: boolean) => {
    setTimerState(prev => ({ ...prev, isClosed: value }));
  };

  // Auto-stop when timer reaches 0, and sync to analytics when timer stops
  useEffect(() => {
    // This is a safety net - the timer hook now handles stopping at 0 properly
    if (!timer.isRunning && timer.seconds === 0 && timer.totalSeconds === 0 && dbSessionIdRef.current) {
      endSession(dbSessionIdRef.current).then(() => {
        dbSessionIdRef.current = null;
      });
    }
  }, [timer.isRunning, timer.seconds, timer.totalSeconds, endSession]);

  // Track timer start/stop transitions and sync to analytics DB
  useEffect(() => {
    const wasRunning = prevIsRunningRef.current;
    const isNowRunning = timer.isRunning;
    prevIsRunningRef.current = isNowRunning;

    // Timer just stopped - sync to analytics
    if (wasRunning && !isNowRunning && dbSessionIdRef.current) {
      endSession(dbSessionIdRef.current).then(() => {
        dbSessionIdRef.current = null;
      });
    }
  }, [timer.isRunning, endSession]);

  useEffect(() => {
    const fetchSubjects = async () => {
      if (!user) return;

      const { data: userSubjects } = await supabase
        .from('user_subjects')
        .select('subject_id, subjects(*)')
        .eq('user_id', user.id);

      // Always include "General Study" option
      const generalStudy: Subject = {
        id: 'general',
        name: 'General Study',
        color: '#6B7280',
      };

      if (userSubjects && userSubjects.length > 0) {
        const subs = userSubjects.map((us: any) => ({
          id: us.subjects.id,
          name: us.subjects.name,
          color: us.subjects.color || '#22c55e',
        }));
        setSubjects([generalStudy, ...subs]);
      } else {
        setSubjects([generalStudy]);
      }
    };

    fetchSubjects();
  }, [user]);

  // Swipe handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    setSwipeStartX(e.touches[0].clientX);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (swipeStartX === null) return;

    const swipeEndX = e.changedTouches[0].clientX;
    const diff = swipeStartX - swipeEndX;

    // Swipe left to open chat
    if (diff > 50) {
      setChatVisible(true);
      setIsChatExpanded(false);
      setIsClosed(true);
    }

    setSwipeStartX(null);
  };

  const handleOpenChat = () => {
    setChatVisible(true);
    setIsChatExpanded(false);
    setIsClosed(true);
  };

  const handleStartTimer = async () => {
    // Subject is now always required
    if (!selectedSubject) {
      toast({
        title: 'Subject required',
        description: 'Please select a subject before starting the timer.',
        variant: 'destructive',
      });
      return;
    }
    const minutes = Math.max(1, Math.min(999, parseInt(minutesInput) || 25));
    const subjectId = selectedSubject === 'general' ? undefined : selectedSubject;
    
    // Start DB tracking session
    const sessionId = await startSession('general', undefined, subjectId);
    if (sessionId) {
      dbSessionIdRef.current = sessionId;
    }
    
    // Start local timer
    timer.start(minutes, subjectId);
  };

  // Closed state - show only circle button
  if (timerState.isClosed) {
    return (
      <motion.button
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center hover:scale-105 transition-transform"
        onClick={() => setIsClosed(false)}
        title="Show timer"
      >
        <Timer className="w-6 h-6" />
      </motion.button>
    );
  }

  return (
    <motion.div
      ref={timerRef}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="fixed bottom-6 right-6 z-50"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Minimized View - Compact card showing just the timer */}
      {timerState.isMinimized && timer.isRunning && (
        <Card className="w-64 shadow-lg border-primary/20">
          <CardContent className="py-3 px-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Study Timer</p>
                <p className="text-2xl font-mono font-bold text-primary">
                  {timer.formattedTime}
                </p>
              </div>
              <div className="flex flex-col gap-1">
                {timer.isPaused ? (
                  <Button 
                    onClick={timer.resume} 
                    size="sm" 
                    className="h-8 w-8 p-0"
                  >
                    <Play className="w-4 h-4" />
                  </Button>
                ) : (
                  <Button 
                    onClick={timer.pause} 
                    size="sm" 
                    variant="secondary" 
                    className="h-8 w-8 p-0"
                  >
                    <Pause className="w-4 h-4" />
                  </Button>
                )}
                <Button 
                  onClick={timer.stop} 
                  size="sm" 
                  variant="destructive" 
                  className="h-8 w-8 p-0"
                >
                  <Square className="w-4 h-4" />
                </Button>
              </div>
            </div>
            <button
              onClick={() => setIsMinimized(false)}
              className="w-full mt-2 py-1 text-xs text-muted-foreground hover:text-foreground flex items-center justify-center gap-1 transition-colors"
            >
              Expand <ChevronUp className="w-3 h-3" />
            </button>
          </CardContent>
        </Card>
      )}

      {/* Expanded View - Full card */}
      {!timerState.isMinimized && (
        <Card className="w-72 shadow-lg border-primary/20">
          <CardHeader className="py-3 px-4 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Timer className="w-4 h-4" />
              Study Timer
            </CardTitle>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={handleOpenChat}
                title="Open AI Chat (swipe left)"
              >
                <MessageSquare className="w-4 h-4" />
              </Button>
              {timer.isRunning && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => setIsMinimized(true)}
                  title="Minimize"
                >
                  <ChevronUp className="w-4 h-4" />
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => setIsClosed(true)}
                title="Close (timer continues)"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </CardHeader>

          <AnimatePresence>
            {!timer.isRunning ? (
              // Setup View
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
              >
                <CardContent className="py-4 px-4 space-y-4">
                  {/* Timer Duration Input */}
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-muted-foreground">
                      Study Duration
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min="1"
                        max="999"
                        value={minutesInput}
                        onChange={(e) => setMinutesInput(e.target.value)}
                        className="flex-1 h-9 px-3 rounded-lg border border-input bg-background text-foreground text-sm"
                        placeholder="25"
                      />
                      <span className="text-sm text-muted-foreground font-medium">min</span>
                    </div>
                  </div>

                  {/* Subject Selector - Always Required */}
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-muted-foreground">
                      Subject <span className="text-destructive">*</span>
                    </label>
                    <Select value={selectedSubject} onValueChange={setSelectedSubject}>
                      <SelectTrigger className="h-9 text-sm">
                        <SelectValue placeholder="Select subject" />
                      </SelectTrigger>
                      <SelectContent>
                        {subjects.map((subject) => (
                          <SelectItem key={subject.id} value={subject.id}>
                            <div className="flex items-center gap-2">
                              <div
                                className="w-2.5 h-2.5 rounded-full"
                                style={{ backgroundColor: subject.color }}
                              />
                              {subject.name}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {subjects.length === 0 && (
                      <p className="text-xs text-muted-foreground">Loading subjects...</p>
                    )}
                  </div>

                  {/* Start Button */}
                  <Button
                    onClick={handleStartTimer}
                    className="w-full h-10"
                    disabled={!selectedSubject}
                  >
                    <Play className="w-4 h-4 mr-2" />
                    Start Timer
                  </Button>
                </CardContent>
              </motion.div>
            ) : (
              // Active Timer View
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
              >
                <CardContent className="py-4 px-4 space-y-4">
                  {/* Timer Display - NO BOUNCE */}
                  <div className="text-center">
                    <div className="text-5xl font-mono font-bold text-primary">
                      {timer.formattedTime}
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      {timer.isPaused ? 'Paused' : 'Studying...'}
                    </p>
                  </div>

                  {/* Enrolled Subjects Display */}
                  {subjects.length > 0 && (
                    <div className="space-y-2 pt-2 border-t border-border">
                      <p className="text-xs font-medium text-muted-foreground">Your Subjects</p>
                      <div className="flex flex-wrap gap-2">
                        {subjects.map((subject) => (
                          <div
                            key={subject.id}
                            className={`text-xs px-3 py-1.5 rounded-full font-medium transition-all ${
                              selectedSubject === subject.id
                                ? 'ring-2 ring-primary'
                                : 'opacity-70'
                            }`}
                            style={{
                              backgroundColor: `${subject.color}20`,
                              color: subject.color,
                              border: `1px solid ${subject.color}40`,
                            }}
                          >
                            {subject.name}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Controls */}
                  <div className="flex items-center justify-center gap-2">
                    {timer.isPaused ? (
                      <Button onClick={timer.resume} className="flex-1">
                        <Play className="w-4 h-4 mr-2" />
                        Resume
                      </Button>
                    ) : (
                      <Button onClick={timer.pause} variant="secondary" className="flex-1">
                        <Pause className="w-4 h-4 mr-2" />
                        Pause
                      </Button>
                    )}
                    <Button onClick={timer.stop} variant="destructive" size="icon" className="h-10 w-10">
                      <Square className="w-4 h-4" />
                    </Button>
                  </div>
                </CardContent>
              </motion.div>
            )}
          </AnimatePresence>
        </Card>
      )}
    </motion.div>
  );
};

export default StudyTimer;
