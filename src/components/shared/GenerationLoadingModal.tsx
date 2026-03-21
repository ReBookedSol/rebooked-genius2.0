import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { Sparkles, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const quotes = [
  "Your future self will thank you for this preparation! 🌟",
  "Every question you practice now is a point gained on test day! 💪",
  "Building your knowledge base, one question at a time... 🧠",
  "Success is the sum of small efforts repeated daily! 🔥",
  "You're investing in yourself - the best investment there is! ⭐",
  "Great things take time. Your master plan is composing... 📈"
];

interface GenerationLoadingModalProps {
  isOpen: boolean;
  type?: 'flashcards' | 'quiz' | 'exam' | 'test' | 'lesson';
}

export const GenerationLoadingModal: React.FC<GenerationLoadingModalProps> = ({ isOpen, type = 'quiz' }) => {
  const [progress, setProgress] = useState(0);
  const [quoteIndex, setQuoteIndex] = useState(0);

  useEffect(() => {
    if (!isOpen) {
      setProgress(0);
      return;
    }

    // Dynamic progress bar: starts fast, slows down, caps at 90-95%
    const progressInterval = setInterval(() => {
      setProgress(prev => {
        if (prev < 50) return prev + Math.random() * 8 + 2;         // Fast up to 50%
        if (prev < 80) return prev + Math.random() * 4 + 1;         // Medium up to 80%
        if (prev < 90) return prev + Math.random() * 2 + 0.5;       // Slow up to 90%
        if (prev < 95) return prev + Math.random() * 0.5 + 0.1;     // Very slow up to 95%
        return Math.min(prev + 0.1, 95);                            // Cap at 95%
      });
    }, 600);

    return () => clearInterval(progressInterval);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    
    // Cycle quotes every 4 seconds
    const quoteInterval = setInterval(() => {
      setQuoteIndex(prev => (prev + 1) % quotes.length);
    }, 4000);

    return () => clearInterval(quoteInterval);
  }, [isOpen]);

  // Derive label
  const getLabel = () => {
    switch (type) {
      case 'flashcards': return 'Generating Flashcards...';
      case 'exam': return 'Generating Mock Exam...';
      case 'test': return 'Generating Test...';
      case 'lesson': return 'Generating Lesson...';
      case 'quiz':
      default: return 'Generating Quiz...';
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-md p-8 border-none shadow-2xl bg-background overflow-hidden" hideCloseButton>
        <div className="flex flex-col items-center justify-center text-center space-y-6">
          <div className="relative w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-2">
            <Loader2 className="w-10 h-10 text-primary animate-spin" />
            <Sparkles className="absolute -top-1 -right-1 h-6 w-6 text-yellow-500 animate-pulse" />
          </div>
          
          <div className="space-y-2 w-full">
            <h2 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-primary/60">
              {getLabel()}
            </h2>
            
            <div className="h-16 flex items-center justify-center">
              <AnimatePresence mode="wait">
                <motion.p
                  key={quoteIndex}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.3 }}
                  className="text-muted-foreground text-sm italic px-2"
                >
                  "{quotes[quoteIndex]}"
                </motion.p>
              </AnimatePresence>
            </div>
          </div>

          <div className="w-full space-y-2">
            <Progress value={progress} className="h-2 w-full" />
            <div className="flex justify-between items-center text-xs text-muted-foreground">
              <span>Applying AI Context...</span>
              <span>{Math.round(progress)}%</span>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default GenerationLoadingModal;
