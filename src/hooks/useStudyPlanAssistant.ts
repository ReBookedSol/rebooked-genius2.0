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

      if (error) throw error;

      return { success: true };
    } catch (error: any) {
      console.error('Error creating study session:', error);
      toast({
        title: 'Error',
        description: 'Failed to create study session',
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
      const { error } = await supabase.from('reminders').insert({
        user_id: user.id,
        title: reminder.title,
        reminder_type: reminder.type,
        due_date: reminder.dueDate.toISOString(),
        priority: reminder.priority,
        description: reminder.description || null,
        is_completed: false,
      });

      if (error) throw error;

      return { success: true };
    } catch (error: any) {
      console.error('Error creating reminder:', error);
      toast({
        title: 'Error',
        description: 'Failed to create reminder',
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
