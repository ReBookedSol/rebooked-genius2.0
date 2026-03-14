import { useState } from 'react';
import { Bell, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface AddReminderDialogProps {
  onReminderAdded?: () => void;
  trigger?: React.ReactNode;
}

const REMINDER_TYPES = [
  { value: 'study', label: 'Study' },
  { value: 'assignment', label: 'Assignment' },
  { value: 'exam', label: 'Exam Prep' },
  { value: 'revision', label: 'Revision' },
  { value: 'other', label: 'Other' },
];

const PRIORITIES = [
  { value: 'low', label: 'Low', color: 'text-muted-foreground' },
  { value: 'medium', label: 'Medium', color: 'text-amber-500' },
  { value: 'high', label: 'High', color: 'text-destructive' },
];

export const AddReminderDialog = ({ onReminderAdded, trigger }: AddReminderDialogProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    reminder_type: 'study',
    due_date: '',
    due_time: '09:00',
    priority: 'medium',
    description: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !formData.title || !formData.due_date) {
      if (!user) {
        toast({ title: 'Error', description: 'You must be logged in to create reminders.', variant: 'destructive' });
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

      const dueDateTime = new Date(`${formData.due_date}T${formData.due_time}`);
      
      const insertData = {
        user_id: session.user.id,
        title: formData.title,
        reminder_type: formData.reminder_type,
        due_date: dueDateTime.toISOString(),
        priority: formData.priority,
        description: formData.description || null,
        is_completed: false,
      };

      const { error } = await supabase.from('reminders').insert(insertData);

      if (error) {
        console.error('Supabase insert error:', error);
        throw error;
      }

      toast({
        title: 'Reminder created!',
        description: 'You will be reminded on the due date.',
      });

      setFormData({
        title: '',
        reminder_type: 'study',
        due_date: '',
        due_time: '09:00',
        priority: 'medium',
        description: '',
      });
      setOpen(false);
      onReminderAdded?.();
    } catch (error: any) {
      console.error('Error creating reminder:', error);
      toast({
        title: 'Error',
        description: error?.message || 'Failed to create reminder. Please try again.',
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
          <Button variant="ghost" size="icon">
            <Plus className="w-4 h-4" />
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="w-[95vw] max-w-[95vw] sm:max-w-[400px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg sm:text-xl">
            <Bell className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
            Add Reminder
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-4 pt-4">
          <div className="space-y-1 sm:space-y-2">
            <Label htmlFor="title" className="text-sm">Reminder Title *</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="e.g., Submit Math Assignment"
              required
              className="h-9 sm:h-10 text-sm"
            />
          </div>

          <div className="grid grid-cols-2 gap-2 sm:gap-4">
            <div className="space-y-1 sm:space-y-2">
              <Label htmlFor="reminder_type" className="text-sm">Type</Label>
              <Select
                value={formData.reminder_type}
                onValueChange={(value) => setFormData({ ...formData, reminder_type: value })}
              >
                <SelectTrigger className="h-9 sm:h-10 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {REMINDER_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value} className="text-sm">
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1 sm:space-y-2">
              <Label htmlFor="priority" className="text-sm">Priority</Label>
              <Select
                value={formData.priority}
                onValueChange={(value) => setFormData({ ...formData, priority: value })}
              >
                <SelectTrigger className="h-9 sm:h-10 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITIES.map((p) => (
                    <SelectItem key={p.value} value={p.value} className="text-sm">
                      <span className={p.color}>{p.label}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:gap-4">
            <div className="space-y-1 sm:space-y-2">
              <Label htmlFor="due_date" className="text-sm">Due Date *</Label>
              <Input
                id="due_date"
                type="date"
                value={formData.due_date}
                onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                required
                className="h-9 sm:h-10 text-sm"
              />
            </div>

            <div className="space-y-1 sm:space-y-2">
              <Label htmlFor="due_time" className="text-sm">Time</Label>
              <Input
                id="due_time"
                type="time"
                value={formData.due_time}
                onChange={(e) => setFormData({ ...formData, due_time: e.target.value })}
                className="h-9 sm:h-10 text-sm"
              />
            </div>
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
            {loading ? 'Creating...' : 'Create Reminder'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default AddReminderDialog;
