import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface StudySession {
  title: string;
  subject?: string;
  date: Date;
  duration_minutes: number;
  description?: string;
  type: 'study_session' | 'exam' | 'revision' | 'lesson';
}

interface ReminderItem {
  title: string;
  dueDate: Date;
  type: 'study' | 'assignment' | 'exam' | 'revision' | 'other';
  priority: 'low' | 'medium' | 'high';
  description?: string;
}

export const useStudyPlanAssistant = () => {
  const { user } = useAuth();
  const { toast } = useToast();

  const createStudySession = async (session: StudySession) => {
    if (!user) {
      toast({
        title: 'Error',
        description: 'You must be logged in to create study sessions.',
        variant: 'destructive',
      });
      return null;
    }

    try {
      console.log('[useStudyPlanAssistant] Creating study session:', session);

      const { error } = await supabase.from('upcoming_events').insert({
        user_id: user.id,
        title: session.title,
        event_type: session.type,
        scheduled_date: session.date.toISOString(),
        duration_minutes: session.duration_minutes,
        description: session.description || null,
        location: null,
        status: 'upcoming',
      });

      if (error) {
        console.error('[useStudyPlanAssistant] Study session creation error:', error);
        throw error;
      }

      console.log('[useStudyPlanAssistant] Study session created successfully');
      toast({
        title: 'Event Added!',
        description: `"${session.title}" added to your calendar`,
      });
      return { success: true };
    } catch (error: any) {
      console.error('Error creating study session:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to create study session',
        variant: 'destructive',
      });
      return null;
    }
  };

  const createReminder = async (reminder: ReminderItem) => {
    if (!user) {
      toast({
        title: 'Error',
        description: 'You must be logged in to create reminders.',
        variant: 'destructive',
      });
      return null;
    }

    try {
      console.log('[useStudyPlanAssistant] Creating reminder:', reminder);

      const { error } = await supabase.from('reminders').insert({
        user_id: user.id,
        title: reminder.title,
        reminder_type: reminder.type,
        due_date: reminder.dueDate.toISOString(),
        priority: reminder.priority,
        description: reminder.description || null,
        is_completed: false,
      });

      if (error) {
        console.error('[useStudyPlanAssistant] Reminder creation error:', error);
        throw error;
      }

      console.log('[useStudyPlanAssistant] Reminder created successfully');
      toast({
        title: 'Reminder Created!',
        description: `"${reminder.title}" added to your reminders`,
      });
      return { success: true };
    } catch (error: any) {
      console.error('Error creating reminder:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to create reminder. Make sure you\'re logged in.',
        variant: 'destructive',
      });
      return null;
    }
  };

  const createWeeklyStudyPlan = async (sessions: StudySession[]) => {
    if (!user) {
      toast({
        title: 'Error',
        description: 'You must be logged in to create a study plan.',
        variant: 'destructive',
      });
      return { success: false };
    }

    try {
      const events = sessions.map(session => ({
        user_id: user.id,
        title: session.title,
        event_type: session.type,
        scheduled_date: session.date.toISOString(),
        duration_minutes: session.duration_minutes,
        description: session.description || null,
        location: null,
        status: 'upcoming',
      }));

      const { error } = await supabase.from('upcoming_events').insert(events);

      if (error) throw error;

      toast({
        title: 'Success!',
        description: `Added ${sessions.length} study sessions to your calendar`,
      });

      return { success: true, count: sessions.length };
    } catch (error: any) {
      console.error('Error creating study plan:', error);
      toast({
        title: 'Error',
        description: 'Failed to create study plan',
        variant: 'destructive',
      });
      return { success: false };
    }
  };

  return {
    createStudySession,
    createReminder,
    createWeeklyStudyPlan,
  };
};
