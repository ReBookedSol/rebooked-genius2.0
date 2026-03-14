import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, addMonths, subMonths, isToday, isBefore, startOfToday } from 'date-fns';
import { ChevronLeft, ChevronRight, Plus, Calendar as CalendarIcon, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface CalendarEvent {
  id: string;
  title: string;
  event_type: string;
  scheduled_date: string;
  duration_minutes: number;
  description: string | null;
  location: string | null;
  status: string;
}

interface EventCalendarProps {
  onEventClick?: (_event: CalendarEvent) => void;
}

const EVENT_TYPES = [
  { value: 'lesson', label: 'Lesson', color: 'bg-accent-mint text-accent-mint-foreground' },
  { value: 'exam', label: 'Exam/Test', color: 'bg-accent-pink text-accent-pink-foreground' },
  { value: 'assignment', label: 'Assignment', color: 'bg-accent-lavender text-accent-lavender-foreground' },
  { value: 'study_session', label: 'Study Session', color: 'bg-accent-peach text-accent-peach-foreground' },
  { value: 'meeting', label: 'Meeting', color: 'bg-primary/20 text-primary' },
  { value: 'other', label: 'Other', color: 'bg-secondary text-secondary-foreground' },
];

const getEventTypeColor = (type: string) => {
  return EVENT_TYPES.find(t => t.value === type)?.color || 'bg-secondary text-secondary-foreground';
};

const EventCalendar: React.FC<EventCalendarProps> = ({ onEventClick }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [_loading, setLoading] = useState(true);
  
  // Dialog states
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    event_type: 'study_session',
    scheduled_date: '',
    scheduled_time: '09:00',
    duration_minutes: 60,
    description: '',
    location: '',
  });

  const fetchEvents = useCallback(async () => {
    if (!user) return;

    try {
      const monthStart = startOfMonth(currentMonth);
      const monthEnd = endOfMonth(currentMonth);

      const { data, error } = await supabase
        .from('upcoming_events')
        .select('*')
        .eq('user_id', user.id)
        .gte('scheduled_date', monthStart.toISOString())
        .lte('scheduled_date', monthEnd.toISOString())
        .order('scheduled_date', { ascending: true });

      if (error) throw error;
      setEvents(data || []);
    } catch (error) {
      console.error('Error fetching events:', error);
    } finally {
      setLoading(false);
    }
  }, [user, currentMonth]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  // Check for upcoming events and create notifications
  const checkUpcomingEvents = useCallback(async () => {
    if (events.length === 0 || !user) return;

    const now = new Date();

    for (const event of events) {
      const eventDate = new Date(event.scheduled_date);
      const hoursUntil = (eventDate.getTime() - now.getTime()) / (1000 * 60 * 60);
      const daysUntil = Math.ceil(hoursUntil / 24);

      // Notification triggers: 2 days, 1 hour, and at event time
      let notifType: string | null = null;
      let notifMessage = '';

      if (daysUntil === 2 && daysUntil > 1) {
        notifType = `2days_${event.id}`;
        notifMessage = `${event.title} is in 2 days. Time to prepare!`;
      } else if (hoursUntil > 0 && hoursUntil <= 1) {
        notifType = `1hour_${event.id}`;
        notifMessage = `${event.title} starts in less than an hour!`;
      } else if (hoursUntil <= 0 && hoursUntil > -1) {
        notifType = `now_${event.id}`;
        notifMessage = `${event.title} is happening now!`;
      }

      if (notifType) {
        const sessionKey = `event_notif_${notifType}`;
        if (!sessionStorage.getItem(sessionKey)) {
          sessionStorage.setItem(sessionKey, 'true');

          // Show toast
          toast({
            title: `📅 ${event.title}`,
            description: notifMessage,
          });

          // Save to notifications table
          try {
            await supabase.from('notifications').insert({
              user_id: user.id,
              title: `📅 ${event.title}`,
              message: notifMessage,
              type: 'event_reminder',
              link: '/',
            });
          } catch (err) {
            console.error('Error creating notification:', err);
          }
        }
      }
    }
  }, [events, user, toast]);

  useEffect(() => {
    checkUpcomingEvents();
    const interval = setInterval(checkUpcomingEvents, 60000); // Check every minute
    return () => clearInterval(interval);
  }, [checkUpcomingEvents]);

  const days = eachDayOfInterval({
    start: startOfMonth(currentMonth),
    end: endOfMonth(currentMonth),
  });

  const getEventsForDay = (date: Date) => {
    return events.filter(event => isSameDay(new Date(event.scheduled_date), date));
  };

  const handlePrevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));
  const handleNextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));

  const handleDayClick = (date: Date) => {
    setSelectedDate(date);
    setFormData(prev => ({
      ...prev,
      scheduled_date: format(date, 'yyyy-MM-dd'),
    }));
  };

  const handleAddEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !formData.title || !formData.scheduled_date) return;

    try {
      const scheduledDateTime = new Date(`${formData.scheduled_date}T${formData.scheduled_time}`);
      
      const { error } = await supabase.from('upcoming_events').insert({
        user_id: user.id,
        title: formData.title,
        event_type: formData.event_type,
        scheduled_date: scheduledDateTime.toISOString(),
        duration_minutes: formData.duration_minutes,
        description: formData.description || null,
        location: formData.location || null,
        status: 'upcoming',
      });

      if (error) throw error;

      toast({ title: 'Event created!', description: 'Your event has been scheduled.' });
      resetForm();
      setIsAddDialogOpen(false);
      fetchEvents();
    } catch (error) {
      console.error('Error creating event:', error);
      toast({ title: 'Error', description: 'Failed to create event', variant: 'destructive' });
    }
  };

  const handleUpdateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEvent || !formData.title) return;

    try {
      const scheduledDateTime = new Date(`${formData.scheduled_date}T${formData.scheduled_time}`);
      
      const { error } = await supabase
        .from('upcoming_events')
        .update({
          title: formData.title,
          event_type: formData.event_type,
          scheduled_date: scheduledDateTime.toISOString(),
          duration_minutes: formData.duration_minutes,
          description: formData.description || null,
          location: formData.location || null,
        })
        .eq('id', selectedEvent.id);

      if (error) throw error;

      toast({ title: 'Event updated!' });
      resetForm();
      setIsEditDialogOpen(false);
      setSelectedEvent(null);
      fetchEvents();
    } catch (error) {
      console.error('Error updating event:', error);
      toast({ title: 'Error', description: 'Failed to update event', variant: 'destructive' });
    }
  };

  const handleDeleteEvent = async (eventId: string) => {
    try {
      const { error } = await supabase.from('upcoming_events').delete().eq('id', eventId);
      if (error) throw error;

      toast({ title: 'Event deleted' });
      setIsEditDialogOpen(false);
      setSelectedEvent(null);
      fetchEvents();
    } catch (error) {
      console.error('Error deleting event:', error);
      toast({ title: 'Error', description: 'Failed to delete event', variant: 'destructive' });
    }
  };

  const resetForm = () => {
    setFormData({
      title: '',
      event_type: 'study_session',
      scheduled_date: selectedDate ? format(selectedDate, 'yyyy-MM-dd') : '',
      scheduled_time: '09:00',
      duration_minutes: 60,
      description: '',
      location: '',
    });
  };

  const openEditDialog = (event: CalendarEvent) => {
    const eventDate = new Date(event.scheduled_date);
    setSelectedEvent(event);
    setFormData({
      title: event.title,
      event_type: event.event_type,
      scheduled_date: format(eventDate, 'yyyy-MM-dd'),
      scheduled_time: format(eventDate, 'HH:mm'),
      duration_minutes: event.duration_minutes,
      description: event.description || '',
      location: event.location || '',
    });
    setIsEditDialogOpen(true);
  };

  // Get events for selected date
  const selectedDateEvents = selectedDate ? getEventsForDay(selectedDate) : [];

  return (
    <Card className="w-full">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <CalendarIcon className="w-5 h-5 text-primary" />
            Calendar
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={handlePrevMonth}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="text-sm font-medium min-w-[120px] text-center">
              {format(currentMonth, 'MMMM yyyy')}
            </span>
            <Button variant="ghost" size="icon" onClick={handleNextMonth}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-2 sm:p-4">
        {/* Calendar Grid */}
        <div className="grid grid-cols-7 gap-1 mb-2">
          {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, i) => (
            <div key={i} className="text-center text-xs font-medium text-muted-foreground py-1">
              {day}
            </div>
          ))}
        </div>
        
        <div className="grid grid-cols-7 gap-1">
          {/* Empty cells for days before the start of the month */}
          {Array.from({ length: startOfMonth(currentMonth).getDay() }).map((_, i) => (
            <div key={`empty-${i}`} className="aspect-square" />
          ))}
          
          {days.map((day) => {
            const dayEvents = getEventsForDay(day);
            const isSelected = selectedDate && isSameDay(day, selectedDate);
            const isPast = isBefore(day, startOfToday());
            
            return (
              <motion.button
                key={day.toISOString()}
                onClick={() => handleDayClick(day)}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className={cn(
                  "aspect-square rounded-lg flex flex-col items-center justify-center relative text-sm transition-colors",
                  isToday(day) && "bg-primary text-primary-foreground font-bold",
                  isSelected && !isToday(day) && "bg-primary/20 ring-2 ring-primary",
                  !isToday(day) && !isSelected && "hover:bg-secondary",
                  isPast && !isToday(day) && "text-muted-foreground/50"
                )}
              >
                <span>{format(day, 'd')}</span>
                {dayEvents.length > 0 && (
                  <div className="absolute bottom-0.5 flex gap-0.5">
                    {dayEvents.slice(0, 3).map((event, i) => (
                      <div
                        key={i}
                        className={cn("w-1.5 h-1.5 rounded-full", getEventTypeColor(event.event_type).split(' ')[0])}
                      />
                    ))}
                  </div>
                )}
              </motion.button>
            );
          })}
        </div>

        {/* Selected Date Events */}
        <AnimatePresence mode="wait">
          {selectedDate && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mt-4 pt-4 border-t border-border"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-medium">{format(selectedDate, 'EEEE, MMM d')}</h3>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => setSelectedDate(null)}
                  >
                    <X className="w-3 h-3" />
                  </Button>
                </div>
                <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm" variant="outline" className="h-7">
                      <Plus className="w-3 h-3 mr-1" />
                      Add
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-md">
                    <DialogHeader>
                      <DialogTitle>Add Event</DialogTitle>
                    </DialogHeader>
                    <EventForm
                      formData={formData}
                      setFormData={setFormData}
                      onSubmit={handleAddEvent}
                      submitLabel="Create Event"
                    />
                  </DialogContent>
                </Dialog>
              </div>

              {selectedDateEvents.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No events scheduled
                </p>
              ) : (
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {selectedDateEvents.map((event) => (
                    <motion.div
                      key={event.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="flex items-center justify-between p-2 rounded-lg bg-secondary/50 hover:bg-secondary transition-colors cursor-pointer"
                      onClick={() => openEditDialog(event)}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <Badge className={cn("text-[10px] shrink-0", getEventTypeColor(event.event_type))}>
                          {event.event_type}
                        </Badge>
                        <span className="text-sm font-medium truncate">{event.title}</span>
                      </div>
                      <span className="text-xs text-muted-foreground shrink-0 ml-2">
                        {format(new Date(event.scheduled_date), 'h:mm a')}
                      </span>
                    </motion.div>
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Edit Dialog */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Edit Event</DialogTitle>
            </DialogHeader>
            <EventForm
              formData={formData}
              setFormData={setFormData}
              onSubmit={handleUpdateEvent}
              submitLabel="Save Changes"
            />
            <DialogFooter className="mt-4">
              <Button
                variant="destructive"
                size="sm"
                onClick={() => selectedEvent && handleDeleteEvent(selectedEvent.id)}
              >
                <Trash2 className="w-4 h-4 mr-1" />
                Delete
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
};

// Event Form Component
interface EventFormData {
  title: string;
  event_type: string;
  scheduled_date: string;
  scheduled_time: string;
  duration_minutes: number;
  description: string;
  location: string;
}

interface EventFormProps {
  formData: EventFormData;
  setFormData: React.Dispatch<React.SetStateAction<EventFormData>>;
  onSubmit: (e: React.FormEvent) => void;
  submitLabel: string;
}

const EventForm: React.FC<EventFormProps> = ({ formData, setFormData, onSubmit, submitLabel }) => {
  return (
    <form onSubmit={onSubmit} className="space-y-4 pt-2">
      <div className="space-y-2">
        <Label htmlFor="title">Title *</Label>
        <Input
          id="title"
          value={formData.title}
          onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
          placeholder="e.g., Math Test"
          required
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="event_type">Type</Label>
          <Select
            value={formData.event_type}
            onValueChange={(value) => setFormData(prev => ({ ...prev, event_type: value }))}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {EVENT_TYPES.map((type) => (
                <SelectItem key={type.value} value={type.value}>
                  {type.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="duration">Duration (min)</Label>
          <Input
            id="duration"
            type="number"
            min={15}
            max={480}
            value={formData.duration_minutes}
            onChange={(e) => setFormData(prev => ({ ...prev, duration_minutes: Number(e.target.value) }))}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="date">Date *</Label>
          <Input
            id="date"
            type="date"
            value={formData.scheduled_date}
            onChange={(e) => setFormData(prev => ({ ...prev, scheduled_date: e.target.value }))}
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="time">Time</Label>
          <Input
            id="time"
            type="time"
            value={formData.scheduled_time}
            onChange={(e) => setFormData(prev => ({ ...prev, scheduled_time: e.target.value }))}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="location">Location (optional)</Label>
        <Input
          id="location"
          value={formData.location}
          onChange={(e) => setFormData(prev => ({ ...prev, location: e.target.value }))}
          placeholder="e.g., Room 101"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Notes (optional)</Label>
        <Textarea
          id="description"
          value={formData.description}
          onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
          placeholder="Any additional details..."
          rows={2}
        />
      </div>

      <Button type="submit" className="w-full">
        {submitLabel}
      </Button>
    </form>
  );
};

export default EventCalendar;
