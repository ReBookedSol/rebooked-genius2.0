import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  MessageCircle,
  AlertCircle,
  HelpCircle,
  FileText,
  ExternalLink,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/contexts/AuthContext';
import { useAIContext } from '@/contexts/AIContext';
import { useToast } from '@/hooks/use-toast';
import { usePageAnimation } from '@/hooks/use-page-animation';
import { useTranslation } from '@/hooks/use-translation';
import { supabase } from '@/integrations/supabase/client';
import AppLayout from '@/components/layout/AppLayout';
import SettingsSidebar from '@/components/layout/SettingsSidebar';

const SettingsSupport = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { setAiContext } = useAIContext();
  const { shouldAnimate } = usePageAnimation('SettingsSupport');
  const { t } = useTranslation();

  const [loading, setLoading] = useState(false);
  const [contactMessage, setContactMessage] = useState('');
  const [reportMessage, setReportMessage] = useState('');

  useEffect(() => {
    setAiContext({
      currentPage: 'settings',
      location: 'Support & Help Center',
      activeAnalytics: null,
      activeDocument: null,
      activePaper: null
    });
  }, [setAiContext]);

  const handleContactSupport = async () => {
    if (!contactMessage.trim() || !user?.id) {
      if (!user?.id) {
        toast({ title: t('settings.error'), description: 'You must be logged in to send a message.', variant: 'destructive' });
      }
      return;
    }

    try {
      setLoading(true);
      const { error } = await supabase.from('support_tickets').insert({
        user_id: user.id,
        type: 'support',
        message: contactMessage.trim(),
        status: 'open',
      });

      if (error) throw error;
      toast({ title: t('settings.success'), description: t('settings.messageReceived') });
      setContactMessage('');
    } catch (error: any) {
      console.error('Support ticket error:', error);
      toast({ title: t('settings.error'), description: error?.message || t('settings.failedToSend'), variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleReportProblem = async () => {
    if (!reportMessage.trim() || !user?.id) {
      if (!user?.id) {
        toast({ title: t('settings.error'), description: 'You must be logged in to submit a report.', variant: 'destructive' });
      }
      return;
    }

    try {
      setLoading(true);
      const { error } = await supabase.from('support_tickets').insert({
        user_id: user.id,
        type: 'report',
        message: reportMessage.trim(),
        status: 'open',
      });

      if (error) throw error;
      toast({ title: t('settings.success'), description: t('settings.reportSubmitted') });
      setReportMessage('');
    } catch (error: any) {
      console.error('Report ticket error:', error);
      toast({ title: t('settings.error'), description: error?.message || t('settings.failedToSend'), variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppLayout>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full">
        <div className="mb-4">
          <h1 className="text-3xl font-display font-bold text-foreground">Settings</h1>
          <p className="text-muted-foreground mt-1">Get help and support</p>
        </div>

        <div className="flex flex-col lg:flex-row gap-8">
          {/* Settings Sidebar */}
          <SettingsSidebar />

          {/* Main Content */}
          <div className="flex-1 space-y-6">
            {/* SUPPORT & HELP */}
            <Card id="support" className="scroll-mt-24">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageCircle className="w-5 h-5" />
                  {t('settings.supportNHelp')}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Contact Support */}
                <div className="space-y-3">
                  <Label className="text-sm font-medium">{t('settings.contactSupport')}</Label>
                  <Textarea
                    value={contactMessage}
                    onChange={(e) => setContactMessage(e.target.value)}
                    placeholder={t('settings.describeQuestion')}
                    className="min-h-24"
                  />
                  <Button onClick={handleContactSupport} disabled={loading || !contactMessage.trim()}>
                    {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <MessageCircle className="w-4 h-4 mr-2" />}
                    {t('settings.sendMessage')}
                  </Button>
                </div>

                {/* Report a Problem */}
                <div className="space-y-3 pt-4 border-t border-border">
                  <Label className="text-sm font-medium">{t('settings.reportBug')}</Label>
                  <Textarea
                    value={reportMessage}
                    onChange={(e) => setReportMessage(e.target.value)}
                    placeholder={t('settings.tellUsNotWorking')}
                    className="min-h-24"
                  />
                  <Button variant="outline" onClick={handleReportProblem} disabled={loading || !reportMessage.trim()}>
                    {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <AlertCircle className="w-4 h-4 mr-2" />}
                    {t('settings.submitReport')}
                  </Button>
                </div>

                {/* Help Links */}
                <div className="space-y-2 pt-4 border-t border-border">
                  <Label className="text-sm font-medium">{t('settings.quickLinks')}</Label>
                  <div className="space-y-2">
                    <a
                      href="https://genius.rebookedsolutions.co.za"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-between p-3 rounded-lg hover:bg-secondary transition-colors"
                    >
                      <span className="flex items-center gap-2 text-sm">
                        <HelpCircle className="w-4 h-4" />
                        {t('settings.faqs')}
                      </span>
                      <ExternalLink className="w-4 h-4 text-muted-foreground" />
                    </a>
                    <a
                      href="https://genius.rebookedsolutions.co.za/terms"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-between p-3 rounded-lg hover:bg-secondary transition-colors"
                    >
                      <span className="flex items-center gap-2 text-sm">
                        <FileText className="w-4 h-4" />
                        {t('settings.termsConditions')}
                      </span>
                      <ExternalLink className="w-4 h-4 text-muted-foreground" />
                    </a>
                    <a
                      href="https://genius.rebookedsolutions.co.za/privacy-policy"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-between p-3 rounded-lg hover:bg-secondary transition-colors"
                    >
                      <span className="flex items-center gap-2 text-sm">
                        <FileText className="w-4 h-4" />
                        {t('settings.privacyPolicy')}
                      </span>
                      <ExternalLink className="w-4 h-4 text-muted-foreground" />
                    </a>
                    <a
                      href="https://genius.rebookedsolutions.co.za/refund-policy"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-between p-3 rounded-lg hover:bg-secondary transition-colors"
                    >
                      <span className="flex items-center gap-2 text-sm">
                        <FileText className="w-4 h-4" />
                        {t('settings.refundPolicy')}
                      </span>
                      <ExternalLink className="w-4 h-4 text-muted-foreground" />
                    </a>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </motion.div>
    </AppLayout>
  );
};

export default SettingsSupport;
