import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, Crown, Sparkles, ChevronRight, ChevronLeft, PartyPopper } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import confetti from 'canvas-confetti';

interface UpgradeSuccessModalProps {
  isOpen: boolean;
  onClose: () => void;
  tier?: string | null;
}

const UpgradeSuccessModal: React.FC<UpgradeSuccessModalProps> = ({ 
  isOpen, 
  onClose, 
  tier = 'Premium' 
}) => {
  const [stage, setStage] = useState(1);
  const totalStages = 3;

  const triggerConfetti = () => {
    const duration = 3 * 1000;
    const animationEnd = Date.now() + duration;
    const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 9999 };

    const randomInRange = (min: number, max: number) => Math.random() * (max - min) + min;

    const interval: any = setInterval(function() {
      const timeLeft = animationEnd - Date.now();

      if (timeLeft <= 0) {
        return clearInterval(interval);
      }

      const particleCount = 50 * (timeLeft / duration);
      confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 } });
      confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 } });
    }, 250);
  };

  useEffect(() => {
    if (isOpen && stage === 1) {
      triggerConfetti();
    }
  }, [isOpen]);

  const nextStage = () => {
    if (stage < totalStages) {
      setStage(stage + 1);
      if (stage + 1 === totalStages) {
          triggerConfetti();
      }
    } else {
      onClose();
    }
  };

  const prevStage = () => {
    if (stage > 1) {
      setStage(stage - 1);
    }
  };

  const getTierDisplayName = () => {
    if (tier === 'tier1') return 'Pro';
    if (tier === 'tier2') return 'Premium';
    return tier || 'Premium';
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md p-0 border-none shadow-2xl bg-background overflow-hidden rounded-3xl" hideCloseButton>
        {/* Progress Bar */}
        <div className="absolute top-0 left-0 w-full h-1.5 bg-secondary flex z-50">
           <motion.div 
            className="h-full bg-primary" 
            initial={{ width: 0 }}
            animate={{ width: `${(stage / totalStages) * 100}%` }}
            transition={{ duration: 0.3 }}
           />
        </div>
        
        <div className="p-8 pt-10">
          <AnimatePresence mode="wait">
            <motion.div
              key={stage}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
              className="flex flex-col items-center justify-center text-center"
            >
              {stage === 1 && (
                <div className="space-y-6">
                  <div className="w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center mx-auto relative mb-4">
                    <Crown className="h-12 w-12 text-primary" />
                    <motion.div
                      animate={{ 
                        scale: [1, 1.2, 1],
                        rotate: [0, 10, -10, 0]
                      }}
                      transition={{ 
                        duration: 2,
                        repeat: Infinity,
                        ease: "easeInOut"
                      }}
                      className="absolute -top-1 -right-1"
                    >
                      <Sparkles className="h-8 w-8 text-yellow-500" />
                    </motion.div>
                  </div>
                  <div className="space-y-3">
                    <h2 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-primary/60">
                      Welcome to {getTierDisplayName()}!
                    </h2>
                    <p className="text-muted-foreground text-base max-w-[300px] mx-auto leading-relaxed">
                      Your journey to academic excellence just got a major boost. Your account has been successfully upgraded!
                    </p>
                  </div>
                </div>
              )}

              {stage === 2 && (
                <div className="space-y-6 w-full">
                  <div className="flex items-center justify-center gap-3 mb-2">
                    <PartyPopper className="h-6 w-6 text-primary" />
                    <h2 className="text-2xl font-bold">New Superpowers</h2>
                  </div>
                  
                  <div className="space-y-4 text-left bg-secondary/30 p-5 rounded-2xl border border-secondary/50 backdrop-blur-sm">
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.1 }}
                      className="flex items-start gap-4"
                    >
                      <div className="mt-1 bg-green-500/20 p-1 rounded-full">
                        <CheckCircle className="h-4 w-4 text-green-500" />
                      </div>
                      <div>
                        <h4 className="font-semibold text-sm">Unlimited AI Generation</h4>
                        <p className="text-xs text-muted-foreground">Endless quizzes, flashcards & study guides</p>
                      </div>
                    </motion.div>
                    
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.2 }}
                      className="flex items-start gap-4"
                    >
                       <div className="mt-1 bg-green-500/20 p-1 rounded-full">
                        <CheckCircle className="h-4 w-4 text-green-500" />
                      </div>
                      <div>
                        <h4 className="font-semibold text-sm">NBT Mock Exams</h4>
                        <p className="text-xs text-muted-foreground">Unlimited practice for NBT benchmarking</p>
                      </div>
                    </motion.div>
                    
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.3 }}
                      className="flex items-start gap-4"
                    >
                       <div className="mt-1 bg-green-500/20 p-1 rounded-full">
                        <CheckCircle className="h-4 w-4 text-green-500" />
                      </div>
                      <div>
                        <h4 className="font-semibold text-sm">Advanced Analytics</h4>
                        <p className="text-xs text-muted-foreground">Detailed mastery tracking across subjects</p>
                      </div>
                    </motion.div>
                  </div>
                </div>
              )}

              {stage === 3 && (
                <div className="space-y-6 w-full">
                  <motion.div 
                    initial={{ scale: 0.5, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="w-24 h-24 rounded-full bg-primary flex items-center justify-center mx-auto mb-4 shadow-xl shadow-primary/30"
                  >
                    <Sparkles className="h-12 w-12 text-primary-foreground" />
                  </motion.div>
                  <div className="space-y-3">
                    <h2 className="text-3xl font-bold text-foreground">Ready to Ace It?</h2>
                    <p className="text-muted-foreground text-base max-w-[300px] mx-auto leading-relaxed">
                      You now have every tool needed to succeed. Let's start crushing those goals!
                    </p>
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>

          <div className="flex gap-3 mt-10">
            {stage > 1 && (
              <Button 
                variant="outline" 
                onClick={prevStage} 
                className="flex-1 h-12 rounded-xl border-2 hover:bg-secondary transition-all"
              >
                <ChevronLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
            )}
            <Button 
              onClick={nextStage} 
              className={`h-12 rounded-xl shadow-lg transition-all ${stage === 1 ? 'w-full' : 'flex-1'} ${stage === totalStages ? 'bg-gradient-to-r from-primary to-primary/80 hover:scale-[1.02]' : ''}`}
            >
              {stage === totalStages ? 'Let\'s Go!' : 'See more'}
              {stage < totalStages && <ChevronRight className="w-4 h-4 ml-2" />}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default UpgradeSuccessModal;
