import { useState } from 'react';
import { motion } from 'framer-motion';
import { Calendar, Clock, AlertCircle, Loader2, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useStudyPlanAssistant } from '@/hooks/useStudyPlanAssistant';
import { useToast } from '@/hooks/use-toast';

interface StudyPlanSession {
  day: string;
  time: string;
  subject: string;
  duration: number;
  topic?: string;
}

interface AIStudyPlanSuggestionProps {
  plan: StudyPlanSession[];
  title?: string;
  description?: string;
}

export const AIStudyPlanSuggestion = ({
  plan,
  title = 'Weekly Study Plan',
  description = 'Here\'s a personalized study plan based on your goals:'
}: AIStudyPlanSuggestionProps) => {
  const { createWeeklyStudyPlan } = useStudyPlanAssistant();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [isAdded, setIsAdded] = useState(false);

  const handleAddToCalendar = async () => {
    if (isLoading || isAdded) return;

    setIsLoading(true);
    try {
      // Convert plan sessions to calendar events
      const today = new Date();
      const sessions = plan.map(session => {
        // Parse day of week
        const dayMap: { [key: string]: number } = {
          'Monday': 1, 'Tuesday': 2, 'Wednesday': 3, 'Thursday': 4,
          'Friday': 5, 'Saturday': 6, 'Sunday': 0
        };
        
        const dayOfWeek = dayMap[session.day] ?? 1;
        const targetDate = new Date(today);
        const dayDiff = dayOfWeek - targetDate.getDay();
        targetDate.setDate(targetDate.getDate() + (dayDiff < 0 ? dayDiff + 7 : dayDiff));

        // Parse time
        const [hours, minutes] = session.time.split(':').map(Number);
        targetDate.setHours(hours || 9, minutes || 0, 0);

        return {
          title: `${session.subject} - ${session.topic || 'Study Session'}`,
          subject: session.subject,
          date: targetDate,
          duration_minutes: session.duration,
          description: `Scheduled study session for ${session.subject}`,
          type: 'study_session' as const,
        };
      });

      const result = await createWeeklyStudyPlan(sessions);
      
      if (result.success) {
        setIsAdded(true);
        toast({
          title: 'Plan Added!',
          description: `${result.count} study sessions added to your calendar`,
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
      {/* Header */}
      <div className="flex items-start gap-2">
        <Calendar className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-sm text-foreground">{title}</h3>
          <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
        </div>
      </div>

      {/* Study Sessions List */}
      <div className="space-y-2 bg-card/40 rounded-md p-3">
        {plan.map((session, idx) => (
          <motion.div
            key={idx}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: idx * 0.05 }}
            className="flex items-start gap-2 p-2 rounded bg-card/50 border border-border/30"
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1 mb-0.5">
                <span className="font-medium text-sm text-foreground">{session.day}</span>
                <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">{session.time}</span>
              </div>
              <p className="text-sm font-semibold text-primary">{session.subject}</p>
              {session.topic && (
                <p className="text-xs text-muted-foreground">{session.topic}</p>
              )}
              <p className="text-xs text-muted-foreground mt-0.5">
                {session.duration} minutes
              </p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Action Buttons */}
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
              Added to Calendar
            </>
          ) : isLoading ? (
            <>
              <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
              Adding...
            </>
          ) : (
            <>
              <Calendar className="w-3.5 h-3.5 mr-1.5" />
              Add to Calendar
            </>
          )}
        </Button>
        <p className="text-xs text-muted-foreground flex items-center gap-1">
          <AlertCircle className="w-3 h-3" />
          Starts from next occurrence
        </p>
      </div>
    </motion.div>
  );
};

export default AIStudyPlanSuggestion;
