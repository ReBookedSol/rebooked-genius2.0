import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { CheckCircle, XCircle, Loader2, Crown, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { usePageAnimation } from '@/hooks/use-page-animation';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { getPendingTier, clearPendingTier } from '@/utils/paymentLinks';

type PaymentStatus = 'verifying' | 'success' | 'failed';

const PaymentSuccess = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const { shouldAnimate } = usePageAnimation('PaymentSuccess');
  const [status, setStatus] = useState<PaymentStatus>('verifying');
  const [tier, setTier] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [welcomeStage, setWelcomeStage] = useState(1);
  const [showWelcome, setShowWelcome] = useState(false);

  const verifyWithPaystack = useCallback(async (reference: string): Promise<boolean> => {
    console.log('[PaymentSuccess] Verifying with paystack-verify, ref:', reference);
    try {
      const { data, error: invokeError } = await supabase.functions.invoke('paystack-verify', {
        body: { reference }
      });

      if (invokeError) {
        console.error('[PaymentSuccess] Verify error:', invokeError);
        setErrorMessage(`Verification error: ${invokeError.message}`);
        return false;
      }

      if (data?.success) {
        console.log('[PaymentSuccess] Verified successfully:', data);
        setTier(data.tier || getPendingTier());
        return true;
      } else {
        console.error('[PaymentSuccess] Verify failed:', data?.error);
        setErrorMessage(data?.error || 'Payment verification failed');
        return false;
      }
    } catch (err) {
      console.error('[PaymentSuccess] Unexpected verify error:', err);
      setErrorMessage('Unexpected error during verification');
      return false;
    }
  }, []);

  // Verify on mount using the reference from URL
  useEffect(() => {
    if (!user) return;

    const reference = searchParams.get('reference') || searchParams.get('trxref');
    if (!reference) {
      setErrorMessage('No transaction reference found in URL.');
      setStatus('failed');
      return;
    }

    const verify = async () => {
      const success = await verifyWithPaystack(reference);
      if (success) {
        setStatus('success');
        clearPendingTier();
        localStorage.setItem('just_upgraded_premium', 'true');
        setShowWelcome(true);
        toast({ title: 'Payment Verified', description: 'Your subscription has been activated!' });

        // Send Welcome Email
        try {
          await supabase.functions.invoke('send-email', {
            body: {
              to: user.email,
              subject: `Welcome to ReBooked Genius! 🚀`,
              html: `
                <div style="font-family: sans-serif; max-w: 600px; margin: 0 auto; color: #333; padding: 20px;">
                  <h1 style="color: #4F46E5;">You're In! Welcome to Premium</h1>
                  <p>Hi ${user?.user_metadata?.first_name || 'there'},</p>
                  <p>Your account has been successfully upgraded! We're thrilled to have you on board. Here's what you just unlocked:</p>
                  <ul>
                    <li><strong>Unlimited AI Generation:</strong> Create endless quizzes, flashcards, and study guides.</li>
                    <li><strong>Full NBT Access:</strong> Unlimited mock exams and practice questions for NBT prep.</li>
                    <li><strong>Advanced Analytics:</strong> Track your mastery across all your subjects.</li>
                    <li><strong>Zero Limits:</strong> Upload more documents and study without barriers.</li>
                  </ul>
                  <p>Ready to crush your studies? Your premium tools are waiting for you in the dashboard.</p>
                  <a href="https://app.rebookedsolutions.co.za/study" style="display: inline-block; background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; margin-top: 10px; font-weight: bold;">Start Learning Now</a>
                  <p style="margin-top: 30px; font-size: 0.9em; color: #666;">If you need any help, just hit reply. We're here for you!</p>
                  <p>Best,<br/>The ReBooked Genius Team</p>
                </div>
              `
            }
          });
        } catch (e) {
          console.error("Failed to send welcome email", e);
        }
      } else {
        setStatus('failed');
      }
    };

    // Small delay to let the page render
    const timer = setTimeout(verify, 500);
    return () => clearTimeout(timer);
  }, [user, searchParams, verifyWithPaystack, toast]);

  const handleContinue = () => {
    navigate('/');
  };

  const handleRetry = () => {
    navigate('/settings/billing');
  };

  const getTierName = (tierValue: string | null) => {
    if (tierValue === 'tier1') return 'Pro';
    if (tierValue === 'tier2') return 'Premium';
    return 'Paid';
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
      >
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            {status === 'verifying' && (
              <>
                <div className="mx-auto mb-4">
                  <Loader2 className="h-16 w-16 text-primary animate-spin" />
                </div>
                <CardTitle className="text-2xl">Verifying Payment</CardTitle>
                <CardDescription>
                  Please wait while we confirm your payment...
                </CardDescription>
              </>
            )}

            {status === 'success' && (
              <>
                <motion.div 
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 200, damping: 10 }}
                  className="mx-auto mb-4"
                >
                  <div className="relative">
                    <CheckCircle className="h-16 w-16 text-green-500" />
                    <Sparkles className="absolute -top-2 -right-2 h-6 w-6 text-yellow-500" />
                  </div>
                </motion.div>
                <CardTitle className="text-2xl text-green-600">Payment Successful!</CardTitle>
                <CardDescription>
                  Welcome to ReBooked {getTierName(tier)}!
                </CardDescription>
              </>
            )}

            {status === 'failed' && (
              <>
                <div className="mx-auto mb-4">
                  <XCircle className="h-16 w-16 text-destructive" />
                </div>
                <CardTitle className="text-2xl text-destructive">Verification Failed</CardTitle>
                <CardDescription>
                  {errorMessage || 'We couldn\'t verify your payment. If you were charged, please contact support.'}
                </CardDescription>
              </>
            )}
          </CardHeader>

          <CardContent className="space-y-4">
            {status === 'verifying' && (
              <div className="text-center text-sm text-muted-foreground">
                <p>Verifying your payment...</p>
              </div>
            )}

            {status === 'success' && (
              <div className="space-y-4">
                <div className="bg-primary/10 rounded-lg p-4 text-center">
                  <Crown className="h-8 w-8 text-primary mx-auto mb-2" />
                  <p className="font-medium text-primary">
                    {tier === 'tier2' ? 'Premium' : 'Pro'} Plan Activated
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    You now have access to all {tier === 'tier2' ? 'premium' : 'pro'} features
                  </p>
                </div>

                <Button onClick={handleContinue} className="w-full" size="lg">
                  Start Learning
                </Button>
              </div>
            )}

            {status === 'failed' && (
              <div className="space-y-3">
                <Button onClick={handleRetry} variant="outline" className="w-full">
                  Try Again
                </Button>
                <Button onClick={handleContinue} variant="ghost" className="w-full">
                  Go to Dashboard
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      <Dialog open={showWelcome} onOpenChange={setShowWelcome}>
        <DialogContent className="sm:max-w-md p-6 border-none shadow-2xl bg-background overflow-hidden" hideCloseButton>
          <div className="absolute top-0 left-0 w-full h-1.5 bg-secondary flex">
             <div className="h-full bg-primary transition-all duration-300" style={{ width: `${(welcomeStage / 3) * 100}%` }} />
          </div>
          
          <motion.div
            key={welcomeStage}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
            className="flex flex-col items-center justify-center text-center mt-4"
          >
            {welcomeStage === 1 && (
              <div className="space-y-6">
                <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto relative mb-4">
                  <Crown className="h-10 w-10 text-primary" />
                  <Sparkles className="absolute -top-1 -right-1 h-6 w-6 text-yellow-500 animate-pulse" />
                </div>
                <div className="space-y-2">
                  <h2 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-primary/60">
                    Welcome to {getTierName(tier)}!
                  </h2>
                  <p className="text-muted-foreground text-sm max-w-[280px] mx-auto">
                    Your account has been successfully upgraded. Let's see what's new.
                  </p>
                </div>
                <Button onClick={() => setWelcomeStage(2)} className="w-full mt-4 h-12 text-sm font-semibold rounded-xl shadow-lg shadow-primary/20">
                  See what's unlocked
                </Button>
              </div>
            )}

            {welcomeStage === 2 && (
              <div className="space-y-6 w-full">
                <h2 className="text-xl font-bold">Features Unlocked</h2>
                <div className="space-y-4 text-left bg-secondary/30 p-4 rounded-2xl border border-secondary">
                  <div className="flex items-start gap-3">
                    <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
                    <div>
                      <h4 className="font-semibold text-sm">Unlimited AI Generation</h4>
                      <p className="text-xs text-muted-foreground">Create endless quizzes & flashcards</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
                    <div>
                      <h4 className="font-semibold text-sm">NBT Mock Exams</h4>
                      <p className="text-xs text-muted-foreground">Access unlimited practice materials</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
                    <div>
                      <h4 className="font-semibold text-sm">Advanced Analytics</h4>
                      <p className="text-xs text-muted-foreground">Track mastery across all your subjects</p>
                    </div>
                  </div>
                </div>
                <Button onClick={() => setWelcomeStage(3)} className="w-full mt-2 h-12 text-sm font-semibold rounded-xl shadow-lg shadow-primary/20">
                  Continue
                </Button>
              </div>
            )}

            {welcomeStage === 3 && (
              <div className="space-y-6 w-full">
                <div className="w-20 h-20 rounded-full bg-primary flex items-center justify-center mx-auto mb-4 shadow-lg shadow-primary/30">
                  <Sparkles className="h-10 w-10 text-primary-foreground" />
                </div>
                <div className="space-y-2">
                  <h2 className="text-2xl font-bold">Ready to Ace It?</h2>
                  <p className="text-muted-foreground text-sm max-w-[280px] mx-auto">
                    You have all the tools you need. Let's get started on your journey to success.
                  </p>
                </div>
                <Button 
                  onClick={() => { setShowWelcome(false); handleContinue(); }} 
                  className="w-full mt-4 h-12 text-sm font-semibold rounded-xl"
                >
                  Start Learning
                </Button>
              </div>
            )}
          </motion.div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PaymentSuccess;
