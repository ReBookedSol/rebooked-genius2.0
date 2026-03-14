import { GeneratedLesson, GenerationProgress } from '@/contexts/LessonGenerationContext';
import { CheckCircle2, Loader2, AlertCircle, FileText } from 'lucide-react';
import { Progress } from '@/components/ui/progress';

interface ProgressIndicatorProps {
  progress: GenerationProgress;
  lessons: GeneratedLesson[];
}

export function ProgressIndicator({ progress, lessons }: ProgressIndicatorProps) {
  const completedCount = lessons.filter((l) => l.status === 'completed').length;
  const errorCount = lessons.filter((l) => l.status === 'error').length;
  const processingCount = lessons.filter((l) => l.status === 'processing').length;

  const progressPercent = Math.round(progress.visualProgress || 0);

  // Calculate correct batch count for display
  const PAGES_PER_BATCH = 50;
  const totalPages = progress.totalPages || 0;
  const calculatedTotalBatches = totalPages > 0 ? Math.ceil(totalPages / PAGES_PER_BATCH) : (progress.totalBatches || 0);
  const currentBatch = progress.currentBatch || 0;

  return (
    <div className="space-y-4 p-4 bg-gradient-to-br from-primary/5 to-transparent border border-primary/10 rounded-lg">
      {/* Batch Progress (if processing multi-batch PDF) */}
      {calculatedTotalBatches > 0 && totalPages > 0 && (
        <div className="space-y-2 pb-3 border-b border-border">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium text-foreground">
                Processing {totalPages} pages in {calculatedTotalBatches} batch{calculatedTotalBatches !== 1 ? 'es' : ''}
              </span>
            </div>
            {currentBatch > 0 && (
              <span className="text-xs text-muted-foreground">
                Batch {currentBatch} of {calculatedTotalBatches}
              </span>
            )}
          </div>
          <Progress 
            value={calculatedTotalBatches > 0 ? (currentBatch / calculatedTotalBatches) * 100 : 0} 
            className="h-1" 
          />
        </div>
      )}

      {/* Main Progress Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
            <span className="text-sm font-medium text-foreground">Generating lessons</span>
          </div>
          <span className="text-lg font-semibold text-primary">{progressPercent}%</span>
        </div>
        <Progress value={progressPercent} className="h-1.5" />
        
        {/* Lesson Count */}
        <div className="text-sm text-muted-foreground">
          {completedCount} of {progress.totalChunks} lesson{progress.totalChunks !== 1 ? 's' : ''} generated
        </div>
      </div>

      {/* Status Indicators */}
      <div className="flex items-center gap-4 pt-2">
        {/* Completed */}
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          <span className="text-sm font-medium">{completedCount}</span>
        </div>

        {/* Processing */}
        {processingCount > 0 && (
          <div className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />
            <span className="text-sm font-medium">{processingCount}</span>
          </div>
        )}

        {/* Error */}
        {errorCount > 0 && (
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-destructive" />
            <span className="text-sm font-medium text-destructive">{errorCount}</span>
          </div>
        )}
      </div>

      {/* Error Message */}
      {errorCount > 0 && (
        <div className="pt-2 px-3 py-2 bg-destructive/10 border border-destructive/20 rounded text-sm text-destructive/90">
          {errorCount} chunk{errorCount > 1 ? 's' : ''} failed to generate
        </div>
      )}
    </div>
  );
}
