import { motion, AnimatePresence } from 'framer-motion';
import { X, Sparkles, Zap, Shield, Rocket, ArrowRight, Clock, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';

interface TrialExpiryModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const TrialExpiryModal = ({ isOpen, onClose }: TrialExpiryModalProps) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-background/80 backdrop-blur-md"
          />
          
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="relative w-full max-w-md bg-card border border-emerald-500/20 shadow-2xl rounded-[2rem] overflow-hidden"
          >
            {/* Top Banner */}
            <div className="bg-emerald-600 p-1.5 flex justify-center items-center gap-2 text-[9px] uppercase font-black text-white tracking-[0.2em]">
              <Clock className="w-3 h-3" />
              Trial Period Expired
            </div>

            <div className="p-6 sm:p-8">
              <button 
                onClick={onClose}
                className="absolute top-8 right-6 text-muted-foreground hover:text-foreground transition-colors p-2 hover:bg-secondary rounded-full"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex flex-col items-center text-center space-y-6 pt-2">
                <div className="w-16 h-16 sm:w-20 sm:h-20 bg-emerald-500/10 rounded-2xl flex items-center justify-center relative">
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                    className="absolute inset-0 border-2 border-dashed border-emerald-500/30 rounded-2xl"
                  />
                  <Zap className="w-8 h-8 sm:w-10 sm:h-10 text-emerald-600 fill-emerald-600" />
                  <div className="absolute -top-1 -right-1 bg-red-500 text-white p-1 rounded-full shadow-lg">
                    <AlertTriangle className="w-3 h-3" />
                  </div>
                </div>

                <div className="space-y-2">
                  <h2 className="text-2xl sm:text-3xl font-display font-black text-foreground leading-tight italic uppercase italic">
                    Trial Over
                  </h2>
                  <p className="text-sm text-muted-foreground max-w-[280px] mx-auto">
                    Your 7-day early access has expired. Upgrade to keep your academic edge and unlock full AI power.
                  </p>
                </div>

                {/* Feature Comparison / Highlights */}
                <div className="w-full space-y-2 pt-2">
                  <div className="flex items-center gap-3 p-3 bg-emerald-500/5 rounded-2xl border border-emerald-500/10 text-left">
                    <Sparkles className="w-5 h-5 text-emerald-500 shrink-0" />
                    <div className="text-sm">
                      <p className="font-bold text-foreground">Unlimited AI Tutor 2.0</p>
                      <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">No message caps</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 bg-emerald-500/5 rounded-2xl border border-emerald-500/10 text-left">
                    <Rocket className="w-5 h-5 text-emerald-500 shrink-0" />
                    <div className="text-sm">
                      <p className="font-bold text-foreground">Priority Generation</p>
                      <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">5x Faster results</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 bg-emerald-500/5 rounded-2xl border border-emerald-500/10 text-left">
                    <Shield className="w-5 h-5 text-emerald-500 shrink-0" />
                    <div className="text-sm">
                      <p className="font-bold text-foreground">Exclusive NBT Tools</p>
                      <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Full exam patterns</p>
                    </div>
                  </div>
                </div>

                <div className="w-full flex flex-col gap-2 pt-4">
                  <Button asChild size="lg" className="h-14 text-base font-black italic uppercase tracking-wider bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl shadow-xl shadow-emerald-500/20">
                    <Link to="/settings/billing">
                      Upgrade Now
                      <ArrowRight className="w-5 h-5 ml-2" />
                    </Link>
                  </Button>
                  <Button variant="ghost" onClick={onClose} className="text-xs font-bold text-muted-foreground hover:text-foreground uppercase tracking-widest">
                    Maybe Later (Limited Mode)
                  </Button>
                </div>

                <p className="text-[9px] uppercase font-bold text-muted-foreground/60 tracking-tighter">
                  Materials safe • Features restricted
                </p>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default TrialExpiryModal;
