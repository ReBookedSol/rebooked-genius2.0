import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { CheckCircle2, Calendar, Star, ArrowRight, Share2, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

const PreRegisterSuccess = () => {
  const navigate = useNavigate();
  const { signOut, user } = useAuth();

  useEffect(() => {
    const sendConfirmationEmail = async () => {
      if (user && user.email) {
        const emailSentKey = `pre_reg_email_sent_${user.id}`;
        const hasSentEmail = localStorage.getItem(emailSentKey);
        
        if (!hasSentEmail) {
          try {
            await supabase.functions.invoke('send-email', {
              body: {
                to: user.email,
                template: 'pre_register',
                props: { name: user.user_metadata?.full_name || 'Student' }
              }
            });
            localStorage.setItem(emailSentKey, 'true');
            console.log('Pre-registration confirmation email sent to:', user.email);
          } catch (error) {
            console.error('Error sending pre-registration email:', error);
          }
        }
      }
    };

    sendConfirmationEmail();
  }, [user]);

  const handleClose = async () => {
    await signOut();
    navigate('/pre-register');
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6 overflow-hidden relative">
      {/* Background Decor */}
      <div className="absolute inset-0 z-0 opacity-40">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/20 rounded-full blur-[100px]" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-emerald-500/10 rounded-full blur-[100px]" />
      </div>

      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-2xl bg-card border border-border shadow-2xl rounded-3xl p-8 lg:p-12 text-center relative z-10"
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", damping: 12, delay: 0.2 }}
          className="w-20 h-20 bg-green-500/10 text-green-500 rounded-full flex items-center justify-center mx-auto mb-8"
        >
          <CheckCircle2 className="w-10 h-10" />
        </motion.div>

        <h1 className="text-4xl lg:text-5xl font-display font-bold mb-4 bg-gradient-to-r from-primary to-[#2d5a56] bg-clip-text text-transparent">
          You're on the list!
        </h1>
        
        <p className="text-xl text-muted-foreground mb-12 max-w-md mx-auto">
          Thanks for pre-registering. Your 7-day premium trial has been reserved and will be active on <span className="text-foreground font-bold italic">April 1st</span>.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12 text-left">
          <div className="p-4 bg-muted/50 rounded-2xl border border-border/50">
            <Calendar className="w-6 h-6 text-primary mb-3" />
            <h3 className="font-bold mb-1">Launch Date</h3>
            <p className="text-sm text-muted-foreground">April 1st, 2026</p>
          </div>
          <div className="p-4 bg-muted/50 rounded-2xl border border-border/50">
            <Star className="w-6 h-6 text-yellow-500 mb-3" />
            <h3 className="font-bold mb-1">Your Reward</h3>
            <p className="text-sm text-muted-foreground">7 Days Premium</p>
          </div>
          <div className="p-4 bg-muted/50 rounded-2xl border border-border/50">
            <Sparkles className="w-6 h-6 text-primary mb-3" />
            <h3 className="font-bold mb-1">Early Access</h3>
            <p className="text-sm text-muted-foreground">Beta features enabled</p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button 
            size="lg" 
            className="rounded-full px-8 h-14 text-lg font-bold"
            onClick={handleClose}
          >
            Close
            <ArrowRight className="w-5 h-5 ml-2" />
          </Button>
          
          <Button 
            size="lg" 
            variant="outline" 
            className="rounded-full px-8 h-14 text-lg font-bold"
            onClick={() => {
              if (navigator.share) {
                navigator.share({
                  title: 'ReBooked Genius Pre-registration',
                  text: 'Check out ReBooked Genius! I just pre-registered for 7 days of free premium.',
                  url: window.location.origin + '/pre-register',
                });
              }
            }}
          >
            <Share2 className="w-5 h-5 mr-2" />
            Share With Friends
          </Button>
        </div>

        <p className="mt-12 text-muted-foreground text-sm flex items-center justify-center gap-2">
          <Calendar className="w-4 h-4" />
          Mark your calendar: April 1st is the big day!
        </p>
      </motion.div>
    </div>
  );
};

export default PreRegisterSuccess;
