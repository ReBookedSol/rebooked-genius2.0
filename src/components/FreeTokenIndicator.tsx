import { useSubscription } from '@/hooks/useSubscription';
import { Progress } from '@/components/ui/progress';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Zap } from 'lucide-react';

/**
 * Compact token usage indicator for free-tier users.
 * Shows used / limit tokens with a progress bar.
 */
export function FreeTokenIndicator() {
  const { tier, usage, limits } = useSubscription();

  if (tier !== 'free') return null;

  const used = usage.aiTokensToday;
  const limit = limits.aiTokensPerDay;
  if (!isFinite(limit)) return null;

  const percentage = Math.min(100, Math.round((used / limit) * 100));
  const remaining = Math.max(0, limit - used);

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-muted/60 cursor-default">
            <Zap className="w-3 h-3 text-primary flex-shrink-0" />
            <div className="w-16">
              <Progress value={percentage} className="h-1.5" />
            </div>
            <span className="text-[10px] font-medium text-muted-foreground whitespace-nowrap">
              {remaining.toLocaleString()}
            </span>
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs">
          <p className="font-medium">{used.toLocaleString()} / {limit.toLocaleString()} tokens used today</p>
          <p className="text-muted-foreground">{remaining.toLocaleString()} tokens remaining</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
