import { useState } from 'react';
import { motion } from 'framer-motion';
import { Bell, Loader2, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useStudyPlanAssistant } from '@/hooks/useStudyPlanAssistant';

interface AIChatReminderProps {
  suggestion: {
    title: string;
    dueDate?: Date;
    type?: 'study' | 'assignment' | 'exam' | 'revision' | 'other';
    description?: string;
  };
  onReminderCreated?: () => void;
}

export const AIChatReminder = ({
  suggestion,
  onReminderCreated,
}: AIChatReminderProps) => {
  const { createReminder } = useStudyPlanAssistant();
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isCreated, setIsCreated] = useState(false);
  const [formData, setFormData] = useState({
    title: suggestion.title,
    dueDate: suggestion.dueDate?.toISOString().split('T')[0] || '',
    dueTime: suggestion.dueDate ? 
      `${suggestion.dueDate.getHours().toString().padStart(2, '0')}:${suggestion.dueDate.getMinutes().toString().padStart(2, '0')}` 
      : '09:00',
    type: suggestion.type || 'study' as const,
    priority: 'medium' as const,
    description: suggestion.description || '',
  });

  const handleCreate = async () => {
    if (!formData.title || !formData.dueDate) return;

    setIsLoading(true);
    try {
      const dueDateTime = new Date(`${formData.dueDate}T${formData.dueTime}`);
      
      await createReminder({
        title: formData.title,
        dueDate: dueDateTime,
        type: formData.type,
        priority: formData.priority,
        description: formData.description,
      });

      setIsCreated(true);
      onReminderCreated?.();
      
      setTimeout(() => {
        setOpen(false);
        setIsCreated(false);
      }, 2000);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-primary/10 text-primary border border-primary/20 rounded-md hover:bg-primary/20 transition-colors"
      >
        <Bell className="w-3.5 h-3.5" />
        Set Reminder
      </motion.button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="w-[95vw] max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-primary" />
              Create Reminder
            </DialogTitle>
          </DialogHeader>

          {isCreated ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              className="py-6 flex flex-col items-center justify-center gap-3"
            >
              <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-950 flex items-center justify-center">
                <Check className="w-6 h-6 text-green-600 dark:text-green-400" />
              </div>
              <p className="text-sm font-medium text-center">Reminder created successfully!</p>
            </motion.div>
          ) : (
            <div className="space-y-4 py-4">
              <div>
                <Label className="text-sm">Title</Label>
                <Input
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="e.g., Study for Math Exam"
                  className="mt-1.5 h-9 text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-sm">Date</Label>
                  <Input
                    type="date"
                    value={formData.dueDate}
                    onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                    className="mt-1.5 h-9 text-sm"
                  />
                </div>
                <div>
                  <Label className="text-sm">Time</Label>
                  <Input
                    type="time"
                    value={formData.dueTime}
                    onChange={(e) => setFormData({ ...formData, dueTime: e.target.value })}
                    className="mt-1.5 h-9 text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-sm">Type</Label>
                  <Select value={formData.type} onValueChange={(value: any) => setFormData({ ...formData, type: value })}>
                    <SelectTrigger className="mt-1.5 h-9 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="study">Study</SelectItem>
                      <SelectItem value="assignment">Assignment</SelectItem>
                      <SelectItem value="exam">Exam</SelectItem>
                      <SelectItem value="revision">Revision</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-sm">Priority</Label>
                  <Select value={formData.priority} onValueChange={(value: any) => setFormData({ ...formData, priority: value })}>
                    <SelectTrigger className="mt-1.5 h-9 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {formData.description && (
                <div>
                  <Label className="text-sm">Notes</Label>
                  <p className="text-xs text-muted-foreground mt-1.5">{formData.description}</p>
                </div>
              )}
            </div>
          )}

          {!isCreated && (
            <DialogFooter className="gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setOpen(false)}
                disabled={isLoading}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleCreate}
                disabled={!formData.title || !formData.dueDate || isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                    Creating...
                  </>
                ) : (
                  'Create Reminder'
                )}
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default AIChatReminder;
