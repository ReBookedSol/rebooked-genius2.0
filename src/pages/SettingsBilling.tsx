import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  CreditCard,
  Loader2,
  Check,
  Crown,
  Sparkles,
  Calendar,
  X,
  AlertCircle,
  Ticket,
  RefreshCw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/contexts/AuthContext';
import { useAIContext } from '@/contexts/AIContext';
import { useToast } from '@/hooks/use-toast';
import { usePageAnimation } from '@/hooks/use-page-animation';
import { useSubscription } from '@/hooks/useSubscription';
import { supabase } from '@/integrations/supabase/client';
import AppLayout from '@/components/layout/AppLayout';
import SettingsSidebar from '@/components/layout/SettingsSidebar';

const PLANS = [
  {
    id: 'free',
    name: 'Free',
    priceMonthly: 0,
    description: 'Get started with basic features',
    features: [
      '5,000 AI tokens per day',
      '2 study documents',
      '5 quiz sets',
      '5 flashcard sets',
      'Basic analytics',
      'Basic AI models',
    ],
    limitations: [
      'No NBT access',
      'No achievement rewards',
    ],
  },
  {
    id: 'tier1',
    name: 'Pro',
    priceMonthly: 99,
    priceAnnual: 79,
    description: 'Unlock unlimited learning',
    popular: true,
    features: [
      'Unlimited AI messages',
      'Unlimited study documents',
      'Unlimited pages per document',
      'Unlimited quizzes & flashcards',
      'Unlimited exams',
      'YouTube lesson generator',
      'Detailed analytics',
      'AI-assisted past papers',
      'Achievement rewards & discounts',
      'Advanced AI model',
    ],
    limitations: [
      'No NBT access',
    ],
  },
  {
    id: 'tier2',
    name: 'Premium',
    priceMonthly: 149,
    priceAnnual: 120,
    description: 'Everything + NBT preparation',
    features: [
      'Everything in Pro',
      'Full NBT section access',
      'NBT practice tests',
      'NBT study materials',
      'NBT progress tracking',
      'Priority support',
    ],
    limitations: [],
  },
];

const SettingsBilling = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { setAiContext } = useAIContext();
  const { shouldAnimate } = usePageAnimation('SettingsBilling');
  const { subscription, tier } = useSubscription();

  const [planLoading, setPlanLoading] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [managingCard, setManagingCard] = useState(false);
  const [paymentType, setPaymentType] = useState<'monthly' | 'annual'>('monthly');

  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [selectedPlanForConfirm, setSelectedPlanForConfirm] = useState<typeof PLANS[0] | null>(null);
  const [couponCode, setCouponCode] = useState('');
  const [applyingCode, setApplyingCode] = useState(false);

  useEffect(() => {
    setAiContext({
      currentPage: 'settings',
      location: 'Billing & Subscription Settings',
      activeAnalytics: null,
      activeDocument: null,
      activePaper: null
    });
  }, [setAiContext]);

  const getDisplayPrice = (plan: typeof PLANS[0]): number => {
    if (paymentType === 'annual' && plan.priceAnnual) return plan.priceAnnual;
    return plan.priceMonthly;
  };

  const getTotalPrice = (plan: typeof PLANS[0]): number => {
    if (!plan || plan.priceMonthly === 0) return 0;
    if (paymentType === 'annual' && plan.priceAnnual) return plan.priceAnnual * 12;
    return plan.priceMonthly;
  };

  const handleUpgradeClick = (planId: string) => {
    if (planId === 'free') return;
    const plan = PLANS.find(p => p.id === planId);
    if (plan) {
      setSelectedPlanForConfirm(plan);
      setShowConfirmDialog(true);
    }
  };

  const handleUpgrade = async () => {
    if (!user || !selectedPlanForConfirm) {
      toast({ title: 'Please sign in', description: 'You need to be signed in to upgrade', variant: 'destructive' });
      return;
    }

    const planId = selectedPlanForConfirm.id;
    setPlanLoading(planId);
    setShowConfirmDialog(false);

    try {
      const edgeFunction = paymentType === 'annual' ? 'paystack-annual' : 'paystack-initialize';

      const { data, error } = await supabase.functions.invoke(edgeFunction, {
        body: { tier: planId },
      });

      if (error) throw new Error(error.message || 'Failed to initialize payment');
      if (!data?.authorization_url) throw new Error('No authorization URL received');

      sessionStorage.setItem('pendingTier', planId);
      sessionStorage.setItem('pendingPaymentType', paymentType);

      window.location.href = data.authorization_url;
    } catch (error) {
      console.error('Payment initialization error:', error);
      toast({
        title: 'Payment failed',
        description: error instanceof Error ? error.message : 'Could not initialize payment. Please try again.',
        variant: 'destructive',
      });
      setPlanLoading(null);
    }
  };

  const handleCancel = async () => {
    if (!user || !subscription) return;
    setCancelling(true);
    try {
      const { data, error } = await supabase.functions.invoke('paystack-cancel', {});
      if (error) throw error;
      toast({ title: 'Subscription cancelled', description: data.message || 'Your subscription has been cancelled.' });
    } catch (error) {
      console.error('Cancel error:', error);
      toast({ title: 'Failed to cancel', description: 'Could not cancel subscription. Please try again.', variant: 'destructive' });
    } finally {
      setCancelling(false);
    }
  };

  const handleManageCard = async () => {
    setManagingCard(true);
    try {
      const { data, error } = await supabase.functions.invoke('paystack-manage-card', {});
      if (error) throw error;
      if (data?.link) {
        window.open(data.link, '_blank');
      } else {
        throw new Error('No manage link received');
      }
    } catch (error) {
      console.error('Manage card error:', error);
      toast({ title: 'Could not open card management', description: 'Please try again later.', variant: 'destructive' });
    } finally {
      setManagingCard(false);
    }
  };

  const renderPlanCard = (plan: typeof PLANS[0], index: number) => {
    const isCurrent = plan.id === tier;
    const isUpgrade = PLANS.findIndex(p => p.id === tier) < index;
    const price = getDisplayPrice(plan);

    return (
      <motion.div
        key={plan.id}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.1 }}
      >
        <Card className={`relative h-full ${plan.popular ? 'ring-2 ring-primary shadow-lg' : isCurrent ? 'ring-2 ring-muted-foreground/30' : ''}`}>
          {plan.popular && (
            <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary">
              <Sparkles className="w-3 h-3 mr-1" />
              Most Popular
            </Badge>
          )}

          <CardHeader className="pb-3">
            <CardTitle className="flex items-center justify-between">
              <span>{plan.name}</span>
              {isCurrent && <Badge variant="outline" className="text-xs">Current</Badge>}
            </CardTitle>
            <div className="mt-2">
              <span className="text-4xl font-bold">R{price}</span>
              {price > 0 && (
                <span className="text-muted-foreground">
                  /{paymentType === 'annual' ? 'mo, billed annually' : 'month'}
                </span>
              )}
            </div>
            {paymentType === 'annual' && plan.priceAnnual && (
              <div className="flex flex-col gap-1 mt-1">
                <Badge variant="secondary" className="bg-green-100 text-green-700 hover:bg-green-100 border-none py-1 w-fit">
                  <Sparkles className="w-3 h-3 mr-1" />
                  Save {Math.round(((plan.priceMonthly - plan.priceAnnual) / plan.priceMonthly) * 100)}%
                </Badge>
              </div>
            )}
            <CardDescription>{plan.description}</CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            <ul className="space-y-2">
              {plan.features.map((feature) => (
                <li key={feature} className="flex items-start gap-2 text-sm">
                  <Check className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                  <span>{feature}</span>
                </li>
              ))}
              {plan.limitations.map((limitation) => (
                <li key={limitation} className="flex items-start gap-2 text-sm text-muted-foreground">
                  <X className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <span>{limitation}</span>
                </li>
              ))}
            </ul>

            <Button
              className="w-full"
              variant={isCurrent ? 'outline' : isUpgrade ? 'default' : 'secondary'}
              disabled={isCurrent || planLoading !== null}
              onClick={() => handleUpgradeClick(plan.id)}
            >
              {planLoading === plan.id ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Processing...</>
              ) : isCurrent ? 'Current Plan' : isUpgrade ? (
                <><Crown className="w-4 h-4 mr-2" />Upgrade to {plan.name}</>
              ) : 'Downgrade'}
            </Button>
          </CardContent>
        </Card>
      </motion.div>
    );
  };

  return (
    <AppLayout>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full">
        <div className="mb-4">
          <h1 className="text-3xl font-display font-bold text-foreground">Settings</h1>
          <p className="text-muted-foreground mt-1">Manage your billing and subscription</p>
        </div>

        <div className="flex flex-col lg:flex-row gap-8">
          <SettingsSidebar />

          <div className="flex-1 space-y-6 w-full">
            {/* Current Subscription Status */}
            {subscription && tier !== 'free' && (
              <Card className="border-primary/30 bg-primary/5">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <CreditCard className="w-5 h-5 text-primary" />
                    Current Subscription
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap items-center gap-4">
                    <Badge className="text-sm px-3 py-1">
                      {tier === 'tier1' ? 'Pro' : 'Premium'} Plan
                    </Badge>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Calendar className="w-4 h-4" />
                      {subscription.currentPeriodEnd ? (
                        <>
                          {subscription.status === 'non-renewing' ? 'Access until' : 'Renews on'}:{' '}
                          {subscription.currentPeriodEnd.toLocaleDateString()}
                        </>
                      ) : 'Active subscription'}
                    </div>
                    <div className="ml-auto flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleManageCard}
                        disabled={managingCard}
                      >
                        {managingCard ? (
                          <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Loading...</>
                        ) : (
                          <><RefreshCw className="w-4 h-4 mr-2" />Update Card</>
                        )}
                      </Button>
                      {subscription.status === 'active' && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleCancel}
                          disabled={cancelling}
                        >
                          {cancelling ? (
                            <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Cancelling...</>
                          ) : 'Cancel Subscription'}
                        </Button>
                      )}
                    </div>
                  </div>
                  {subscription.status === 'non-renewing' && (
                    <Alert className="mt-4">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                        Your subscription is cancelled and will not renew. You'll retain access until {subscription.currentPeriodEnd?.toLocaleDateString()}.
                      </AlertDescription>
                    </Alert>
                  )}
                  {subscription.status === 'attention' && (
                    <Alert variant="destructive" className="mt-4">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                        There was an issue with your payment. Please <button onClick={handleManageCard} className="underline font-medium">update your payment method</button>.
                      </AlertDescription>
                    </Alert>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Plans Grid */}
            <div className="space-y-4">
              <div>
                <h3 className="text-xl font-semibold text-foreground flex items-center gap-2 mb-2">
                  <Crown className="w-6 h-6 text-primary" />
                  Subscription Plans
                </h3>
                <p className="text-sm text-muted-foreground">Choose the plan that best fits your learning needs</p>
              </div>

              <Tabs value={paymentType} onValueChange={(value) => setPaymentType(value as 'monthly' | 'annual')} className="w-full">
                <TabsList className="grid w-full grid-cols-2 max-w-md">
                  <TabsTrigger value="monthly">Monthly</TabsTrigger>
                  <TabsTrigger value="annual">Annual (Save 20%)</TabsTrigger>
                </TabsList>

                <TabsContent value="monthly" className="space-y-4">
                  <div className="grid md:grid-cols-3 gap-6">
                    {PLANS.map((plan, index) => renderPlanCard(plan, index))}
                  </div>
                </TabsContent>

                <TabsContent value="annual" className="space-y-4">
                  <div className="grid md:grid-cols-3 gap-6">
                    {PLANS.map((plan, index) => renderPlanCard(plan, index))}
                  </div>
                </TabsContent>
              </Tabs>
            </div>

            {/* FAQ Section */}
            <Card id="billing" className="scroll-mt-24">
              <CardHeader>
                <CardTitle>Frequently Asked Questions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h4 className="font-medium mb-1">How do subscriptions work?</h4>
                  <p className="text-sm text-muted-foreground">
                    Monthly plans are billed automatically via Paystack. Annual plans are a one-time payment for 12 months of access. You can cancel monthly plans anytime.
                  </p>
                </div>
                <div>
                  <h4 className="font-medium mb-1">What happens when I cancel?</h4>
                  <p className="text-sm text-muted-foreground">
                    When you cancel a monthly plan, you'll retain access until the end of your billing period. After that, you'll be moved to the Free plan.
                  </p>
                </div>
                <div>
                  <h4 className="font-medium mb-1">Can I update my payment card?</h4>
                  <p className="text-sm text-muted-foreground">
                    Yes! Click "Update Card" above to be redirected to Paystack's secure card management page. We never store your card details.
                  </p>
                </div>
                <div className="pt-4 border-t border-border">
                  <p className="text-xs text-muted-foreground text-center">
                    Payments are processed securely through Paystack. All prices are in South African Rand (ZAR).
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Upgrade Confirmation Modal */}
        <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Crown className="w-5 h-5 text-primary" />
                Confirm Your Upgrade
              </DialogTitle>
              <DialogDescription>
                You're about to upgrade to the <span className="font-bold text-foreground">{selectedPlanForConfirm?.name}</span> plan.
              </DialogDescription>
            </DialogHeader>

            <div className="py-6 space-y-6">
              <div className="bg-muted/50 p-4 rounded-xl space-y-3">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">Selected Plan:</span>
                  <span className="font-semibold">{selectedPlanForConfirm?.name}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">Billing:</span>
                  <span className="font-semibold">
                    {paymentType === 'annual' ? 'Annual (one-time)' : 'Monthly (recurring)'}
                  </span>
                </div>
                <div className="pt-3 border-t flex justify-between items-center">
                  <span className="font-bold">Total:</span>
                  <span className="text-xl font-bold text-primary">
                    R{selectedPlanForConfirm ? getTotalPrice(selectedPlanForConfirm) : 0}
                  </span>
                </div>
                <p className="text-[10px] text-muted-foreground italic text-center">
                  {paymentType === 'annual'
                    ? 'One-time payment for 12 months of access.'
                    : 'Billed monthly via Paystack. Cancel anytime.'}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="coupon" className="text-xs font-medium uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Ticket className="w-3 h-3" />
                  Have a code?
                </Label>
                <div className="flex gap-2">
                  <Input
                    id="coupon"
                    placeholder="Enter code"
                    value={couponCode}
                    onChange={(e) => setCouponCode(e.target.value)}
                    className="flex-1"
                  />
                   <Button variant="secondary" size="sm" disabled={!couponCode || applyingCode} onClick={async () => {
                     setApplyingCode(true);
                     try {
                       const { data, error } = await supabase.functions.invoke('redeem-code', {
                         body: { code: couponCode },
                       });
                       if (error) throw error;
                       if (data?.error) throw new Error(data.error);
                       toast({ title: "Code Applied!", description: data.message });
                       setCouponCode('');
                       if (data?.type === 'trial') {
                         window.location.reload();
                       }
                     } catch (err: any) {
                       toast({ title: "Invalid Code", description: err.message || "Could not apply code", variant: "destructive" });
                     } finally {
                       setApplyingCode(false);
                     }
                   }}>
                     {applyingCode ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Apply'}
                   </Button>
                </div>
              </div>

              <div className="space-y-3">
                <p className="text-xs text-muted-foreground leading-relaxed">
                  By clicking "Pay Now", you'll be redirected to Paystack to securely complete your payment. You can cancel your subscription at any time from these settings. By purchasing this, you agree to ReBooked Genius' <a href="https://genius.rebookedsolutions.co.za/terms" target="_blank" rel="noopener noreferrer" className="underline text-primary hover:text-primary/80">Terms and Conditions</a> and <a href="https://genius.rebookedsolutions.co.za/refund-policy" target="_blank" rel="noopener noreferrer" className="underline text-primary hover:text-primary/80">Refund Policy</a>.
                </p>
              </div>
            </div>

            <DialogFooter className="flex flex-col sm:flex-row gap-2">
              <Button variant="outline" onClick={() => setShowConfirmDialog(false)} className="w-full sm:w-auto">
                Cancel
              </Button>
              <Button onClick={handleUpgrade} className="w-full sm:w-auto gap-2">
                Pay Now
                <Sparkles className="w-4 h-4" />
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </motion.div>
    </AppLayout>
  );
};

export default SettingsBilling;
