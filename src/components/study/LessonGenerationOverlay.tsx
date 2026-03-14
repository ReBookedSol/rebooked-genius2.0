import React, { useState, useEffect } from 'react';
import { Loader2, Sparkles, BookOpen, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useLessonGeneration } from '@/contexts/LessonGenerationContext';
import { AFFIRMATIONS } from '@/lib/affirmations';

export const LessonGenerationOverlay: React.FC = () => {
  const { isGenerating, progress } = useLessonGeneration();
  const [currentAffirmation, setCurrentAffirmation] = useState(AFFIRMATIONS[0]);

  useEffect(() => {
    if (!isGenerating) return;

    const interval = setInterval(() => {
      const randomIndex = Math.floor(Math.random() * AFFIRMATIONS.length);
      setCurrentAffirmation(AFFIRMATIONS[randomIndex]);
    }, 5000);

    return () => clearInterval(interval);
  }, [isGenerating]);

  if (!isGenerating) return null;

  const progressPercent = Math.round(progress.visualProgress || 0);

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-6 overflow-hidden">
      {/* Blurred Backdrop */}
      <div className="absolute inset-0 bg-background/60 backdrop-blur-md animate-in fade-in duration-300" />

      {/* Modal Card - Styled as a clean Popup */}
      <div className="relative w-full max-w-lg bg-card border border-border rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.15)] overflow-hidden animate-in slide-in-from-bottom-8 zoom-in-95 duration-500">
        <div className="p-8 sm:p-10 space-y-8">
          {/* Header */}
          <div className="text-center space-y-4">
            <div className="mx-auto w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center animate-pulse">
              <Sparkles className="w-7 h-7 text-primary" />
            </div>
            <div className="space-y-1">
              <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
                Crafting Your Personalized Lesson
              </h2>
              <p className="text-sm text-muted-foreground">This will only take a moment...</p>
            </div>
          </div>

          {/* Affirmation Card */}
          <div className="p-5 bg-secondary/50 border border-border/50 rounded-2xl relative overflow-hidden">
            <p className="text-md italic font-medium leading-relaxed text-foreground text-center relative z-10 px-4">
              "{currentAffirmation}"
            </p>
          </div>

          {/* Progress Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <Loader2 className="h-3 w-3 animate-spin text-primary" />
                <span className="font-bold uppercase tracking-wider text-muted-foreground opacity-70">
                  Processing...
                </span>
              </div>
              <span className="font-bold text-primary tabular-nums">{progressPercent}%</span>
            </div>

            <div className="space-y-2">
              <Progress value={progressPercent} className="h-2.5 rounded-full bg-secondary" />
              <div className="flex justify-between items-center text-[11px] text-muted-foreground font-medium">
                <span>Segment {progress.completedChunks + 1} of {progress.totalChunks}</span>
                {progress.totalPages && (
                  <span>{progress.totalPages} pages total</span>
                )}
              </div>
            </div>
          </div>

          {/* Warning Banner - Subtle */}
          <div className="flex items-center justify-center gap-2 text-amber-600 dark:text-amber-500 bg-amber-50 dark:bg-amber-900/10 px-3 py-1.5 rounded-lg border border-amber-200/50 dark:border-amber-800/20">
            <AlertTriangle className="w-3.5 h-3.5" />
            <span className="text-[11px] font-semibold">Stay on this page while we process</span>
          </div>

          {/* Footer Actions */}
          <div className="flex flex-col gap-3 pt-2">
            <p className="text-[10px] text-center text-muted-foreground uppercase tracking-widest opacity-50 font-bold">
              Finalizing Your Content
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
