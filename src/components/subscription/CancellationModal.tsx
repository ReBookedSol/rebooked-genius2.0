import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  AlertCircle, 
  ChevronRight, 
  ChevronLeft, 
  X, 
  Frown, 
  Sparkles, 
  ShieldAlert,
  Loader2,
  CheckCircle2,
  HelpCircle,
  CloudOff
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface CancellationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tier: string;
  onCancelled: () => void;
}

const CANCELLATION_REASONS = [
  { id: 'expensive', label: "It's too expensive" },
  { id: 'not_using_enough', label: "I don't use it enough" },
  { id: 'missing_features', label: "It's missing features I need" },
  { id: 'technical_issues', label: "Too many technical issues" },
  { id: 'finished_study', label: "I've finished my exams/study" },
  { id: 'other', label: "Other reason" },
];

export const CancellationModal = ({ open, onOpenChange, tier, onCancelled }: CancellationModalProps) => {
  const [step, setStep] = useState(1);
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const handleNext = () => setStep(step + 1);
  const handleBack = () => setStep(step - 1);

  const handleFinalCancel = async () => {
    setIsSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke('paystack-cancel', {
        body: { reason }
      });
      if (error) throw error;
      
      toast({ 
        title: 'Subscription Cancelled', 
        description: 'Your subscription will remain active until the end of your billing period.' 
      });
      onCancelled();
      onOpenChange(false);
    } catch (error) {
      console.error('Cancel error:', error);
      toast({ 
        title: 'Failed to cancel', 
        description: 'Could not cancel subscription. Please contact support.', 
        variant: 'destructive' 
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const steps = [
    {
      title: "Wait! Before you go...",
      description: "If you cancel your Pro subscription, you'll lose access to these premium features:",
      content: (
        <div className="space-y-4 py-4">
          <div className="bg-destructive/10 p-4 rounded-xl space-y-3">
            <div className="flex items-start gap-3 text-sm">
              <CloudOff className="w-5 h-5 text-destructive mt-0.5 shrink-0" />
              <div>
                <p className="font-bold text-destructive">Unlimited AI Tokens</p>
                <p className="text-muted-foreground text-xs">You'll be limited to 5,000 tokens per day.</p>
              </div>
            </div>
            <div className="flex items-start gap-3 text-sm">
              <ShieldAlert className="w-5 h-5 text-destructive mt-0.5 shrink-0" />
              <div>
                <p className="font-bold text-destructive">Advanced AI Models</p>
                <p className="text-muted-foreground text-xs">You'll lose access to our most capable Gemini 3.1 Pro powered tutor.</p>
              </div>
            </div>
            {tier === 'tier2' && (
              <div className="flex items-start gap-3 text-sm">
                <AlertCircle className="w-5 h-5 text-destructive mt-0.5 shrink-0" />
                <div>
                  <p className="font-bold text-destructive">NBT Preparation</p>
                  <p className="text-muted-foreground text-xs">Full access to NBT practice and materials will be revoked.</p>
                </div>
              </div>
            )}
          </div>
          <p className="text-xs text-muted-foreground text-center italic">
            You'll retain access until the end of your current billing cycle.
          </p>
        </div>
      ),
      footer: (
        <div className="flex gap-3 w-full">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
            Keep My Plan
          </Button>
          <Button onClick={handleNext} className="flex-1">
            Continue to Cancel
            <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        </div>
      )
    },
    {
      title: "Why are you leaving?",
      description: "Your feedback helps us improve ReBooked Genius for everyone.",
      content: (
        <div className="py-4">
          <RadioGroup value={reason} onValueChange={setReason} className="space-y-3">
            {CANCELLATION_REASONS.map((r) => (
              <div key={r.id} className="flex items-center space-x-3 p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors">
                <RadioGroupItem value={r.id} id={r.id} />
                <Label htmlFor={r.id} className="flex-1 cursor-pointer font-medium">{r.label}</Label>
              </div>
            ))}
          </RadioGroup>
        </div>
      ),
      footer: (
        <div className="flex gap-3 w-full">
          <Button variant="ghost" onClick={handleBack}>
            <ChevronLeft className="w-4 h-4 mr-1" />
            Back
          </Button>
          <Button onClick={handleNext} disabled={!reason} className="flex-1">
            Next
            <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        </div>
      )
    },
    {
      title: "Final Confirmation",
      description: "Are you absolutely sure you want to cancel?",
      content: (
        <div className="space-y-6 py-6 text-center">
          <div className="w-20 h-20 bg-destructive/10 rounded-full flex items-center justify-center mx-auto">
            <Frown className="w-10 h-10 text-destructive" />
          </div>
          <div className="space-y-2">
            <p className="text-foreground font-medium">We'll miss you, but we understand.</p>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Upon cancellation, your subscription will not renew. You can always come back and upgrade again at any time!
            </p>
          </div>
          <div className="bg-muted p-4 rounded-lg text-left">
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Reminder</h4>
            <ul className="space-y-2 text-xs text-muted-foreground">
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-primary mt-0.5" />
                Access continues until end of billing cycle
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-primary mt-0.5" />
                All study data and documents are preserved
              </li>
            </ul>
          </div>
        </div>
      ),
      footer: (
        <div className="flex flex-col gap-3 w-full">
          <Button 
            variant="destructive" 
            onClick={handleFinalCancel} 
            disabled={isSubmitting}
            className="w-full h-12 font-bold"
          >
            {isSubmitting ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Processing...</>
            ) : "Confirm Cancellation"}
          </Button>
          <Button variant="ghost" onClick={() => onOpenChange(false)} className="w-full">
            Actually, I'll Stay
          </Button>
        </div>
      )
    }
  ];

  const currentStep = steps[step - 1];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[450px] overflow-hidden">
        <DialogHeader>
          <div className="flex items-center justify-between mb-2">
            <Badge variant="outline" className="text-[10px] uppercase tracking-widest font-bold px-2 py-0.5">
              Step {step} of {steps.length}
            </Badge>
            <div className="flex gap-1 h-1 w-24 bg-muted rounded-full overflow-hidden">
              <div 
                className="bg-primary h-full transition-all duration-500" 
                style={{ width: `${(step / steps.length) * 100}%` }}
              />
            </div>
          </div>
          <DialogTitle className="text-2xl font-black">{currentStep.title}</DialogTitle>
          <DialogDescription>{currentStep.description}</DialogDescription>
        </DialogHeader>

        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
          >
            {currentStep.content}
          </motion.div>
        </AnimatePresence>

        <div className="mt-4">
          {currentStep.footer}
        </div>
      </DialogContent>
    </Dialog>
  );
};
