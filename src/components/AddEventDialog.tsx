import { useState } from 'react';
import { Calendar, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface AddEventDialogProps {
  onEventAdded?: () => void;
  trigger?: React.ReactNode;
}

const EVENT_TYPES = [
  { value: 'lesson', label: 'Lesson' },
  { value: 'exam', label: 'Exam' },
  { value: 'assignment', label: 'Assignment' },
  { value: 'study_session', label: 'Study Session' },
  { value: 'meeting', label: 'Meeting' },
  { value: 'other', label: 'Other' },
];

export const AddEventDialog = ({ onEventAdded, trigger }: AddEventDialogProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    event_type: 'study_session',
    scheduled_date: '',
    scheduled_time: '09:00',
    duration_minutes: 60,
    description: '',
    location: '',
    is_online: true,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !formData.title || !formData.scheduled_date) {
      if (!user) {
        toast({ title: 'Error', description: 'You must be logged in to create events.', variant: 'destructive' });
      }
      return;
    }

    setLoading(true);
    try {
      // Refresh session to ensure valid auth token
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session) {
        toast({ title: 'Authentication Error', description: 'Please log in again.', variant: 'destructive' });
        setLoading(false);
        return;
      }

      const scheduledDateTime = new Date(`${formData.scheduled_date}T${formData.scheduled_time}`);
      
      const insertData = {
        user_id: session.user.id,
        title: formData.title,
        event_type: formData.event_type,
        scheduled_date: scheduledDateTime.toISOString(),
        duration_minutes: formData.duration_minutes,
        description: formData.description || null,
        location: formData.location || null,
        is_online: formData.is_online,
        status: 'upcoming',
      };

      const { error } = await supabase.from('upcoming_events').insert(insertData);

      if (error) {
        console.error('Supabase insert error:', error);
        throw error;
      }

      toast({
        title: 'Event created!',
        description: 'Your event has been scheduled.',
      });

      setFormData({
        title: '',
        event_type: 'study_session',
        scheduled_date: '',
        scheduled_time: '09:00',
        duration_minutes: 60,
        description: '',
        location: '',
        is_online: true,
      });
      setOpen(false);
      onEventAdded?.();
    } catch (error: any) {
      console.error('Error creating event:', error);
      toast({
        title: 'Error',
        description: error?.message || 'Failed to create event. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm">
            <Plus className="w-4 h-4 mr-2" />
            Add Event
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="w-[95vw] max-w-[95vw] sm:max-w-[425px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg sm:text-xl">
            <Calendar className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
            Schedule Event
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-4 pt-4">
          <div className="space-y-1 sm:space-y-2">
            <Label htmlFor="title" className="text-sm">Event Title *</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="e.g., Math Study Session"
              required
              className="h-9 sm:h-10 text-sm"
            />
          </div>

          <div className="grid grid-cols-2 gap-2 sm:gap-4">
            <div className="space-y-1 sm:space-y-2">
              <Label htmlFor="event_type" className="text-sm">Type</Label>
              <Select
                value={formData.event_type}
                onValueChange={(value) => setFormData({ ...formData, event_type: value })}
              >
                <SelectTrigger className="h-9 sm:h-10 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EVENT_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value} className="text-sm">
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1 sm:space-y-2">
              <Label htmlFor="duration" className="text-sm">Duration</Label>
              <Input
                id="duration"
                type="number"
                min={15}
                max={480}
                value={formData.duration_minutes}
                onChange={(e) => setFormData({ ...formData, duration_minutes: Number(e.target.value) })}
                className="h-9 sm:h-10 text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:gap-4">
            <div className="space-y-1 sm:space-y-2">
              <Label htmlFor="date" className="text-sm">Date *</Label>
              <Input
                id="date"
                type="date"
                value={formData.scheduled_date}
                onChange={(e) => setFormData({ ...formData, scheduled_date: e.target.value })}
                required
                className="h-9 sm:h-10 text-sm"
              />
            </div>

            <div className="space-y-1 sm:space-y-2">
              <Label htmlFor="time" className="text-sm">Time</Label>
              <Input
                id="time"
                type="time"
                value={formData.scheduled_time}
                onChange={(e) => setFormData({ ...formData, scheduled_time: e.target.value })}
                className="h-9 sm:h-10 text-sm"
              />
            </div>
          </div>

          <div className="space-y-1 sm:space-y-2">
            <Label htmlFor="location" className="text-sm">Location</Label>
            <Input
              id="location"
              value={formData.location}
              onChange={(e) => setFormData({ ...formData, location: e.target.value })}
              placeholder="e.g., Room 101 or Online"
              className="h-9 sm:h-10 text-sm"
            />
          </div>

          <div className="space-y-1 sm:space-y-2">
            <Label htmlFor="description" className="text-sm">Notes</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Any additional details..."
              rows={2}
              className="text-sm"
            />
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Creating...' : 'Create Event'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default AddEventDialog;
