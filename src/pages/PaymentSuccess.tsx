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
        toast({ title: 'Payment Verified', description: 'Your subscription has been activated!' });
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
    </div>
  );
};

export default PaymentSuccess;
