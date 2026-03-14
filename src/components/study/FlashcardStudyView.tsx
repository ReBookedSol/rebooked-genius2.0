import { useState, useEffect } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { ChevronLeft, ChevronRight, RotateCcw, Lightbulb, Sparkles, Check, Trophy } from 'lucide-react';
import { motion } from 'framer-motion';
import { MotionConditional } from '@/components/ui/MotionConditional';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useFlashcardMastery } from '@/hooks/useFlashcardMastery';
import { useQuizAnalytics } from '@/hooks/useQuizAnalytics';
import { useSubjectAnalytics } from '@/hooks/useSubjectAnalytics';
import { useAnimationContext } from '@/contexts/AnimationContext';
import { useAIContext } from '@/contexts/AIContext';
import { recordStudyActivity } from '@/utils/streak';

interface Flashcard {
  id: string;
  front: string;
  back: string;
  hint: string | null;
  difficulty: string;
  is_mastered: boolean;
  times_correct: number;
  times_reviewed: number;
}

interface FlashcardDeck {
  id: string;
  title: string;
  subject_id: string | null;
  total_cards: number;
  mastered_cards: number;
}

interface FlashcardStudyViewProps {
  deckId: string;
  onBack: () => void;
  conversationId?: string; // For AI chat context
}

const FlashcardStudyView: React.FC<FlashcardStudyViewProps> = ({ deckId, onBack, conversationId }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { markFlashcardMastered, markFlashcardUnmastered } = useFlashcardMastery();
  const { recordQuizAttempt } = useQuizAnalytics();
  const { updateSubjectAnalytics } = useSubjectAnalytics();
  const { animationsEnabled } = useAnimationContext();
  const { setAiContext } = useAIContext();
  const [deck, setDeck] = useState<FlashcardDeck | null>(null);
  const [flashcards, setFlashcards] = useState<Flashcard[]>([]);
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [loading, setLoading] = useState(true);
  const [masteredCount, setMasteredCount] = useState(0);
  const [isFinished, setIsFinished] = useState(false);
  const [startTime] = useState<number>(Date.now());

  // Update AI context when current card changes
  useEffect(() => {
    if (flashcards[currentCardIndex]) {
      const card = flashcards[currentCardIndex];
      setAiContext({
        currentPage: 'study',
        location: `Studying Flashcard Deck: ${deck?.title || 'Unknown'}`,
        activeFlashcard: {
          id: card.id,
          front: card.front,
          back: card.back
        }
      });
    }
  }, [currentCardIndex, flashcards, deck, setAiContext]);

  // Fetch deck and flashcards
  useEffect(() => {
    const fetchDeck = async () => {
      if (!user) return;

      try {
        setLoading(true);
        const { data: deckData, error: deckError } = await supabase
          .from('flashcard_decks')
          .select('*')
          .eq('id', deckId)
          .eq('user_id', user.id)
          .single();

        if (deckError) throw deckError;
        setDeck(deckData as FlashcardDeck);

        // Fetch flashcards
        const { data: cardsData, error: cardsError } = await (supabase as any)
          .from('flashcards')
          .select('*')
          .eq('deck_id', deckId)
          .order('created_at', { ascending: true });

        if (cardsError) throw cardsError;
        const cards = cardsData || [];
        setFlashcards(cards);
        setMasteredCount(cards.filter(c => c.is_mastered).length);
      } catch (error) {
        console.error('Error fetching deck:', error);
        toast({
          title: 'Error',
          description: 'Failed to load flashcard deck',
          variant: 'destructive',
        });
        onBack();
      } finally {
        setLoading(false);
      }
    };

    fetchDeck();
  }, [deckId, user]);

  const handleMarkMastered = async () => {
    const card = flashcards[currentCardIndex];
    if (!card) return;

    const success = await markFlashcardMastered(card.id, deckId);
    if (success) {
      const updated = [...flashcards];
      updated[currentCardIndex].is_mastered = true;
      setFlashcards(updated);
      setMasteredCount(updated.filter(c => c.is_mastered).length);

      if (currentCardIndex < flashcards.length - 1) {
        setCurrentCardIndex(currentCardIndex + 1);
        setIsFlipped(false);
      } else {
        handleFinish();
      }
    }
  };

  const handleMarkUnmastered = async () => {
    const card = flashcards[currentCardIndex];
    if (!card) return;

    const success = await markFlashcardUnmastered(card.id, deckId, 'need_more_practice');
    if (success) {
      const updated = [...flashcards];
      updated[currentCardIndex].is_mastered = false;
      setFlashcards(updated);
      setMasteredCount(updated.filter(c => c.is_mastered).length);

      if (currentCardIndex < flashcards.length - 1) {
        setCurrentCardIndex(currentCardIndex + 1);
        setIsFlipped(false);
      } else {
        handleFinish();
      }
    }
  };

  const handleFinish = async () => {
    setIsFinished(true);
    if (user && deck) {
      const timeTaken = Math.floor((Date.now() - startTime) / 1000);
      const mastered = flashcards.filter(c => c.is_mastered).length;

      await recordStudyActivity(user.id, 'flashcard_review', deck.subject_id || null);

      await recordQuizAttempt(
        null,
        deck.subject_id || undefined,
        mastered,
        flashcards.length,
        timeTaken,
        mastered,
        flashcards.length,
        undefined,
        deck.id,
        'flashcard'
      );

      // Update subject analytics with flashcard mastery results
      if (deck.subject_id) {
        await updateSubjectAnalytics(deck.subject_id, true);
      }
    }
  };

  const handleExplainWithAI = () => {
    const card = flashcards[currentCardIndex];
    if (!card) return;

    // Create automatic prompt for AI
    const userPrompt = `Using the current lesson content, explain the following question in a simple way suitable for a 12-year-old:\n\nQuestion: ${card.front}\n\nAnswer: ${card.back}`;

    // Dispatch custom event with the explanation prompt
    const event = new CustomEvent('openFlashcardExplanation', {
      detail: { 
        prompt: userPrompt,
        flashcardId: card.id 
      }
    });
    window.dispatchEvent(event);
    
    // Also try to open the sidebar chat directly
    const sidebarEvent = new CustomEvent('openAiChat', {
      detail: {
        message: userPrompt,
        autoSend: true
      }
    });
    window.dispatchEvent(sidebarEvent);
  };

  const handleNext = () => {
    if (currentCardIndex < flashcards.length - 1) {
      setCurrentCardIndex(currentCardIndex + 1);
      setIsFlipped(false);
    }
  };

  const handlePrevious = () => {
    if (currentCardIndex > 0) {
      setCurrentCardIndex(currentCardIndex - 1);
      setIsFlipped(false);
    }
  };

  if (loading) {
    return (
      <div className="p-4 md:p-8 space-y-8 max-w-4xl mx-auto min-h-full flex flex-col">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1 flex-1">
            <Skeleton className="h-8 w-24 mb-2" />
            <Skeleton className="h-10 w-3/4" />
          </div>
          <Skeleton className="w-24 h-14 rounded-xl" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-1.5 w-full rounded-full" />
        </div>
        <div className="flex-1 flex flex-col items-center justify-center py-4">
          <Skeleton className="w-full max-w-2xl h-[400px] md:h-[450px] rounded-3xl" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-end pb-8">
          <div className="md:col-span-3 flex md:flex-col gap-3">
            <Skeleton className="h-12 w-full rounded-2xl" />
            <Skeleton className="h-12 w-full rounded-2xl" />
          </div>
          <div className="md:col-span-6 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Skeleton className="h-16 rounded-2xl" />
              <Skeleton className="h-16 rounded-2xl" />
            </div>
            <Skeleton className="h-14 w-full rounded-2xl" />
          </div>
          <div className="md:col-span-3">
            <Skeleton className="h-12 w-full rounded-2xl" />
          </div>
        </div>
      </div>
    );
  }

  if (!deck || flashcards.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">No flashcards found</p>
      </div>
    );
  }

  if (isFinished) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center space-y-6">
        <Trophy className="w-20 h-20 text-yellow-500" />
        <div className="space-y-2">
          <h2 className="text-3xl font-bold">Session Complete!</h2>
          <p className="text-muted-foreground">You've reviewed all cards in this deck.</p>
        </div>
        <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-sm shadow-sm">
          <div className="flex justify-between items-center mb-4">
            <span className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Mastery</span>
            <span className="text-2xl font-bold text-primary">{masteredCount}/{flashcards.length}</span>
          </div>
          <Progress value={(masteredCount / flashcards.length) * 100} className="h-2" />
        </div>
        <div className="flex gap-4 w-full max-w-sm">
          <Button variant="outline" className="flex-1 h-12 rounded-xl" onClick={onBack}>
            Back to Decks
          </Button>
          <Button className="flex-1 h-12 rounded-xl" onClick={() => {
            setCurrentCardIndex(0);
            setIsFlipped(false);
            setIsFinished(false);
          }}>
            Study Again
          </Button>
        </div>
      </div>
    );
  }

  const currentCard = flashcards[currentCardIndex];
  const progress = ((currentCardIndex + 1) / flashcards.length) * 100;

  return (
    <ScrollArea className="h-full bg-background/50">
      <div className="p-4 md:p-8 space-y-8 max-w-4xl mx-auto min-h-full flex flex-col">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <Button variant="ghost" size="sm" onClick={onBack} className="text-muted-foreground hover:text-foreground -ml-2 h-8 px-2">
              <ChevronLeft className="w-4 h-4 mr-1" />
              All Decks
            </Button>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground tracking-tight">{deck.title}</h1>
          </div>
          <div className="flex items-center gap-3 bg-card p-2 rounded-xl border border-border/50 shadow-sm">
            <div className="text-right">
              <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider leading-none">Mastery</p>
              <p className="text-lg font-bold text-primary tabular-nums leading-none mt-1">{masteredCount}/{flashcards.length}</p>
            </div>
            <div className="w-10 h-10 rounded-full border-2 border-primary/20 flex items-center justify-center relative">
              <svg className="w-full h-full -rotate-90">
                <circle
                  cx="20"
                  cy="20"
                  r="16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                  className="text-primary/10"
                />
                <circle
                  cx="20"
                  cy="20"
                  r="16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeDasharray={100}
                  strokeDashoffset={100 - (masteredCount / flashcards.length) * 100}
                  className="text-primary transition-all duration-500"
                />
              </svg>
            </div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="flex justify-between text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            <span>Progress</span>
            <span>{currentCardIndex + 1} of {flashcards.length} Cards</span>
          </div>
          <Progress value={progress} className="h-1.5 rounded-full bg-secondary" />
        </div>

        {/* Flashcard Area */}
        <div className="flex-1 flex flex-col items-center justify-center py-4 perspective-1000">
          <div className="w-full max-w-2xl relative group h-[400px] md:h-[450px]">
            <motion.div
              key={currentCardIndex}
              initial={{ x: 300, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -300, opacity: 0 }}
              transition={{ type: "spring", stiffness: 260, damping: 20 }}
              className="w-full h-full"
            >
              <motion.div
                animate={{ rotateY: isFlipped ? 180 : 0 }}
                transition={{ duration: 0.6, type: "spring", stiffness: 260, damping: 20 }}
                className="w-full h-full preserve-3d cursor-pointer relative"
                onClick={() => setIsFlipped(!isFlipped)}
              >
                {/* Front side */}
                <div className={`absolute inset-0 backface-hidden flex flex-col rounded-3xl border-2 border-primary/20 bg-gradient-to-br from-primary/10 to-card shadow-xl transition-all ${!isFlipped ? 'shadow-primary/5 ring-1 ring-primary/10' : ''}`}>
                  <div className="p-6 md:p-8 flex-1 flex flex-col items-center justify-center text-center">
                    <div className="absolute top-6 left-6 flex items-center gap-2 text-primary/60">
                      <Lightbulb className="w-4 h-4" />
                      <span className="text-[10px] font-bold uppercase tracking-widest">Question</span>
                    </div>
                    <div className="w-full max-h-full overflow-y-auto custom-scrollbar px-4">
                      <p className="text-xl md:text-3xl font-bold text-foreground leading-relaxed">
                        {currentCard.front}
                      </p>
                    </div>
                    <div className="absolute bottom-6 w-full text-center">
                      <p className="text-[10px] font-bold text-muted-foreground/50 uppercase tracking-widest">Tap to reveal answer</p>
                    </div>
                  </div>
                </div>

                {/* Back side */}
                <div className={`absolute inset-0 backface-hidden rotate-y-180 flex flex-col rounded-3xl border-2 border-green-500/20 bg-gradient-to-br from-green-500/10 to-card shadow-xl transition-all ${isFlipped ? 'shadow-green-500/5 ring-1 ring-green-500/10' : ''}`}>
                  <div className="p-6 md:p-8 flex-1 flex flex-col items-center justify-center text-center">
                    <div className="absolute top-6 left-6 flex items-center gap-2 text-green-500/60">
                      <Check className="w-4 h-4" />
                      <span className="text-[10px] font-bold uppercase tracking-widest">Answer</span>
                    </div>
                    <div className="w-full max-h-full overflow-y-auto custom-scrollbar px-4">
                      <p className="text-xl md:text-2xl font-semibold text-foreground leading-relaxed whitespace-pre-wrap">
                        {currentCard.back}
                      </p>
                    </div>
                    {currentCard.hint && (
                      <div className="mt-6 pt-6 border-t border-border/50 w-full max-w-sm">
                        <p className="text-sm text-muted-foreground italic font-medium">💡 Hint: {currentCard.hint}</p>
                      </div>
                    )}
                    <div className="absolute bottom-6 w-full text-center">
                      <p className="text-[10px] font-bold text-muted-foreground/50 uppercase tracking-widest">Tap to see question</p>
                    </div>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          </div>
        </div>

        {/* Controls Layout */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-end pb-8">
          {/* Navigation Controls */}
          <div className="md:col-span-3 flex md:flex-col gap-3">
            <Button
              variant="outline"
              disabled={currentCardIndex === 0}
              onClick={handlePrevious}
              className="flex-1 md:w-full h-12 rounded-2xl border-2 hover:bg-muted font-bold tracking-tight"
            >
              <ChevronLeft className="w-5 h-5 mr-2" />
              Previous
            </Button>
            <Button
              variant="outline"
              disabled={currentCardIndex === flashcards.length - 1}
              onClick={handleNext}
              className="flex-1 md:w-full h-12 rounded-2xl border-2 hover:bg-muted font-bold tracking-tight"
            >
              Next
              <ChevronRight className="w-5 h-5 ml-2" />
            </Button>
          </div>

          {/* Action Center */}
          <div className="md:col-span-6 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Button
                disabled={!isFlipped}
                onClick={handleMarkUnmastered}
                variant="outline"
                className={`h-16 rounded-2xl border-2 font-bold transition-all ${
                  isFlipped
                    ? 'border-orange-500/30 text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-950/20 shadow-lg shadow-orange-500/5'
                    : 'opacity-50 grayscale cursor-not-allowed'
                }`}
              >
                <div className="flex flex-col items-center">
                  <RotateCcw className="w-5 h-5 mb-1" />
                  <span className="text-xs uppercase">Need Practice</span>
                </div>
              </Button>
              <Button
                disabled={!isFlipped}
                onClick={handleMarkMastered}
                className={`h-16 rounded-2xl border-2 font-bold transition-all ${
                  isFlipped
                    ? 'bg-green-600 hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-600 border-green-500/30 shadow-lg shadow-green-500/20'
                    : 'bg-muted border-transparent text-muted-foreground opacity-50 grayscale cursor-not-allowed'
                }`}
              >
                <div className="flex flex-col items-center">
                  <Check className="w-5 h-5 mb-1 text-white" />
                  <span className="text-xs uppercase text-white">Mastered</span>
                </div>
              </Button>
            </div>
            <Button
              variant="outline"
              onClick={handleExplainWithAI}
              className="w-full h-14 rounded-2xl font-bold bg-muted/50 text-muted-foreground hover:bg-muted transition-all border border-border shadow-sm"
            >
              <Lightbulb className="w-5 h-5 mr-2" />
              Explain Concept
            </Button>
          </div>

          {/* Meta Controls */}
          <div className="md:col-span-3">
            <Button
              variant="ghost"
              onClick={() => {
                setCurrentCardIndex(0);
                setIsFlipped(false);
                setMasteredCount(0);
              }}
              className="w-full h-12 rounded-2xl text-muted-foreground hover:text-foreground font-semibold flex flex-col gap-0.5"
            >
              <RotateCcw className="w-4 h-4" />
              <span className="text-[10px] uppercase tracking-widest font-bold">Restart Session</span>
            </Button>
          </div>
        </div>
      </div>
    </ScrollArea>
  );
};

export default FlashcardStudyView;
