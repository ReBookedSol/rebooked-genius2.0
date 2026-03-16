import { useState } from 'react';
import { motion } from 'framer-motion';
import { Calendar, Clock, AlertCircle, Loader2, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useStudyPlanAssistant } from '@/hooks/useStudyPlanAssistant';
import { useToast } from '@/hooks/use-toast';
import { CalendarEventBlock } from '@/lib/aiStudyPlanParser';

interface AICalendarEventProps {
  event: CalendarEventBlock;
}

export const AICalendarEvent = ({ event }: AICalendarEventProps) => {
  const { createWeeklyStudyPlan } = useStudyPlanAssistant();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [isAdded, setIsAdded] = useState(false);

  const handleAddToCalendar = async () => {
    if (isLoading || isAdded) return;

    setIsLoading(true);
    try {
      // Create date object from YYYY-MM-DD
      const targetDate = new Date(event.date);
      
      // Parse time if provided
      if (event.time) {
        const [hours, minutes] = event.time.split(':').map(Number);
        targetDate.setHours(hours || 9, minutes || 0, 0);
      } else {
        targetDate.setHours(9, 0, 0);
      }

      // Convert to a single session array for the existing assistant hook
      const sessions = [{
        title: event.title,
        subject: event.title, // Can map title to subject if needed
        date: targetDate,
        duration_minutes: event.duration || 60,
        description: event.description || `Event added from AI Chat: ${event.title}`,
        type: 'study_session' as const,
      }];

      const result = await createWeeklyStudyPlan(sessions);
      
      if (result.success) {
        setIsAdded(true);
        toast({
          title: 'Event Added!',
          description: `"${event.title}" has been added to your calendar.`,
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-gradient-to-br from-primary/5 to-primary/10 border border-primary/20 rounded-lg p-4 my-3 space-y-3"
    >
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-primary/10 flex flex-col items-center justify-center border border-primary/20">
          <span className="text-[10px] font-bold text-primary uppercase leading-none">
            {new Date(event.date).toLocaleDateString('en-US', { month: 'short' })}
          </span>
          <span className="text-sm font-bold text-primary leading-none mt-1">
            {new Date(event.date).getDate()}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-sm text-foreground truncate">{event.title}</h3>
          {event.description && (
            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{event.description}</p>
          )}
          
          <div className="flex flex-wrap items-center gap-3 mt-2">
            {event.time && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="w-3.5 h-3.5" />
                <span>{event.time}</span>
              </div>
            )}
            {event.duration && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <span className="w-1 h-1 rounded-full bg-border" />
                <span>{event.duration} min</span>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex gap-2 pt-2 border-t border-border/30">
        <Button
          size="sm"
          variant="default"
          onClick={handleAddToCalendar}
          disabled={isLoading || isAdded}
          className="flex-1"
        >
          {isAdded ? (
            <>
              <Check className="w-3.5 h-3.5 mr-1.5" />
              Added
            </>
          ) : isLoading ? (
            <>
              <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
              Adding...
            </>
          ) : (
            <>
              <Calendar className="w-3.5 h-3.5 mr-1.5" />
              Add Event
            </>
          )}
        </Button>
      </div>
    </motion.div>
  );
};

export default AICalendarEvent;
