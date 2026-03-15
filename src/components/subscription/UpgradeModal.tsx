import { useState } from 'react';
import { motion } from 'framer-motion';
import { Check, Crown, Sparkles, Loader2, X, Ticket } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

interface UpgradeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentTier?: 'free' | 'tier1' | 'tier2';
  highlightedFeature?: string;
}

const PLANS = [
  {
    id: 'free',
    name: 'Free',
    price: 'R0',
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
      'No YouTube lessons',
      'No exams',
      'No achievement rewards',
    ],
  },
  {
    id: 'tier1',
    name: 'Pro',
    price: 'R99',
    priceMonthly: 99,
    priceAnnual: 79,
    description: 'Unlock unlimited learning',
    popular: true,
    features: [
      'Unlimited AI messages',
      'Unlimited study documents',
      'Unlimited pages per document',
      'Unlimited quizzes',
      'Unlimited flashcards',
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
    price: 'R149',
    priceMonthly: 149,
    priceAnnual: 119,
    description: 'Everything + NBT preparation',
    features: [
      'Everything in Pro',
      'Full NBT section access',
      'NBT practice tests',
      'NBT study materials',
      'NBT progress tracking',
    ],
    limitations: [],
  },
];

export function UpgradeModal({ open, onOpenChange, currentTier = 'free', highlightedFeature }: UpgradeModalProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState<string | null>(null);
  const [paymentType, setPaymentType] = useState<'monthly' | 'annual'>('monthly');
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<typeof PLANS[0] | null>(null);
  const [couponCode, setCouponCode] = useState('');
  const [applyingCode, setApplyingCode] = useState(false);

  const getDisplayPrice = (plan: typeof PLANS[0]) => {
    if (paymentType === 'annual' && plan.priceAnnual) {
      return plan.priceAnnual;
    }
    return plan.priceMonthly;
  };

  const getTotalPrice = (plan: typeof PLANS[0]) => {
    if (paymentType === 'annual' && plan.priceAnnual) {
      return plan.priceAnnual * 12;
    }
    return plan.priceMonthly;
  };

  const handleUpgradeClick = (planId: string) => {
    if (!user) {
      toast({ title: 'Please sign in', description: 'You need to be signed in to upgrade', variant: 'destructive' });
      return;
    }
    if (planId === 'free') return;
    const plan = PLANS.find(p => p.id === planId);
    if (plan) {
      setSelectedPlan(plan);
      setShowConfirmDialog(true);
    }
  };

  const handleConfirmUpgrade = async () => {
    if (!user || !selectedPlan) return;

    setLoading(selectedPlan.id);
    setShowConfirmDialog(false);

    try {
      // Monthly uses plan-based subscription, annual uses one-time payment
      const edgeFunction = paymentType === 'annual' ? 'paystack-annual' : 'paystack-initialize';

      const { data, error } = await supabase.functions.invoke(edgeFunction, {
        body: { tier: selectedPlan.id },
      });

      if (error) throw new Error(error.message || 'Failed to initialize payment');
      if (!data?.authorization_url) throw new Error('No authorization URL received');

      sessionStorage.setItem('pendingTier', selectedPlan.id);
      sessionStorage.setItem('pendingPaymentType', paymentType);

      window.location.href = data.authorization_url;
    } catch (error) {
      console.error('Payment initialization error:', error);
      toast({
        title: 'Payment failed',
        description: error instanceof Error ? error.message : 'Could not initialize payment. Please try again.',
        variant: 'destructive',
      });
      setLoading(null);
    }
  };

  return (
    <>
      <Dialog open={open && !showConfirmDialog} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl flex items-center gap-2">
              <Crown className="w-6 h-6 text-primary" />
              Upgrade Your Plan
            </DialogTitle>
          </DialogHeader>

          <Tabs value={paymentType} onValueChange={(v) => setPaymentType(v as 'monthly' | 'annual')} className="w-full mt-2">
            <TabsList className="grid w-full grid-cols-2 max-w-xs mx-auto">
              <TabsTrigger value="monthly">Monthly</TabsTrigger>
              <TabsTrigger value="annual">Annual (Save 20%)</TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="grid md:grid-cols-3 gap-4 mt-4">
            {PLANS.map((plan, index) => {
              const isCurrent = plan.id === currentTier;
              const isUpgrade = PLANS.findIndex(p => p.id === currentTier) < index;
              const price = getDisplayPrice(plan);

              return (
                <motion.div
                  key={plan.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                >
                  <Card
                    className={`relative h-full ${
                      plan.popular
                        ? 'ring-2 ring-primary shadow-lg'
                        : isCurrent
                          ? 'ring-2 ring-muted-foreground/30'
                          : ''
                    }`}
                  >
                    {plan.popular && (
                      <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary">
                        <Sparkles className="w-3 h-3 mr-1" />
                        Most Popular
                      </Badge>
                    )}

                    <CardHeader className="pb-3">
                      <CardTitle className="flex items-center justify-between">
                        <span>{plan.name}</span>
                        {isCurrent && (
                          <Badge variant="outline" className="text-xs">Current</Badge>
                        )}
                      </CardTitle>
                      <div className="mt-2">
                        <span className="text-3xl font-bold">R{price}</span>
                        {plan.priceMonthly > 0 && (
                          <span className="text-muted-foreground">
                            /{paymentType === 'annual' ? 'mo, billed annually' : 'month'}
                          </span>
                        )}
                      </div>
                      {paymentType === 'annual' && plan.priceAnnual && (
                        <div className="flex flex-col gap-1 mt-1">
                          <Badge variant="secondary" className="text-xs w-fit">
                            Save {Math.round(((plan.priceMonthly - plan.priceAnnual) / plan.priceMonthly) * 100)}%
                          </Badge>
                        </div>
                      )}
                      <p className="text-sm text-muted-foreground">{plan.description}</p>
                    </CardHeader>

                    <CardContent className="space-y-4">
                      <ul className="space-y-2">
                        {plan.features.map((feature) => (
                          <li key={feature} className="flex items-start gap-2 text-sm">
                            <Check className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                            <span className={highlightedFeature && feature.toLowerCase().includes(highlightedFeature.toLowerCase()) ? 'text-primary font-medium' : ''}>
                              {feature}
                            </span>
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
                        disabled={isCurrent || loading !== null}
                        onClick={() => handleUpgradeClick(plan.id)}
                      >
                        {loading === plan.id ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Processing...
                          </>
                        ) : isCurrent ? (
                          'Current Plan'
                        ) : isUpgrade ? (
                          <>
                            <Crown className="w-4 h-4 mr-2" />
                            Upgrade
                          </>
                        ) : (
                          'Downgrade'
                        )}
                      </Button>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </div>

          <p className="text-xs text-muted-foreground text-center mt-4">
            Payments are processed securely through Paystack. Cancel anytime.
          </p>
        </DialogContent>
      </Dialog>

      {/* Confirmation Dialog */}
      <Dialog open={showConfirmDialog} onOpenChange={(open) => {
        setShowConfirmDialog(open);
        if (!open) setLoading(null);
      }}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Crown className="w-5 h-5 text-primary" />
              Confirm Your Upgrade
            </DialogTitle>
            <DialogDescription>
              You're about to upgrade to the <span className="font-bold text-foreground">{selectedPlan?.name}</span> plan.
            </DialogDescription>
          </DialogHeader>

          <div className="py-6 space-y-6">
            <div className="bg-muted/50 p-4 rounded-xl space-y-3">
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">Selected Plan:</span>
                <span className="font-semibold">{selectedPlan?.name}</span>
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
                  R{selectedPlan ? getTotalPrice(selectedPlan) : 0}
                </span>
              </div>
              <p className="text-[10px] text-muted-foreground italic text-center">
                {paymentType === 'annual'
                  ? 'One-time payment for 12 months of access.'
                  : 'Billed monthly via Paystack subscription. Cancel anytime.'}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="upgrade-coupon" className="text-xs font-medium uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Ticket className="w-3 h-3" />
                Have a code?
              </Label>
              <div className="flex gap-2">
                <Input
                  id="upgrade-coupon"
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
                By clicking "Pay Now", you'll be redirected to Paystack to securely complete your payment. You can cancel your subscription at any time from your settings. By purchasing this, you agree to ReBooked Genius' <a href="https://genius.rebookedsolutions.co.za/terms" target="_blank" rel="noopener noreferrer" className="underline text-primary hover:text-primary/80">Terms and Conditions</a> and <a href="https://genius.rebookedsolutions.co.za/refund-policy" target="_blank" rel="noopener noreferrer" className="underline text-primary hover:text-primary/80">Refund Policy</a>.
              </p>
            </div>
          </div>

          <DialogFooter className="flex flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setShowConfirmDialog(false)} className="w-full sm:w-auto">
              Cancel
            </Button>
            <Button onClick={handleConfirmUpgrade} disabled={loading !== null} className="w-full sm:w-auto gap-2">
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  Pay Now
                  <Sparkles className="w-4 h-4" />
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
