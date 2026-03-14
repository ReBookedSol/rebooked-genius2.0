import { useState } from 'react';
import { Lock, Crown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { UpgradeModal } from './UpgradeModal';
import { useSubscription, SubscriptionTier } from '@/hooks/useSubscription';

interface FeatureLockProps {
  feature: string;
  requiredTier: SubscriptionTier;
  children: React.ReactNode;
  showOverlay?: boolean;
}

const tierNames: Record<SubscriptionTier, string> = {
  free: 'Free',
  tier1: 'Pro',
  tier2: 'Premium',
};

export function FeatureLock({ feature, requiredTier, children, showOverlay = true }: FeatureLockProps) {
  const { tier } = useSubscription();
  const [showUpgrade, setShowUpgrade] = useState(false);

  const tierOrder: SubscriptionTier[] = ['free', 'tier1', 'tier2'];
  const currentTierIndex = tierOrder.indexOf(tier);
  const requiredTierIndex = tierOrder.indexOf(requiredTier);
  const isLocked = currentTierIndex < requiredTierIndex;

  if (!isLocked) {
    return <>{children}</>;
  }

  if (!showOverlay) {
    return (
      <>
        <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-3">
          <Lock className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="font-semibold text-amber-900 text-sm">{feature} - Premium Feature</h3>
            <p className="text-xs text-amber-800 mt-1">
              Upgrade to {tierNames[requiredTier]} to unlock this feature
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowUpgrade(true)}
            className="flex-shrink-0"
          >
            Upgrade to {tierNames[requiredTier]}
          </Button>
        </div>
        {children}
        <UpgradeModal
          open={showUpgrade}
          onOpenChange={setShowUpgrade}
          currentTier={tier}
          highlightedFeature={feature}
        />
      </>
    );
  }

  return (
    <>
      <div className="relative">
        <div className="pointer-events-none opacity-50 blur-[2px]">
          {children}
        </div>
        <div className="absolute inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm rounded-lg">
          <div className="text-center p-6">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
              <Lock className="w-6 h-6 text-primary" />
            </div>
            <h3 className="font-semibold text-lg mb-2">{feature}</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Upgrade to {tierNames[requiredTier]} to unlock this feature
            </p>
            <Button onClick={() => setShowUpgrade(true)} className="gap-2">
              <Crown className="w-4 h-4" />
              Upgrade to {tierNames[requiredTier]}
            </Button>
          </div>
        </div>
      </div>
      
      <UpgradeModal
        open={showUpgrade}
        onOpenChange={setShowUpgrade}
        currentTier={tier}
        highlightedFeature={feature}
      />
    </>
  );
}

export function UpgradeButton({ feature, requiredTier, className }: { feature: string; requiredTier: SubscriptionTier; className?: string }) {
  const { tier } = useSubscription();
  const [showUpgrade, setShowUpgrade] = useState(false);

  const tierOrder: SubscriptionTier[] = ['free', 'tier1', 'tier2'];
  const currentTierIndex = tierOrder.indexOf(tier);
  const requiredTierIndex = tierOrder.indexOf(requiredTier);
  const isLocked = currentTierIndex < requiredTierIndex;

  if (!isLocked) return null;

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setShowUpgrade(true)} className={className}>
        <Lock className="w-3 h-3 mr-1" />
        Upgrade to unlock
      </Button>
      
      <UpgradeModal
        open={showUpgrade}
        onOpenChange={setShowUpgrade}
        currentTier={tier}
        highlightedFeature={feature}
      />
    </>
  );
}
