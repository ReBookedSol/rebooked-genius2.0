import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle2, Circle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BatchProgressTimelineProps {
  currentBatch: number;
  totalBatches: number;
  pagesPerBatch: number;
  totalPages: number;
}

export function BatchProgressTimeline({
  currentBatch,
  totalBatches,
  pagesPerBatch,
  totalPages,
}: BatchProgressTimelineProps) {
  const batches = Array.from({ length: totalBatches }, (_, i) => {
    const batchNum = i + 1;
    const startPage = i * pagesPerBatch + 1;
    const endPage = Math.min((i + 1) * pagesPerBatch, totalPages);
    const status =
      batchNum < currentBatch
        ? 'completed'
        : batchNum === currentBatch
        ? 'processing'
        : 'pending';

    return { num: batchNum, status, startPage, endPage };
  });

  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="text-lg">Processing Batches</CardTitle>
        <p className="text-sm text-muted-foreground mt-1">
          Large PDFs are processed in {pagesPerBatch}-page batches
        </p>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {batches.map((batch, idx) => (
            <div key={batch.num}>
              <div className="flex items-center gap-3">
                <div className="relative flex-shrink-0">
                  {batch.status === 'completed' ? (
                    <CheckCircle2 className="h-6 w-6 text-success" />
                  ) : batch.status === 'processing' ? (
                    <div className="relative h-6 w-6">
                      <Loader2 className="h-6 w-6 text-primary animate-spin" />
                    </div>
                  ) : (
                    <Circle className="h-6 w-6 text-muted-foreground" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">
                    Batch {batch.num} of {totalBatches}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Pages {batch.startPage}–{batch.endPage}
                  </p>
                </div>

                <div className="flex-shrink-0">
                  <span
                    className={cn(
                      'text-xs font-medium px-2 py-1 rounded-full',
                      batch.status === 'completed'
                        ? 'bg-success/10 text-success'
                        : batch.status === 'processing'
                        ? 'bg-primary/10 text-primary'
                        : 'bg-muted text-muted-foreground'
                    )}
                  >
                    {batch.status === 'completed'
                      ? 'Done'
                      : batch.status === 'processing'
                      ? 'Processing'
                      : 'Pending'}
                  </span>
                </div>
              </div>

              {idx < batches.length - 1 && (
                <div className="h-3 w-0.5 bg-border ml-3 mt-2" />
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
