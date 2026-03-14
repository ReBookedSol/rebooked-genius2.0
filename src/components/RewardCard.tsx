import { Copy, Check, ExternalLink, Lock, Gift } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';

interface RewardCardProps {
  reward: {
    id: string;
    name: string;
    description: string;
    required_points: number;
    reward_type: 'discount' | 'affiliate_link' | 'custom_benefit';
    discount_percentage?: number | null;
    discount_code?: string | null;
    affiliate_link?: string | null;
    availability_limit?: number | null;
    claimed_count?: number;
  };
  status: 'available' | 'claimed' | 'redeemed' | 'locked';
  pointsProgress?: {
    current: number;
    required: number;
  };
  redemptionCode?: string | null;
  onClaim?: () => void;
  onOpenLink?: () => void;
  loading?: boolean;
}

const RewardCard: React.FC<RewardCardProps> = ({
  reward,
  status,
  pointsProgress,
  redemptionCode,
  onClaim,
  onOpenLink,
  loading = false,
}) => {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  const handleCopyCode = async () => {
    if (!reward.discount_code) return;

    try {
      await navigator.clipboard.writeText(reward.discount_code);
      setCopied(true);
      toast({
        title: 'Copied!',
        description: 'Discount code copied to clipboard',
      });
      setTimeout(() => setCopied(false), 2000);
    } catch (_error) {
      toast({
        title: 'Error',
        description: 'Failed to copy code',
        variant: 'destructive',
      });
    }
  };

  const isLocked = status === 'locked';
  const isClaimed = status === 'claimed' || status === 'redeemed';
  const isAvailable = status === 'available';

  return (
    <Card
      className={`overflow-hidden transition-all ${
        isLocked
          ? 'opacity-60 grayscale'
          : 'hover:shadow-lg hover:border-primary/30'
      }`}
    >
      <CardContent className="p-4 space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-semibold text-foreground">{reward.name}</h3>
              {isClaimed && (
                <Badge variant="default" className="text-xs">
                  Claimed
                </Badge>
              )}
              {isAvailable && (
                <Badge variant="secondary" className="text-xs bg-green-500/20 text-green-700 dark:text-green-300">
                  Available
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground line-clamp-2">
              {reward.description}
            </p>
          </div>
          <div className="flex-shrink-0">
            {isLocked ? (
              <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                <Lock className="w-5 h-5 text-muted-foreground" />
              </div>
            ) : (
              <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
                <Gift className="w-5 h-5 text-primary" />
              </div>
            )}
          </div>
        </div>

        {/* Points Required */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Points Required</span>
            {pointsProgress && (
              <span className="font-medium">
                {pointsProgress.current} / {pointsProgress.required}
              </span>
            )}
          </div>
          {pointsProgress && (
            <div className="w-full h-2 bg-secondary rounded-full overflow-hidden">
              <div
                className="h-full bg-primary transition-all duration-300"
                style={{
                  width: `${Math.min(
                    (pointsProgress.current / pointsProgress.required) * 100,
                    100
                  )}%`,
                }}
              />
            </div>
          )}
        </div>

        {/* Reward Details */}
        {reward.reward_type === 'discount' && (
          <div className="bg-accent-yellow/10 rounded-lg p-3 space-y-2">
            {reward.discount_percentage && (
              <p className="text-sm font-semibold text-accent-yellow-foreground">
                {reward.discount_percentage}% Off
              </p>
            )}
            {reward.discount_code && (
              <div className="flex items-center gap-2 bg-background rounded p-2">
                <code className="text-xs font-mono font-bold flex-1 truncate">
                  {reward.discount_code}
                </code>
                {!isLocked && (
                  <button
                    onClick={handleCopyCode}
                    className="p-1 hover:bg-secondary rounded transition-colors"
                    title="Copy code"
                  >
                    {copied ? (
                      <Check className="w-4 h-4 text-green-500" />
                    ) : (
                      <Copy className="w-4 h-4 text-muted-foreground" />
                    )}
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* Affiliate/Redemption Info */}
        {isClaimed && redemptionCode && (
          <div className="bg-secondary/50 rounded-lg p-2">
            <p className="text-xs text-muted-foreground mb-1">Your redemption code:</p>
            <div className="flex items-center gap-2 bg-background rounded p-2">
              <code className="text-xs font-mono font-bold flex-1 truncate">
                {redemptionCode}
              </code>
              <button
                onClick={() => handleCopyCode()}
                className="p-1 hover:bg-secondary rounded transition-colors"
                title="Copy redemption code"
              >
                <Copy className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>
          </div>
        )}

        {/* Availability Limit Info */}
        {reward.availability_limit && reward.claimed_count !== undefined && (
          <div className="text-xs text-muted-foreground">
            {reward.claimed_count} / {reward.availability_limit} claimed
          </div>
        )}

        {/* Action Buttons */}
        {isLocked ? (
          <Button disabled variant="outline" className="w-full text-sm">
            <Lock className="w-4 h-4 mr-1" />
            {pointsProgress
              ? `${pointsProgress.required - pointsProgress.current} more points`
              : 'Locked'}
          </Button>
        ) : isAvailable ? (
          <div className="space-y-2">
            {reward.reward_type === 'discount' && reward.discount_code && (
              <Button
                onClick={handleCopyCode}
                variant="default"
                size="sm"
                className="w-full"
                disabled={loading}
              >
                <Copy className="w-4 h-4 mr-1" />
                Copy Code
              </Button>
            )}
            {reward.reward_type === 'affiliate_link' && reward.affiliate_link && (
              <Button
                onClick={onOpenLink}
                variant="default"
                size="sm"
                className="w-full"
                disabled={loading}
              >
                <ExternalLink className="w-4 h-4 mr-1" />
                Open Link
              </Button>
            )}
            {onClaim && (
              <Button
                onClick={onClaim}
                variant="secondary"
                size="sm"
                className="w-full"
                disabled={loading}
              >
                {loading ? 'Claiming...' : 'Claim Reward'}
              </Button>
            )}
          </div>
        ) : isClaimed ? (
          <div className="text-center py-2">
            <p className="text-xs text-muted-foreground">Already claimed</p>
            {reward.reward_type === 'discount' && reward.discount_code && (
              <Button
                onClick={handleCopyCode}
                variant="ghost"
                size="sm"
                className="w-full mt-2"
              >
                <Copy className="w-4 h-4 mr-1" />
                Copy Code
              </Button>
            )}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
};

export default RewardCard;
