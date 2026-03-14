import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, Check, Trash2, AlertCircle, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { useAIContext } from '@/contexts/AIContext';
import { supabase } from '@/integrations/supabase/client';
import { usePageAnimation } from '@/hooks/use-page-animation';
import { Tables } from '@/integrations/supabase/types';
import AppLayout from '@/components/layout/AppLayout';
import { format } from 'date-fns';

interface Notification {
  id: string;
  title: string;
  message: string;
  type: string;
  is_read: boolean;
  created_at: string;
}

type SystemAnnouncement = Tables<'system_announcements'>;

const Notifications = () => {
  const { user } = useAuth();
  const { setAiContext } = useAIContext();
  const { shouldAnimate } = usePageAnimation('Notifications');
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [announcements, setAnnouncements] = useState<SystemAnnouncement[]>([]);
  const [expandedAnnouncementId, setExpandedAnnouncementId] = useState<string | null>(null);

  useEffect(() => {
    setAiContext({
      currentPage: 'notifications',
      location: 'User Notifications & System Announcements',
      activeAnalytics: null,
      activeDocument: null,
      activePaper: null
    });
  }, [setAiContext]);

  useEffect(() => {
    if (user) {
      fetchNotifications();
      fetchAnnouncements();

      // Real-time subscription for new notifications
      const channel = supabase
        .channel('public:notifications')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${user.id}`,
          },
          (payload) => {
            setNotifications((prev) => [payload.new as Notification, ...prev]);
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [user]);

  const fetchNotifications = async () => {
    const { data } = await supabase.from('notifications').select('*').eq('user_id', user?.id).order('created_at', { ascending: false });
    if (data) setNotifications(data);
  };

  const fetchAnnouncements = async () => {
    try {
      const now = new Date().toISOString();

      const { data } = await supabase
        .from('system_announcements')
        .select('*')
        .eq('is_active', true)
        .or(`expires_at.is.null,expires_at.gt.${now}`)
        .order('priority', { ascending: false })
        .order('created_at', { ascending: false });

      if (data) setAnnouncements(data);
    } catch (error) {
      console.error('Failed to fetch announcements:', error);
    }
  };

  const markAsRead = async (id: string) => {
    await supabase.from('notifications').update({ is_read: true }).eq('id', id);
    setNotifications(notifications.map(n => n.id === id ? { ...n, is_read: true } : n));
  };

  return (
    <AppLayout>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-display font-bold text-foreground">Notifications</h1>
            <p className="text-muted-foreground mt-1">Stay updated on your learning</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={async () => {
              const unread = notifications.filter(n => !n.is_read);
              if (unread.length === 0) return;
              const ids = unread.map(n => n.id);
              await supabase.from('notifications').update({ is_read: true }).in('id', ids);
              setNotifications(notifications.map(n => ({ ...n, is_read: true })));
            }}>
              <Check className="w-4 h-4 mr-2" />Mark all read
            </Button>
            <Button variant="outline" onClick={async () => {
              if (notifications.length === 0) return;
              const confirmed = window.confirm('Are you sure you want to clear all notifications?');
              if (!confirmed) return;
              await supabase.from('notifications').delete().eq('user_id', user?.id);
              setNotifications([]);
            }}>
              <Trash2 className="w-4 h-4 mr-2" />Clear all
            </Button>
          </div>
        </div>

        {announcements.length === 0 && notifications.length === 0 ? (
          <div className="text-center py-12">
            <Bell className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">No notifications yet</p>
          </div>
        ) : (
          <div className="space-y-3">
            {announcements.map((announcement, i) => (
              <motion.div
                key={`announcement-${announcement.id}`}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <Card className={announcement.priority === 'high' ? 'border-destructive/50 bg-destructive/5' : 'border-primary/50 bg-primary/5'}>
                  <CardContent className="p-4">
                    <div className="flex items-start gap-4">
                      <div className={`w-2 h-2 rounded-full mt-1 flex-shrink-0 ${announcement.priority === 'high' ? 'bg-destructive' : 'bg-primary'}`} />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-foreground">{announcement.title}</p>
                        {announcement.message.length > 100 ? (
                          <div className="mt-2">
                            <AnimatePresence>
                              {expandedAnnouncementId === announcement.id ? (
                                <motion.div
                                  initial={{ opacity: 0, height: 0 }}
                                  animate={{ opacity: 1, height: 'auto' }}
                                  exit={{ opacity: 0, height: 0 }}
                                  transition={{ duration: 0.2 }}
                                >
                                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">{announcement.message}</p>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => setExpandedAnnouncementId(null)}
                                    className="mt-2 h-auto p-1"
                                  >
                                    <ChevronDown className="w-4 h-4 rotate-180 mr-1" />
                                    Show less
                                  </Button>
                                </motion.div>
                              ) : (
                                <motion.div
                                  initial={{ opacity: 0, height: 0 }}
                                  animate={{ opacity: 1, height: 'auto' }}
                                  exit={{ opacity: 0, height: 0 }}
                                  transition={{ duration: 0.2 }}
                                >
                                  <p className="text-sm text-muted-foreground line-clamp-2">{announcement.message}</p>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => setExpandedAnnouncementId(announcement.id)}
                                    className="mt-2 h-auto p-1"
                                  >
                                    <ChevronDown className="w-4 h-4 mr-1" />
                                    Show more
                                  </Button>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground mt-1">{announcement.message}</p>
                        )}
                        <p className="text-xs text-muted-foreground mt-2">
                          {format(new Date(announcement.created_at || ''), 'MMM d, h:mm a')}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}

            {notifications.map((n, i) => (
              <motion.div
                key={n.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: (announcements.length + i) * 0.05 }}
              >
                <Card className={!n.is_read ? 'border-primary/50 bg-primary/5' : ''}>
                  <CardContent className="p-4 flex items-center gap-4">
                    <div className={`w-2 h-2 rounded-full ${!n.is_read ? 'bg-primary' : 'bg-muted'}`} />
                    <div className="flex-1">
                      <p className="font-medium text-foreground">{n.title}</p>
                      <p className="text-sm text-muted-foreground">{n.message}</p>
                      <p className="text-xs text-muted-foreground mt-1">{format(new Date(n.created_at), 'MMM d, h:mm a')}</p>
                    </div>
                    {!n.is_read && <Button size="sm" variant="ghost" onClick={() => markAsRead(n.id)}><Check className="w-4 h-4" /></Button>}
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        )}
      </motion.div>
    </AppLayout>
  );
};

export default Notifications;
