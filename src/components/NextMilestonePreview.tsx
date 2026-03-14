import { motion } from 'framer-motion';
import { Trophy, ArrowRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';

interface NextMilestonePreviewProps {
  totalPoints: number;
  nextMilestone?: {
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
    } | null;
    pointsNeeded: number;
  } | null;
  loading?: boolean;
  _loading?: boolean;
}

const NextMilestonePreview: React.FC<NextMilestonePreviewProps> = ({
  totalPoints,
  nextMilestone,
  _loading = false,
}) => {
  if (!nextMilestone || !nextMilestone.reward) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <Card className="border-primary/30 bg-primary/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="w-5 h-5 text-primary" />
              Milestone Progress
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8">
              <h3 className="text-lg font-semibold text-foreground mb-2">
                You've reached the end!
              </h3>
              <p className="text-muted-foreground">
                You've unlocked all available rewards. Congratulations!
              </p>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    );
  }

  const progressPercentage =
    ((nextMilestone.reward.required_points - nextMilestone.pointsNeeded) /
      nextMilestone.reward.required_points) *
    100;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-accent/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-primary" />
            Next Milestone at {nextMilestone.reward.required_points} Points
          </CardTitle>
          <p className="text-sm text-muted-foreground mt-2">
            {nextMilestone.pointsNeeded} more points to unlock the next reward
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Progress Section */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Progress</span>
              <span className="font-semibold text-primary">
                {Math.round(progressPercentage)}%
              </span>
            </div>
            <Progress value={progressPercentage} className="h-3" />
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{totalPoints} / {nextMilestone.reward.required_points} points</span>
              <span>{nextMilestone.pointsNeeded} remaining</span>
            </div>
          </div>

          {/* Next Reward Preview */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <span>Your next reward</span>
              <ArrowRight className="w-4 h-4 text-primary" />
            </div>
            <div className="bg-background rounded-lg p-3 space-y-2">
              <h4 className="font-semibold text-foreground">
                {nextMilestone.reward.name}
              </h4>
              <p className="text-sm text-muted-foreground line-clamp-2">
                {nextMilestone.reward.description}
              </p>
              {nextMilestone.reward.reward_type === 'discount' &&
                nextMilestone.reward.discount_percentage && (
                  <div className="inline-flex items-center gap-2 bg-accent-yellow/20 text-accent-yellow-foreground px-2 py-1 rounded text-xs font-semibold">
                    {nextMilestone.reward.discount_percentage}% Off
                  </div>
                )}
            </div>
          </div>

          {/* Animated Incentive */}
          <motion.div
            animate={{ scale: [1, 1.02, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="bg-primary/10 rounded-lg p-4 text-center border border-primary/20"
          >
            <p className="text-sm font-semibold text-primary">
              Keep going! You're almost there 🎯
            </p>
          </motion.div>
        </CardContent>
      </Card>
    </motion.div>
  );
};

export default NextMilestonePreview;
