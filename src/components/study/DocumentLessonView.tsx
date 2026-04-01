import { useState, useRef, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, Sparkles, MessageSquarePlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { chunkDocument } from '@/lib/documentProcessor';
import { recordStudyActivity } from '@/utils/streak';
import { useLessonGeneration } from '@/contexts/LessonGenerationContext';
import { fetchPDFWithFreshSignedUrl, extractStoragePathFromSignedUrl } from '@/lib/pdfUrlManager';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useSubscription } from '@/hooks/useSubscription';
import { useSubjectAnalytics } from '@/hooks/useSubjectAnalytics';
import { AFFIRMATIONS } from '@/lib/affirmations';
import { stripMarkdownCodeBlocks } from '@/lib/markdownUtils';
import TextSelectionToolbar from '@/components/study/TextSelectionToolbar';
import InlineCommentPopover from '@/components/study/InlineCommentPopover';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import DOMPurify from 'dompurify';
import { highlightSelectedText } from '@/lib/textSelectionUtils';
import { supabase } from '@/integrations/supabase/client';
import {
  loadLessonsFromDB,
  saveLessonsToDB,
} from '@/lib/lessonPersistence';
import {
  extractTextFromPDFInBatches,
} from '@/lib/pdfExtractor';

interface StudyDocument {
  id: string;
  knowledge_id: string;
  file_name: string;
  file_type: string;
  num_pages: number | null;
  extraction_status: string;
  summary: string | null;
  processed_content: string | null;
  key_concepts: string[];
  created_at: string;
  subject_id?: string | null;
  knowledge_base?: {
    title: string;
    source_file_url: string;
    content: string;
  };
}

interface DocumentLessonViewProps {
  document: StudyDocument;
  onAskAI?: (selectedText: string, lessonContext: string) => void;
  onLessonContentUpdate?: (content: string, id?: string) => void;
}

export function DocumentLessonView({ document, onAskAI, onLessonContentUpdate }: DocumentLessonViewProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { isStorageFull, canUseAi, incrementAiUsage, tier } = useSubscription();
  const { updateSubjectAnalytics } = useSubjectAnalytics();
  const isFreeTier = tier === 'free';
  const {
    lessons,
    progress,
    isGenerating,
    generateLessons,
    updateLesson,
    cancelGeneration,
    loadSavedLessons,
    reset,
    setIsGenerating,
    documentId: currentContextDocId,
    setDocumentId: setContextDocId,
  } = useLessonGeneration();

  const [loadedFromDB, setLoadedFromDB] = useState(false);
  const [hasAttemptedAutoGeneration, setHasAttemptedAutoGeneration] = useState(false);
  const [currentAffirmation, setCurrentAffirmation] = useState(AFFIRMATIONS[0]);
  
  // Inline comment popover state
  const [commentPopover, setCommentPopover] = useState<{
    visible: boolean;
    x: number;
    y: number;
    comment: string;
    highlightedText: string;
  }>({ visible: false, x: 0, y: 0, comment: '', highlightedText: '' });

  // Comment modal state (replaces browser prompt())
  const [isCommentModalOpen, setIsCommentModalOpen] = useState(false);
  const [commentInputValue, setCommentInputValue] = useState('');
  const [pendingCommentText, setPendingCommentText] = useState('');

  useEffect(() => {
    if (!isGenerating) return;
    const interval = setInterval(() => {
      const randomIndex = Math.floor(Math.random() * AFFIRMATIONS.length);
      setCurrentAffirmation(AFFIRMATIONS[randomIndex]);
    }, 5000);
    return () => clearInterval(interval);
  }, [isGenerating]);

  useEffect(() => {
    if (!isGenerating) return;
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      const message = 'Wait until the lesson generator is complete. Your progress may be lost.';
      e.returnValue = message;
      return message;
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isGenerating]);

  const currentDocumentIdRef = useRef<string | null>(null);

  useEffect(() => {
    const loadDBLessons = async () => {
      if (!user || !document.id) return;
      if (isGenerating && currentContextDocId === document.id) {
        setLoadedFromDB(true);
        currentDocumentIdRef.current = document.id;
        return;
      }
      if (currentDocumentIdRef.current === document.id && loadedFromDB) return;
      if (!isGenerating && currentContextDocId !== document.id) {
        reset();
        setContextDocId(document.id);
      }
      try {
        const savedLessons = await loadLessonsFromDB(user.id, document.id);
        if (savedLessons.length > 0) {
          loadSavedLessons(savedLessons);
        }
        currentDocumentIdRef.current = document.id;
        setLoadedFromDB(true);
      } catch (error) {
        console.error('Error loading saved lessons:', error);
        setLoadedFromDB(true);
      }
    };
    loadDBLessons();
  }, [user, document.id, loadSavedLessons]);

  // When generation completes, mark as loaded from DB so skeleton resolves
  useEffect(() => {
    if (!isGenerating && lessons.length > 0 && !loadedFromDB) {
      setLoadedFromDB(true);
    }
  }, [isGenerating, lessons.length, loadedFromDB]);

  useEffect(() => {
    if (!user || !document.id || lessons.length === 0) return;
    const lessonsWithContent = lessons.filter((l) => l.content || l.error);
    if (lessonsWithContent.length === 0) return;

    const completedLessons = lessons.filter((l) => l.status === 'completed' && l.content);
    const allLessonsProcessed = lessons.length > 0 && lessons.every(l => l.status === 'completed' || l.status === 'error');

    if (allLessonsProcessed && completedLessons.length > 0 && onLessonContentUpdate) {
      const combinedContent = completedLessons
        .sort((a, b) => a.chunkNumber - b.chunkNumber)
        .map(l => l.content)
        .join('\n\n---\n\n');
      onLessonContentUpdate(combinedContent, document.id);
    }

    const saveTimeoutId = setTimeout(async () => {
      try {
        const lessonsToSave = lessonsWithContent.map((lesson) => ({
          chunkNumber: lesson.chunkNumber,
          content: lesson.content,
          status: lesson.status as 'completed' | 'processing' | 'error',
          error: lesson.error || '',
        }));
        await saveLessonsToDB(user.id, document.id, lessonsToSave);
      } catch (error) {
        console.error('[DocumentLessonView] Error saving lessons:', error);
      }
    }, 2000);

    return () => clearTimeout(saveTimeoutId);
  }, [user, document.id, lessons, toast, onLessonContentUpdate]);

  const combinedContent = useMemo(() => {
    const completedLessons = lessons
      .filter((l) => l.status === 'completed' && l.content)
      .sort((a, b) => a.chunkNumber - b.chunkNumber);
    if (completedLessons.length === 0) return '';
    return completedLessons.map(l => l.content).join('\n\n---\n\n');
  }, [lessons]);

  const handleGenerateLessons = async () => {
    if (!user || !document.id) {
      toast({ title: 'Error', description: 'Missing document or user information', variant: 'destructive' });
      return;
    }
    if (isStorageFull) {
      toast({ title: 'Storage limit reached', description: 'Delete some documents or upgrade your plan.', variant: 'destructive' });
      return;
    }
    if (!canUseAi()) {
      toast({ title: 'Daily limit reached', description: 'Upgrade your plan for more lessons!', variant: 'destructive' });
      return;
    }

    reset();
    setIsGenerating(true);
    setHasAttemptedAutoGeneration(false);
    setLoadedFromDB(false);

    try {
      const isPDF = document.file_name.toLowerCase().endsWith('.pdf');

      if (isPDF && document.knowledge_base?.source_file_url) {
        // Extract storage path for potential signed URL refresh on 400 errors
        const storagePath = extractStoragePathFromSignedUrl(document.knowledge_base.source_file_url);

        // Fetch PDF with automatic signed URL regeneration if expired
        const blob = await fetchPDFWithFreshSignedUrl(document.knowledge_base.source_file_url, storagePath);
        const file = new File([blob], document.file_name, { type: 'application/pdf' });
        const result = await extractTextFromPDFInBatches(file);
        if (result.error) throw new Error(result.error);

        const allChunks: any[] = result.batches.map((batch) => ({
          id: batch.batchNumber,
          content: batch.text,
          startIndex: 0,
          endIndex: batch.text.length,
          metadata: { startPage: batch.startPage, endPage: batch.endPage },
        }));
        if (allChunks.length === 0) throw new Error('No text content found in PDF');

        // Save extracted text for AI context (non-blocking)
        const fullExtractedText = allChunks.map(c => c.content).join('\n\n');
        supabase.from('study_documents')
          .update({ extracted_text: fullExtractedText.substring(0, 50000) } as any)
          .eq('id', document.id)
          .then(({ error }) => { if (error) console.warn('Could not save extracted text:', error); });

        const globalBatchInfo = {
          totalBatches: result.batches.length,
          currentBatch: 1,
          pagesInBatch: 0,
          totalPages: result.totalPages,
        };
        await generateLessons(allChunks, 'google', globalBatchInfo, document.id, !isFreeTier);
      } else {
        let contentToProcess = document.processed_content || document.knowledge_base?.content || '';
        if (!contentToProcess?.trim()) {
          if (document.knowledge_base?.source_file_url) {
            try {
              // Extract storage path for potential signed URL refresh on 400 errors
              const storagePath = extractStoragePathFromSignedUrl(document.knowledge_base.source_file_url);

              // Fetch file with automatic signed URL regeneration if expired
              const blob = await fetchPDFWithFreshSignedUrl(document.knowledge_base.source_file_url, storagePath);
              contentToProcess = await blob.text();
            } catch {}
          }
        }
        if (!contentToProcess?.trim()) throw new Error('No content available to generate lessons from');

        const processedDoc = chunkDocument(contentToProcess);
        await generateLessons(processedDoc.chunks, 'google', undefined, document.id, !isFreeTier);
      }

      await incrementAiUsage();
      await recordStudyActivity(user.id, 'lesson_generation', document.subject_id || null);
      if (document.subject_id) await updateSubjectAnalytics(document.subject_id, true);
    } catch (error) {
      setIsGenerating(false);
      const errorMessage = error instanceof Error ? error.message : 'Failed to generate lessons';

      let userMessage = 'Failed to generate lessons.';
      let title = 'Generation Error';

      if (errorMessage.toLowerCase().includes('timeout')) { title = 'Request Timeout'; userMessage = 'The request took too long. Please try again.'; }
      else if (errorMessage.includes('429')) { title = 'Rate Limited'; userMessage = 'The AI service is currently busy. Please wait.'; }
      else if (errorMessage.includes('NBT_CONTENT_DETECTED')) { title = 'NBT Content Detected'; userMessage = 'Redirecting you to the NBT section...'; }
      else if (errorMessage.includes('No text content') || errorMessage.includes('No content')) { title = 'Empty Document'; userMessage = 'No readable content found.'; }

      toast({ title, description: userMessage, variant: 'destructive' });

      if (errorMessage.includes('NBT_CONTENT_DETECTED')) {
        setTimeout(() => navigate('/nbt'), 3000);
      }
    }
  };

  const persistContentAreaChanges = () => {
    const contentArea = window.document.querySelector('#lesson-content-scroll .lesson-content-area');
    if (!contentArea) return;
    const updatedHTML = contentArea.innerHTML;
    
    const completedLessons = lessons
      .filter((l) => l.status === 'completed' && l.content)
      .sort((a, b) => a.chunkNumber - b.chunkNumber);
    
    if (completedLessons.length >= 1) {
      updateLesson(completedLessons[0].chunkNumber, updatedHTML);
    }
    
    if (onLessonContentUpdate) {
      onLessonContentUpdate(updatedHTML, document.id);
    }
  };

  const handleHighlight = (text: string, color: string, range: Range) => {
    try {
      highlightSelectedText(color, false, '', range);
      persistContentAreaChanges();
      toast({ title: 'Highlighted', description: 'Text highlighted successfully.' });
    } catch (error) {
      console.error('Error highlighting text:', error);
    }
  };

  const handleComment = (text: string, range: Range) => {
    setPendingCommentText(text);
    setCommentInputValue('');
    // Apply temporary highlight
    highlightSelectedText('#10b981', true, 'PENDING_COMMENT', range);
    persistContentAreaChanges();
    setIsCommentModalOpen(true);
  };

  const handleSaveCommentFromModal = async () => {
    if (!commentInputValue.trim()) return;
    
    try {
      // Update the pending comment mark in DOM with actual comment
      const contentArea = window.document.querySelector('.lesson-content-area');
      if (contentArea) {
        const pendingSpan = contentArea.querySelector('span[data-comment="PENDING_COMMENT"]');
        if (pendingSpan) {
          pendingSpan.setAttribute('data-comment', commentInputValue.trim());
        }
        persistContentAreaChanges();
      }
      
      if (user && document.id) {
        const { error } = await supabase.from('lesson_comments').insert({
          user_id: user.id,
          lesson_id: document.id,
          highlighted_text: pendingCommentText,
          content: commentInputValue.trim(),
        });
        if (error) console.error('Error saving comment to DB:', error);
      }
      
      toast({ title: 'Comment added', description: 'Tap the highlighted text to view your comment.' });
      setIsCommentModalOpen(false);
    } catch (error) {
      console.error('Error adding comment:', error);
      toast({ title: 'Error', description: 'Failed to add comment.', variant: 'destructive' });
    }
  };

  const handleCancelComment = () => {
    // Remove the pending highlight
    const contentArea = window.document.querySelector('.lesson-content-area');
    if (contentArea) {
      const pendingSpan = contentArea.querySelector('span[data-comment="PENDING_COMMENT"]');
      if (pendingSpan) {
        const parent = pendingSpan.parentNode;
        if (parent) {
          try {
            while (pendingSpan.firstChild) {
              parent.insertBefore(pendingSpan.firstChild, pendingSpan);
            }
            parent.removeChild(pendingSpan);
          } catch (e) {
            // Node may already be detached (e.g. tab switch during pending comment) — ignore
            console.warn('Could not remove pending comment span:', e);
          }
        }
        persistContentAreaChanges();
      }
    }
    setIsCommentModalOpen(false);
  };

  const handleEditComment = async (newComment: string) => {
    // Update the DOM element
    const commentEls = window.document.querySelectorAll('.has-comment');
    commentEls.forEach(el => {
      if (el.getAttribute('data-comment') === commentPopover.comment) {
        el.setAttribute('data-comment', newComment);
      }
    });
    persistContentAreaChanges();

    // Update in DB
    if (user && document.id) {
      await supabase.from('lesson_comments')
        .update({ content: newComment })
        .eq('user_id', user.id)
        .eq('lesson_id', document.id)
        .eq('highlighted_text', commentPopover.highlightedText);
    }

    setCommentPopover(prev => ({ ...prev, comment: newComment }));
    toast({ title: 'Comment updated' });
  };

  // Handle clicking on commented text to show the comment popover
  const handleContentClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    const commentEl = target.closest('.has-comment') as HTMLElement;
    
    if (commentEl) {
      const commentText = commentEl.getAttribute('data-comment') || '';
      // Don't show popover for pending comments
      if (commentText === 'PENDING_COMMENT' || !commentText) {
        return;
      }
      const highlightedText = commentEl.textContent || '';
      const rect = commentEl.getBoundingClientRect();
      
      setCommentPopover({
        visible: true,
        x: rect.left + rect.width / 2,
        y: rect.bottom + 8,
        comment: commentText,
        highlightedText,
      });
    } else {
      if (commentPopover.visible) {
        setCommentPopover(prev => ({ ...prev, visible: false }));
      }
    }
  };

  const handleAskAI = (text: string) => {
    const prompt = `Can you please further elaborate on this?\n\n"${text}"`;
    // If onAskAI is provided (e.g. expanded AI chat is open), use that directly
    // Otherwise fall back to the floating panel event
    if (onAskAI) {
      onAskAI(text, combinedContent);
    } else {
      window.dispatchEvent(new CustomEvent('openFlashcardExplanation', { detail: { prompt } }));
    }
  };

  const isHTML = (content: string) => content.trim().startsWith('<') && content.includes('</');

  const renderContent = (content: string) => {
    if (isHTML(content)) {
      return <div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(content) }} />;
    }
    return (
      <ReactMarkdown remarkPlugins={[remarkGfm]}>
        {stripMarkdownCodeBlocks(content)}
      </ReactMarkdown>
    );
  };

  const hasLessons = combinedContent.length > 0;

  if (!loadedFromDB && !isGenerating) {
    return (
      <div className="flex flex-col h-full overflow-hidden bg-background p-6 lg:p-10">
        <div className="max-w-none mx-auto w-full space-y-6">
          <div className="flex items-center gap-2">
            <Skeleton className="h-6 w-24 rounded-full" />
            <Skeleton className="h-6 w-16 rounded-full" />
          </div>
          <Skeleton className="h-10 w-3/4" />
          <div className="space-y-4">
            {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
              <Skeleton key={i} className="h-4 w-full" style={{ width: `${85 + Math.random() * 15}%` }} />
            ))}
          </div>
          <Skeleton className="h-40 w-full rounded-xl" />
          <div className="space-y-4">
            {[1, 2, 3, 4].map(i => (
              <Skeleton key={i} className="h-4 w-full" style={{ width: `${80 + Math.random() * 20}%` }} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden bg-background">
      {/* Empty State */}
      {!hasLessons && !isGenerating && loadedFromDB && (
        <div className="flex-1 flex items-center justify-center">
          <div className="py-12 flex flex-col items-center justify-center max-w-md mx-auto px-4">
            <Sparkles className="w-12 h-12 text-primary mb-4 animate-pulse" />
            <h3 className="text-xl font-bold mb-2 text-foreground">Generate Your Lesson</h3>
            <p className="text-muted-foreground text-center max-w-sm mb-6 px-4 text-sm">
              Our AI will analyze your document and create a comprehensive study guide with all content combined into one flowing lesson.
            </p>
            <Button
              onClick={handleGenerateLessons}
              disabled={isGenerating}
              className="rounded-full px-8 shadow-lg shadow-primary/20 h-12"
            >
              <Sparkles className="w-5 h-5 mr-2" />
              Generate Lesson
            </Button>
          </div>
        </div>
      )}

      {/* Generation Progress */}
      {isGenerating && (
        <div className="flex-1 flex items-center justify-center">
          <div className="py-12 flex flex-col items-center justify-center max-w-md mx-auto px-4 text-center">
            <Loader2 className="w-12 h-12 text-primary mb-4 animate-spin" />
            <h3 className="text-xl font-bold mb-2 text-foreground">Generating Your Lesson</h3>
            <p className="text-muted-foreground mb-4 text-sm italic">"{currentAffirmation}"</p>
            <Progress value={progress.totalChunks > 0 ? (progress.currentChunk / progress.totalChunks) * 100 : 0} className="h-2 w-full max-w-xs mb-2" />
            <p className="text-xs text-muted-foreground">{progress.totalChunks > 0 ? Math.round((progress.currentChunk / progress.totalChunks) * 100) : 0}% complete</p>
            <p className="text-xs text-muted-foreground mt-4 px-4">
              ⚠️ Please do not navigate away while the lesson is being generated. Your progress may be lost.
            </p>
          </div>
        </div>
      )}

      {/* Continuous Lesson View */}
      {hasLessons && !isGenerating && (
        <div id="lesson-content-scroll" className="flex-1 overflow-y-auto">

          {/* Text Selection Toolbar */}
          <TextSelectionToolbar
            onHighlight={handleHighlight}
            onComment={handleComment}
            onAskAI={handleAskAI}
          />

          {/* Inline Comment Popover */}
          <InlineCommentPopover
            visible={commentPopover.visible}
            x={commentPopover.x}
            y={commentPopover.y}
            comment={commentPopover.comment}
            highlightedText={commentPopover.highlightedText}
            onClose={() => setCommentPopover(prev => ({ ...prev, visible: false }))}
            onEdit={handleEditComment}
          />

          {/* Main content */}
          <div className="p-4 sm:p-6 lg:p-10" onClick={handleContentClick}>
            <div className="max-w-none mx-auto space-y-6 sm:space-y-8">
              {/* Header */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="outline" className="text-primary border-primary/20 bg-primary/5 px-3">
                    Study Guide
                  </Badge>
                  {document.num_pages && (
                    <Badge variant="outline" className="text-muted-foreground">
                      {document.num_pages} pages
                    </Badge>
                  )}
                  <Badge variant="outline" className="text-primary border-primary/20 bg-primary/5 px-3">
                    ✓ Generated
                  </Badge>
                </div>
                <h1 className="text-2xl sm:text-3xl lg:text-4xl font-display font-black text-foreground leading-tight">
                  {document.file_name}
                </h1>
              </div>

              {/* Lesson Content */}
              <div className="prose prose-lg dark:prose-invert max-w-none lesson-content-area prose-headings:font-display prose-headings:font-black prose-p:leading-relaxed prose-strong:text-primary">
                {combinedContent.includes('\n\n---\n\n') ? (
                  combinedContent.split('\n\n---\n\n').map((chunk, i) => (
                    <div key={i} className="mb-12 last:mb-0">
                      {renderContent(chunk)}
                    </div>
                  ))
                ) : (
                  renderContent(combinedContent)
                )}
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Comment Modal */}
      <Dialog open={isCommentModalOpen} onOpenChange={(open) => { if (!open) handleCancelComment(); }}>
        <DialogContent className="sm:max-w-[400px] p-0 overflow-hidden border-none shadow-2xl">
          <div className="bg-primary px-6 py-4 flex items-center gap-3">
            <div className="bg-white/20 p-2 rounded-lg">
              <MessageSquarePlus className="w-5 h-5 text-white" />
            </div>
            <div>
              <DialogTitle className="text-white text-lg">Add Comment</DialogTitle>
              <DialogDescription className="text-primary-foreground/80 text-xs">
                Annotate your study material
              </DialogDescription>
            </div>
          </div>

          <div className="p-6 space-y-4 bg-background">
            {pendingCommentText && (
              <div className="space-y-1.5">
                <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Selected Text</Label>
                <div className="bg-muted/50 p-3 rounded-lg border-l-4 border-primary/30 max-h-24 overflow-y-auto">
                  <p className="text-xs text-muted-foreground italic leading-relaxed">
                    "{pendingCommentText}"
                  </p>
                </div>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="comment-input-doc" className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Your Notes</Label>
              <Textarea
                id="comment-input-doc"
                placeholder="Type your comment here..."
                value={commentInputValue}
                onChange={(e) => setCommentInputValue(e.target.value)}
                className="min-h-[100px] resize-none border-muted focus-visible:ring-primary"
                autoFocus
              />
            </div>
          </div>

          <DialogFooter className="p-4 bg-muted/30 border-t flex flex-row gap-2 sm:justify-end">
            <Button variant="ghost" size="sm" onClick={handleCancelComment} className="text-xs">
              Cancel
            </Button>
            <Button size="sm" onClick={handleSaveCommentFromModal} disabled={!commentInputValue.trim()} className="text-xs px-6 shadow-sm">
              Save Comment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
