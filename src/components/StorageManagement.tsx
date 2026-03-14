import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Trash2, HardDrive, AlertCircle, Loader2 } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface StorageItem {
  id: string;
  name: string;
  size: number;
  type: 'document' | 'chat' | 'flashcard' | 'quiz' | 'whiteboard';
  created_at: string;
}

interface StorageData {
  totalBytesUsed: number;
  limitBytes: number;
  items: StorageItem[];
}

const formatBytes = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const formatDate = (date: string): string => {
  return new Date(date).toLocaleDateString();
};

const StorageManagement: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [storage, setStorage] = useState<StorageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());

  const loadStorageData = useCallback(async () => {
    if (!user) return;

    try {
      // Get user's tier
      const { data: subData } = await supabase
        .from('subscriptions')
        .select('tier')
        .eq('user_id', user.id)
        .single();

      const tier = subData?.tier || 'free';
      // Set storage limits based on tier: free=20MB, tier1=200MB, tier2=1GB
      const limitBytes = tier === 'tier2' ? 1073741824 : tier === 'tier1' ? 209715200 : 20971520;

      // Fetch all storage items
      const items: StorageItem[] = [];

      // Fetch documents with actual file sizes from knowledge_base
      const { data: documents } = await supabase
        .from('study_documents')
        .select('id, file_name, file_size, num_pages, processed_content, created_at, knowledge_base(content)')
        .eq('user_id', user.id);

      if (documents) {
        documents.forEach((doc: any) => {
          // Calculate actual size from file_size field, processed content, or estimate from pages
          let size = doc.file_size || 0;
          if (!size && doc.processed_content) {
            size = new TextEncoder().encode(doc.processed_content).length;
          }
          if (!size && doc.knowledge_base?.content) {
            size = new TextEncoder().encode(doc.knowledge_base.content).length;
          }
          if (!size) {
            size = (doc.num_pages || 1) * 50000; // Fallback: estimate ~50KB per page
          }
          
          items.push({
            id: `doc-${doc.id}`,
            name: doc.file_name,
            size,
            type: 'document',
            created_at: doc.created_at,
          });
        });
      }

      // Fetch flashcard decks with actual card content
      const { data: flashcardDecks } = await supabase
        .from('flashcard_decks')
        .select('id, title, total_cards, created_at')
        .eq('user_id', user.id);

      if (flashcardDecks) {
        for (const deck of flashcardDecks as any[]) {
          // Get actual flashcard content for size calculation
          const { data: cards } = await supabase
            .from('flashcards')
            .select('front, back')
            .eq('deck_id', deck.id);
          
          let size = 0;
          if (cards) {
            cards.forEach((card: any) => {
              size += new TextEncoder().encode(card.front + card.back).length;
            });
          }
          if (!size) {
            size = (deck.total_cards || 10) * 500; // Fallback
          }
          
          items.push({
            id: `flashcard-${deck.id}`,
            name: deck.title,
            size,
            type: 'flashcard',
            created_at: deck.created_at,
          });
        }
      }

      // Fetch quizzes with actual question content
      const { data: quizzes } = await supabase
        .from('quizzes')
        .select('id, title, total_questions, created_at')
        .eq('user_id', user.id);

      if (quizzes) {
        for (const quiz of quizzes as any[]) {
          const { data: questions } = await supabase
            .from('quiz_questions')
            .select('question, options, explanation')
            .eq('quiz_id', quiz.id);
          
          let size = 0;
          if (questions) {
            questions.forEach((q: any) => {
              size += new TextEncoder().encode(
                q.question + JSON.stringify(q.options || {}) + (q.explanation || '')
              ).length;
            });
          }
          if (!size) {
            size = (quiz.total_questions || 10) * 1000; // Fallback
          }
          
          items.push({
            id: `quiz-${quiz.id}`,
            name: quiz.title,
            size,
            type: 'quiz',
            created_at: quiz.created_at,
          });
        }
      }

      // Fetch whiteboards with actual canvas data
      const { data: whiteboards } = await supabase
        .from('whiteboards')
        .select('id, title, canvas_data, created_at')
        .eq('user_id', user.id);

      if (whiteboards) {
        whiteboards.forEach((wb: any) => {
          let size = 0;
          if (wb.canvas_data) {
            size = new TextEncoder().encode(JSON.stringify(wb.canvas_data)).length;
          }
          if (!size) {
            size = 50000; // Default 50KB for empty whiteboard
          }
          
          items.push({
            id: `whiteboard-${wb.id}`,
            name: wb.title || 'Untitled Whiteboard',
            size,
            type: 'whiteboard',
            created_at: wb.created_at,
          });
        });
      }

      // Fetch chat conversations and messages
      const { data: conversations } = await supabase
        .from('chat_conversations')
        .select('id, title, created_at')
        .eq('user_id', user.id);

      if (conversations) {
        for (const convo of conversations as any[]) {
          const { data: messages } = await supabase
            .from('chat_messages')
            .select('content')
            .eq('conversation_id', convo.id);
          
          let size = 0;
          if (messages) {
            messages.forEach((msg: any) => {
              size += new TextEncoder().encode(msg.content).length;
            });
          }
          if (size > 0) {
            items.push({
              id: `chat-${convo.id}`,
              name: convo.title || 'Chat Conversation',
              size,
              type: 'chat',
              created_at: convo.created_at,
            });
          }
        }
      }

      const totalBytesUsed = items.reduce((sum, item) => sum + item.size, 0);

      // Sort by size descending
      items.sort((a, b) => b.size - a.size);

      setStorage({
        totalBytesUsed,
        limitBytes,
        items,
      });
    } catch (error) {
      console.error('Error loading storage data:', error);
      toast({
        title: 'Error',
        description: 'Failed to load storage information',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [user, toast]);

  useEffect(() => {
    loadStorageData();
  }, [loadStorageData]);

  const handleDeleteItem = async (item: StorageItem) => {
    if (!user) return;

    // Check if user is on free tier
    const { data: subData } = await supabase
      .from('subscriptions')
      .select('tier')
      .eq('user_id', user.id)
      .single();

    const tier = subData?.tier || 'free';
    if (tier === 'free') {
      toast({
        title: 'Premium Feature',
        description: 'Deleting items is only available for Pro users.',
        variant: 'destructive',
      });
      return;
    }

    if (!window.confirm(`Delete "${item.name}"? This cannot be undone.`)) return;

    setDeleting(item.id);
    try {
      const [type, ...idParts] = item.id.split('-');
      const id = idParts.join('-'); // Handle UUIDs with dashes

      if (type === 'doc') {
        await supabase.from('study_documents').delete().eq('id', id).eq('user_id', user.id);
      } else if (type === 'flashcard') {
        // Delete flashcards first, then deck
        await supabase.from('flashcards').delete().eq('deck_id', id);
        await supabase.from('flashcard_decks').delete().eq('id', id).eq('user_id', user.id);
      } else if (type === 'quiz') {
        // Delete quiz questions first, then quiz
        await supabase.from('quiz_questions').delete().eq('quiz_id', id);
        await supabase.from('quizzes').delete().eq('id', id).eq('user_id', user.id);
      } else if (type === 'whiteboard') {
        await supabase.from('whiteboards').delete().eq('id', id).eq('user_id', user.id);
      } else if (type === 'chat') {
        // Delete messages first, then conversation
        await supabase.from('chat_messages').delete().eq('conversation_id', id);
        await supabase.from('chat_conversations').delete().eq('id', id).eq('user_id', user.id);
      }

      // Reload storage data
      await loadStorageData();

      toast({
        title: 'Deleted',
        description: `"${item.name}" has been deleted`,
      });
    } catch (error) {
      console.error('Error deleting item:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete item',
        variant: 'destructive',
      });
    } finally {
      setDeleting(null);
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedItems.size === 0) return;

    const itemsToDelete = storage?.items.filter(item => selectedItems.has(item.id)) || [];
    const confirmed = window.confirm(`Delete ${itemsToDelete.length} item(s)? This cannot be undone.`);

    if (!confirmed) return;

    setDeleting('multiple');
    try {
      for (const item of itemsToDelete) {
        await handleDeleteItem(item);
      }
      setSelectedItems(new Set());
    } finally {
      setDeleting(null);
    }
  };

  if (loading || !storage) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <HardDrive className="w-5 h-5" />
              <Skeleton className="h-6 w-32" />
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-8" />
              </div>
              <Skeleton className="h-3 w-full" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-48" />
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex items-center justify-between p-3">
                  <div className="flex items-center gap-3 flex-1">
                    <Skeleton className="w-4 h-4 rounded" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-1/2" />
                      <Skeleton className="h-3 w-1/4" />
                    </div>
                  </div>
                  <Skeleton className="h-4 w-16" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const percentageUsed = Math.round((storage.totalBytesUsed / storage.limitBytes) * 100);
  const isPaid = storage.limitBytes > 100000000; // Greater than 100MB

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <HardDrive className="w-5 h-5" />
            Storage Usage
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="font-medium">{formatBytes(storage.totalBytesUsed)} of {formatBytes(storage.limitBytes)}</span>
              <span className={`font-bold ${
                percentageUsed >= 90 ? 'text-destructive' :
                percentageUsed >= 70 ? 'text-yellow-600' :
                'text-green-600'
              }`}>
                {percentageUsed}%
              </span>
            </div>
            <Progress value={percentageUsed} className="h-3" />
          </div>

          {percentageUsed >= 90 && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-start gap-3 p-3 bg-destructive/10 border border-destructive/20 rounded-lg"
            >
              <AlertCircle className="w-4 h-4 text-destructive mt-0.5 flex-shrink-0" />
              <p className="text-sm text-destructive">
                You're using {percentageUsed}% of your storage. Delete items below to free up space.
                {!isPaid && <span> Upgrade your plan for more storage.</span>}
              </p>
            </motion.div>
          )}
        </CardContent>
      </Card>

      {/* Storage Items */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">
            Storage Items ({storage.items.length})
          </CardTitle>
          {selectedItems.size > 0 && (
            <Button
              variant="destructive"
              size="sm"
              onClick={handleDeleteSelected}
              disabled={deleting !== null}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Delete {selectedItems.size}
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {storage.items.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No items using storage</p>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {storage.items.map((item) => (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  className="flex items-center justify-between p-3 hover:bg-secondary/50 rounded-lg transition-colors group"
                >
                  <label className="flex items-center gap-3 flex-1 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedItems.has(item.id)}
                      onChange={(e) => {
                        const newSelected = new Set(selectedItems);
                        if (e.target.checked) {
                          newSelected.add(item.id);
                        } else {
                          newSelected.delete(item.id);
                        }
                        setSelectedItems(newSelected);
                      }}
                      className="w-4 h-4 rounded"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{item.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {item.type.charAt(0).toUpperCase() + item.type.slice(1)} • {formatDate(item.created_at)}
                      </p>
                    </div>
                  </label>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-muted-foreground whitespace-nowrap">
                      {formatBytes(item.size)}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => handleDeleteItem(item)}
                      disabled={deleting !== null}
                    >
                      {deleting === item.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Trash2 className="w-4 h-4 text-destructive" />
                      )}
                    </Button>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default StorageManagement;
