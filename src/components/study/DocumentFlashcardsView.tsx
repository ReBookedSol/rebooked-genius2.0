import { useState, useEffect, useCallback } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Plus, Sparkles, Loader2, Layers, Check, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useAIContext } from '@/contexts/AIContext';
import { supabase } from '@/integrations/supabase/client';
import { useSubscription } from '@/hooks/useSubscription';
import { type MarkdownSection } from '@/lib/markdownUtils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
interface StudyDocument {
  id: string;
  file_name: string;
  processed_content: string | null;
}

interface FlashcardDeck {
  id: string;
  title: string;
  total_cards: number;
  mastered_cards: number;
}

interface DocumentFlashcardsViewProps {
  document: StudyDocument;
  lessonContent?: string;
  lessonSections?: MarkdownSection[];
  onDeckSelect?: (deckId: string) => void;
  onGeneratingChange?: (isGenerating: boolean) => void;
  subjectId?: string;
}

const DocumentFlashcardsView: React.FC<DocumentFlashcardsViewProps> = ({
  document,
  lessonContent,
  lessonSections = [],
  onDeckSelect,
  onGeneratingChange,
  subjectId
}) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { limits, tier, canCreateFlashcardSet } = useSubscription();
  const { context: aiContext, setAiContext } = useAIContext();
  const [flashcardDecks, setFlashcardDecks] = useState<FlashcardDeck[]>([]);
  const [loading, setLoading] = useState(true);
  const [cardCount, setCardCount] = useState(10);
  const [selectedSectionIds, setSelectedSectionIds] = useState<string[]>([]);

  // Use global generation state
  const isGenerating = aiContext.generationState?.isGenerating && aiContext.generationState?.generationType === 'flashcards' && aiContext.generationState?.documentId === document.id ? true : false;

  // Fetch existing flashcard decks for this document
  const fetchDecks = useCallback(async () => {
    if (!user || !document) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('flashcard_decks')
        .select('id, title, total_cards, mastered_cards')
        .eq('user_id', user.id)
        .ilike('title', `%${document.file_name}%`)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setFlashcardDecks(data || []);
    } catch (error) {
      console.error('Error fetching flashcard decks:', error);
    } finally {
      setLoading(false);
    }
  }, [user, document]);

  useEffect(() => {
    fetchDecks();
  }, [fetchDecks]);

  const handleGenerateFlashcards = async () => {
    if (!document || !user) return;

    // Use selected sections content if available, otherwise fall back to full lesson content
    let contentToUse: string | null = null;
    if (selectedSectionIds.length > 0 && lessonSections.length > 0) {
      const selectedSections = lessonSections.filter(s => selectedSectionIds.includes(s.id));
      contentToUse = selectedSections.map(s => s.content).join('\n\n---\n\n');
    }

    if (!contentToUse) {
      contentToUse = lessonContent || document.processed_content;
    }
    if (!contentToUse || contentToUse.trim().length === 0) {
      toast({
        title: 'No content available',
        description: 'Please generate lessons first before creating flashcards.',
        variant: 'destructive',
      });
      return;
    }


    if (tier === 'free' && !canCreateFlashcardSet()) {
      toast({
        title: 'Flashcard Set Limit Reached',
        description: 'Free users can only create 1 flashcard set. Please upgrade to Pro for unlimited sets.',
        variant: 'destructive',
      });
      return;
    }

    if (tier === 'free' && limits.maxFlashcards < cardCount) {
      toast({
        title: 'Limit exceeded',
        description: `Free users can generate max ${limits.maxFlashcards} flashcards. Upgrade for more.`,
        variant: 'destructive',
      });
      return;
    }

    // Set global generation state
    setAiContext({
      generationState: {
        isGenerating: true,
        generationType: 'flashcards',
        documentId: document.id,
      }
    });
    onGeneratingChange?.(true);
    try {
      // Call AI to generate flashcards
      const { data, error } = await supabase.functions.invoke('ai-generate', {
        body: {
          type: 'flashcards',
          content: contentToUse,
          count: cardCount,
        },
      });

      if (error) throw error;
      if (!data?.data || !Array.isArray(data.data)) {
        throw new Error('Invalid response from AI');
      }

      const flashcards = data.data;

      // Create the deck in the database
      const deckTitle = `${document.file_name} - Flashcards`;
      const { data: deckData, error: deckError } = await supabase
        .from('flashcard_decks')
        .insert({
          user_id: user.id,
          title: deckTitle,
          description: `Generated from ${document.file_name}`,
          total_cards: flashcards.length,
          mastered_cards: 0,
          is_ai_generated: true,
          subject_id: subjectId || null,
        })
        .select()
        .single();

      if (deckError) throw deckError;

      // Insert the flashcards
      const cardsToInsert = flashcards.map((card: any) => ({
        user_id: user.id,
        deck_id: deckData.id,
        front: card.front,
        back: card.back,
        is_mastered: false,
      }));

      const { error: cardsError } = await supabase
        .from('flashcards')
        .insert(cardsToInsert);

      if (cardsError) throw cardsError;

      toast({
        title: 'Flashcards generated!',
        description: `Created ${flashcards.length} flashcards.`,
      });

      // Refresh the list
      fetchDecks();
    } catch (error: any) {
      console.error('Error generating flashcards:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to generate flashcards',
        variant: 'destructive',
      });
    } finally {
      // Clear global generation state
      setAiContext({
        generationState: {
          isGenerating: false,
          generationType: undefined,
          documentId: undefined,
        }
      });
      onGeneratingChange?.(false);
    }
  };

  // Flashcard count options based on tier
  const cardOptions = tier === 'free' ? [10] : [10, 20, 30, 40, 50];

  return (
    <ScrollArea className="h-full">
      <div className="p-4 space-y-4">
        {/* Generation Options */}
        <div className="space-y-3 p-3 bg-secondary/30 rounded-lg">
          <div>
            <Label htmlFor="cardCount" className="text-xs">Number of Flashcards</Label>
            <Select 
              value={cardCount.toString()} 
              onValueChange={(value) => setCardCount(parseInt(value))}
            >
              <SelectTrigger id="cardCount" className="h-8 text-sm">
                <SelectValue placeholder="Select count" />
              </SelectTrigger>
              <SelectContent>
                {cardOptions.map((count) => (
                  <SelectItem key={count} value={count.toString()}>
                    {count} flashcards
                  </SelectItem>
                ))}
                {tier === 'free' && (
                  <SelectItem value="locked" disabled className="text-muted-foreground">
                    🔒 20-50 (Upgrade)
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>
          {lessonSections.length > 0 && (
            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground">Focus Topics (Optional)</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full h-9 justify-between font-normal text-xs px-3 bg-background hover:bg-muted/50 border-dashed">
                    <div className="flex items-center gap-2 truncate">
                      <Layers className="w-3.5 h-3.5 text-primary" />
                      <span className="truncate">
                        {selectedSectionIds.length === 0
                          ? "All Topics Included"
                          : `${selectedSectionIds.length} Topic${selectedSectionIds.length > 1 ? 's' : ''} Selected`}
                      </span>
                    </div>
                    <Plus className="ml-2 h-3.5 w-3.5 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                  <div className="p-2 border-b bg-muted/30">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full justify-start text-xs h-8 hover:bg-background"
                      onClick={(e) => { e.preventDefault(); setSelectedSectionIds([]); }}
                    >
                      <Check className={`mr-2 h-3 w-3 ${selectedSectionIds.length === 0 ? "opacity-100" : "opacity-0"}`} />
                      All Topics
                    </Button>
                  </div>
                  <ScrollArea className="h-[200px]">
                    <div className="p-2 space-y-1">
                      {lessonSections.map((section) => (
                        <div
                          key={section.id}
                          className="flex items-center space-x-2 px-2 py-2 rounded-md hover:bg-primary/5 cursor-pointer transition-colors group"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            if (selectedSectionIds.includes(section.id)) {
                              setSelectedSectionIds(selectedSectionIds.filter(id => id !== section.id));
                            } else {
                              setSelectedSectionIds([...selectedSectionIds, section.id]);
                            }
                          }}
                        >
                          <Checkbox
                            id={`flash-topic-${section.id}`}
                            checked={selectedSectionIds.includes(section.id)}
                            className="h-4 w-4 border-primary/30 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                          />
                          <Label
                            htmlFor={`flash-topic-${section.id}`}
                            className="text-[11px] font-medium flex-1 cursor-pointer truncate group-hover:text-primary transition-colors"
                          >
                            {section.title}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </PopoverContent>
              </Popover>

              {selectedSectionIds.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {selectedSectionIds.slice(0, 3).map(id => {
                    const section = lessonSections.find(s => s.id === id);
                    return (
                      <Badge key={id} variant="secondary" className="text-[9px] py-0 h-5 px-1.5 bg-primary/10 text-primary border-none">
                        {section?.title}
                      </Badge>
                    );
                  })}
                  {selectedSectionIds.length > 3 && (
                    <Badge variant="secondary" className="text-[9px] py-0 h-5 px-1.5">
                      +{selectedSectionIds.length - 3} more
                    </Badge>
                  )}
                </div>
              )}
            </div>
          )}
          <Button
            onClick={handleGenerateFlashcards}
            disabled={isGenerating}
            className="w-full gap-2 text-xs h-8"
            size="sm"
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-3 h-3 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Sparkles className="w-3 h-3" />
                Generate Flashcards
              </>
            )}
          </Button>
        </div>

        {loading ? (
          <div className="space-y-4">
            <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
              <Layers className="w-4 h-4 text-primary" />
              <Skeleton className="h-4 w-24" />
            </h2>
            <div className="grid grid-cols-1 gap-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="w-full p-4 bg-card border border-border/50 rounded-xl">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-2/3" />
                      <Skeleton className="h-1.5 w-full rounded-full" />
                      <Skeleton className="h-3 w-1/3" />
                    </div>
                    <Skeleton className="w-8 h-8 rounded-lg" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : flashcardDecks.length > 0 ? (
          <div className="space-y-4">
            <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
              <Layers className="w-4 h-4 text-primary" />
              Your Decks
            </h2>
            <div className="grid grid-cols-1 gap-3">
              {flashcardDecks.map((deck) => (
                <button
                  key={deck.id}
                  onClick={() => onDeckSelect?.(deck.id)}
                  className="w-full p-4 bg-card border border-border/50 rounded-xl hover:border-primary/50 hover:bg-primary/5 transition-all text-left group shadow-sm hover:shadow-md"
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-foreground truncate group-hover:text-primary transition-colors">{deck.title}</p>
                      <div className="flex items-center gap-2 mt-1.5">
                        <div className="flex-1 bg-secondary rounded-full h-1.5 overflow-hidden">
                          <div
                            className="bg-primary h-1.5 rounded-full transition-all duration-500"
                            style={{
                              width: `${deck.total_cards > 0 ? (deck.mastered_cards / deck.total_cards) * 100 : 0}%`,
                            }}
                          />
                        </div>
                        <span className="text-[10px] font-bold text-muted-foreground whitespace-nowrap">
                          {Math.round(deck.total_cards > 0 ? (deck.mastered_cards / deck.total_cards) * 100 : 0)}%
                        </span>
                      </div>
                      <p className="text-[10px] font-medium text-muted-foreground mt-1">
                        {deck.mastered_cards} / {deck.total_cards} cards mastered
                      </p>
                    </div>
                    <div className="w-8 h-8 rounded-lg bg-primary/5 flex items-center justify-center group-hover:bg-primary/10 transition-colors">
                      <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="w-12 h-12 rounded-lg bg-secondary flex items-center justify-center mb-3">
              <Plus className="w-6 h-6 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium text-foreground mb-2">No flashcards yet</p>
            <p className="text-xs text-muted-foreground max-w-xs">
              Set the count above and generate flashcards
            </p>
          </div>
        )}
      </div>
    </ScrollArea>
  );
};

export default DocumentFlashcardsView;
