import { useState, useEffect } from 'react';
import { Sparkles, Loader2, BookOpen, Brain, FileText, Zap, X, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from '@/hooks/use-translation';
import { useSubscription } from '@/hooks/useSubscription';

interface AIGenerateButtonProps {
  onFlashcardsGenerated?: (flashcards: { front: string; back: string }[]) => void;
  onQuizGenerated?: (questions: any[]) => void;
  onLessonsGenerated?: (lessons: any[]) => void;
  onNBTGenerated?: (nbt: any[]) => void;
  knowledgeContent?: string;
  showLessons?: boolean;
  showNBT?: boolean;
  defaultType?: 'flashcards' | 'quiz' | 'lesson' | 'nbt';
}

interface KnowledgeItem {
  id: string;
  title: string;
  content: string;
  content_type: string;
  created_at: string;
}

export const AIGenerateButton = ({
  onFlashcardsGenerated,
  onQuizGenerated,
  onLessonsGenerated,
  onNBTGenerated,
  knowledgeContent,
  showLessons = false,
  showNBT = false,
  defaultType = 'flashcards'
}: AIGenerateButtonProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { language } = useTranslation();
  const { limits, tier, isStorageFull, canUseAi, incrementAiUsage } = useSubscription();
  const [isOpen, setIsOpen] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [content, setContent] = useState(knowledgeContent || '');
  const [type, setType] = useState<'flashcards' | 'quiz' | 'lesson' | 'nbt'>(defaultType);
  const [count, setCount] = useState('5');
  const [selectedKnowledgeIds, setSelectedKnowledgeIds] = useState<string[]>([]);
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('');
  const [userKnowledgeItems, setUserKnowledgeItems] = useState<KnowledgeItem[]>([]);
  const [enrolledSubjects, setEnrolledSubjects] = useState<any[]>([]);
  const [showKnowledgeDropdown, setShowKnowledgeDropdown] = useState(false);

  // Fetch user knowledge items and enrolled subjects
  useEffect(() => {
    if (user && isOpen) {
      fetchUserKnowledge();
      fetchEnrolledSubjects();
    }
  }, [user, isOpen]);

  const fetchUserKnowledge = async () => {
    if (!user) return;

    try {
      const { data } = await supabase
        .from('knowledge_base')
        .select('id, title, content, content_type, created_at')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .limit(10);

      setUserKnowledgeItems(data || []);
    } catch (error) {
      console.error('Error fetching user knowledge:', error);
    }
  };

  const fetchEnrolledSubjects = async () => {
    if (!user) return;

    try {
      // Get subject names from profile
      const { data: profileData } = await supabase
        .from('profiles')
        .select('subjects')
        .eq('user_id', user.id)
        .single();

      if (!profileData?.subjects || profileData.subjects.length === 0) {
        setEnrolledSubjects([]);
        return;
      }

      // Fetch subject details for these names
      const { data: subjectsData } = await supabase
        .from('subjects')
        .select('id, name')
        .in('name', profileData.subjects);

      setEnrolledSubjects(subjectsData || []);
    } catch (error) {
      console.error('Error fetching enrolled subjects:', error);
    }
  };

  const handleGenerate = async () => {
    // Validation
    if (!content.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter some content to generate from. You can paste notes, a topic, or any study material.',
        variant: 'destructive',
      });
      return;
    }

    if (isStorageFull) {
      toast({
        title: 'Storage limit reached',
        description: 'You have reached your storage limit. Please delete some documents or upgrade your plan to generate more content.',
        variant: 'destructive',
      });
      return;
    }

    // Subject is required for better accuracy
    if (!selectedSubjectId) {
      toast({
        title: 'Missing Subject',
        description: `Please select a subject. The AI needs to know which subject to tailor the ${type} to.`,
        variant: 'destructive',
      });
      return;
    }

    // Check generation limits for free users
    if (tier === 'free') {
      const countValue = parseInt(count) || 1;
      const maxLimit = type === 'flashcards' ? limits.maxFlashcards : limits.maxQuizQuestions;

      if (countValue > maxLimit) {
        toast({
          title: 'Limit exceeded',
          description: `Free users can generate a maximum of ${maxLimit} ${type === 'flashcards' ? 'flashcards' : 'quiz questions'} at a time. Upgrade to Pro for unlimited generation.`,
          variant: 'destructive',
        });
        return;
      }
    }

    if (!canUseAi()) {
      toast({
        title: 'Daily limit reached',
        description: 'You have reached your daily AI usage limit. Upgrade your plan for more generation!',
        variant: 'destructive',
      });
      return;
    }

    setGenerating(true);

    try {
      // Get the selected subject name
      const selectedSubject = enrolledSubjects.find(s => s.id === selectedSubjectId);
      const subjectName = selectedSubject?.name || '';

      // Build knowledge context from selected items
      let knowledgeContext = '';
      if (selectedKnowledgeIds.length > 0) {
        const selectedItems = userKnowledgeItems.filter(item => selectedKnowledgeIds.includes(item.id));
        knowledgeContext = selectedItems
          .map(item => `[${item.title}]\n${item.content}`)
          .join('\n\n---\n\n');
      }

      // Combine all context
      let finalContent = content;
      if (knowledgeContext) {
        finalContent = `User's Knowledge Base:\n${knowledgeContext}\n\nGenerate content from: ${content}`;
      }

      // Add subject context
      finalContent = finalContent + `\n\nSubject: ${subjectName}`;

      const { data, error } = await supabase.functions.invoke('ai-generate', {
        body: {
          type,
          content: finalContent,
          count: parseInt(count),
          language,
          subject: subjectName,
          selectedKnowledgeIds,
          useUserKnowledge: selectedKnowledgeIds.length > 0,
        }
      });

      if (error) throw error;

      if (data.error) {
        throw new Error(data.error);
      }

      // Increment usage count
      await incrementAiUsage();

      const itemCount = data.data?.length || 0;

      if (type === 'flashcards' && onFlashcardsGenerated) {
        onFlashcardsGenerated(data.data);
        toast({
          title: 'Flashcards generated!',
          description: `${itemCount} flashcards created from ${selectedSubject?.name}`,
        });
      } else if (type === 'quiz' && onQuizGenerated) {
        onQuizGenerated(data.data);
        toast({
          title: 'Quiz generated!',
          description: `${itemCount} questions created from ${selectedSubject?.name}`,
        });
      } else if (type === 'lesson' && onLessonsGenerated) {
        onLessonsGenerated(data.data);
        toast({
          title: 'Lesson generated!',
          description: `Lesson created successfully`,
        });
      } else if (type === 'nbt' && onNBTGenerated) {
        onNBTGenerated(data.data);
        toast({
          title: 'NBT content generated!',
          description: `NBT materials created successfully`,
        });
      }

      setIsOpen(false);
    } catch (error) {
      console.error('Generation error:', error);
      toast({
        title: 'Generation failed',
        description: error instanceof Error ? error.message : 'Failed to generate content',
        variant: 'destructive',
      });
    } finally {
      setGenerating(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Sparkles className="w-4 h-4" />
          AI Generate
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            AI Content Generator
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-4">
          <div className="grid gap-4">
            {/* Content Type & Count Selection */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Generate</Label>
                <Select value={type} onValueChange={(v) => {
                  setType(v as any);
                  setSelectedSubjectId(''); // Reset subject when changing type
                }}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="flashcards">
                      <div className="flex items-center gap-2">
                        <BookOpen className="w-4 h-4" />
                        Flashcards
                      </div>
                    </SelectItem>
                    <SelectItem value="quiz">
                      <div className="flex items-center gap-2">
                        <Brain className="w-4 h-4" />
                        Quiz Questions
                      </div>
                    </SelectItem>
                    {showLessons && (
                      <SelectItem value="lesson">
                        <div className="flex items-center gap-2">
                          <FileText className="w-4 h-4" />
                          Lesson
                        </div>
                      </SelectItem>
                    )}
                    {showNBT && (
                      <SelectItem value="nbt">
                        <div className="flex items-center gap-2">
                          <Zap className="w-4 h-4" />
                          NBT Content
                        </div>
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>
                  {type === 'flashcards' && 'How many flashcards?'}
                  {type === 'quiz' && 'How many questions?'}
                  {type === 'lesson' && 'Number of sections'}
                  {type === 'nbt' && 'Number of items'}
                </Label>
                <Select value={count} onValueChange={setCount}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="3">3</SelectItem>
                    <SelectItem value="5">5</SelectItem>
                    <SelectItem value="10">10</SelectItem>
                    <SelectItem value="15">15</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Subject Selection - Required for better accuracy */}
            <div>
              <Label className="text-sm font-medium">
                Subject <span className="text-red-500">*</span>
              </Label>
              <Select value={selectedSubjectId} onValueChange={setSelectedSubjectId}>
                <SelectTrigger className={!selectedSubjectId ? 'border-red-500' : ''}>
                  <SelectValue placeholder="Select a subject for better accuracy" />
                </SelectTrigger>
                <SelectContent>
                  {enrolledSubjects.map((subject) => (
                    <SelectItem key={subject.id} value={subject.id}>
                      {subject.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                The AI will use the subject context to ensure accuracy and handle terminology correctly
              </p>
            </div>

            {/* Knowledge Base Selection */}
            {userKnowledgeItems.length > 0 && (
              <div className="space-y-2">
                <Label className="text-sm font-medium">
                  Your Knowledge ({userKnowledgeItems.length} items available)
                </Label>
                <div className="relative">
                  <button
                    onClick={() => setShowKnowledgeDropdown(!showKnowledgeDropdown)}
                    className="w-full px-3 py-2 text-left border rounded-md bg-background text-sm flex items-center justify-between hover:bg-accent"
                  >
                    <span className="text-muted-foreground">
                      {selectedKnowledgeIds.length === 0
                        ? 'Select knowledge to include (optional)'
                        : `${selectedKnowledgeIds.length} selected`}
                    </span>
                    <ChevronDown className="w-4 h-4" />
                  </button>

                  {showKnowledgeDropdown && (
                    <div className="absolute top-full left-0 right-0 mt-1 border rounded-md bg-background shadow-lg z-50 max-h-48 overflow-y-auto">
                      {userKnowledgeItems.map((item) => (
                        <button
                          key={item.id}
                          onClick={() => {
                            setSelectedKnowledgeIds(prev =>
                              prev.includes(item.id)
                                ? prev.filter(id => id !== item.id)
                                : [...prev, item.id]
                            );
                          }}
                          className="w-full px-3 py-2 text-left text-sm hover:bg-accent border-b last:border-b-0 flex items-start gap-2"
                        >
                          <input
                            type="checkbox"
                            checked={selectedKnowledgeIds.includes(item.id)}
                            onChange={() => {}}
                            className="mt-1 cursor-pointer"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="font-medium truncate">{item.title}</div>
                            <div className="text-xs text-muted-foreground capitalize">
                              {item.content_type}
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Selected Knowledge Tags */}
                {selectedKnowledgeIds.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {selectedKnowledgeIds.map((id) => {
                      const item = userKnowledgeItems.find(i => i.id === id);
                      return item ? (
                        <Badge key={id} variant="secondary" className="gap-1">
                          {item.title}
                          <button
                            onClick={() => setSelectedKnowledgeIds(prev => prev.filter(i => i !== id))}
                            className="ml-1 hover:opacity-70"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </Badge>
                      ) : null;
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Source Content Input */}
          <div>
            <Label>Source Content</Label>
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Enter a topic or paste your study material, notes, or any content you want to learn from..."
              rows={6}
              className="mt-2"
            />
            <p className="text-xs text-muted-foreground mt-2">
              {type === 'flashcards' && 'The AI will analyze this content and your selected knowledge to generate flashcards.'}
              {type === 'quiz' && 'The AI will create quiz questions based on this content and your selected knowledge.'}
              {type === 'lesson' && 'The AI will generate a comprehensive lesson with multiple sections.'}
              {type === 'nbt' && 'The AI will create NBT practice materials and study content.'}
            </p>
          </div>

          <Button onClick={handleGenerate} disabled={generating} className="w-full">
            {generating ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 mr-2" />
                {type === 'flashcards' && 'Generate Flashcards'}
                {type === 'quiz' && 'Generate Quiz'}
                {type === 'lesson' && 'Generate Lesson'}
                {type === 'nbt' && 'Generate NBT Content'}
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AIGenerateButton;
