import { ChevronDown, ChevronUp, CheckCircle2, AlertCircle, Loader2, Edit3, X, FileDown, MessageSquarePlus, Lock } from 'lucide-react';
import { GeneratedLesson } from '@/contexts/LessonGenerationContext';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { RichTextEditor } from '@/components/study/RichTextEditor';
import TextSelectionToolbar from '@/components/study/TextSelectionToolbar';
import { highlightSelectedText, removeAllHighlights } from '@/lib/textSelectionUtils';
import { useToast } from '@/hooks/use-toast';
import { useSubscription } from '@/hooks/useSubscription';
import { cn } from '@/lib/utils';
import { extractMainHeading, stripMarkdownCodeBlocks } from '@/lib/markdownUtils';
import { exportLessonToPDF, exportAllLessonsToPDF } from '@/lib/lessonPDFExport';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import DOMPurify from 'dompurify';
import { memo, useState, useCallback } from 'react';

interface LessonViewerProps {
  lessons: GeneratedLesson[];
  onUpdateLesson?: (chunkNumber: number, content: string) => void;
  onAskAI?: (selectedText: string, lessonContext: string) => void;
}

interface LessonCardProps {
  lesson: GeneratedLesson;
  isExpanded: boolean;
  inlineEditingLesson: number | null;
  onToggle: (chunkNumber: number) => void;
  onStartInlineEdit: (chunkNumber: number, content: string) => void;
  onSaveInlineEdit: (chunkNumber: number, content: string) => void;
  onCancelInlineEdit: () => void;
  onUpdateTitle: (chunkNumber: number, newTitle: string) => void;
  onExportPDF: (chunkNumber: number, content: string) => void;
  onMouseUp: (lesson: GeneratedLesson) => void;
  onClickComment?: (comment: string, element: HTMLElement) => void;
  isFreeTier?: boolean;
}

// Memoized LessonCard component to prevent unnecessary re-renders
const LessonCard = memo(({
  lesson,
  isExpanded,
  inlineEditingLesson,
  onToggle,
  onStartInlineEdit,
  onSaveInlineEdit,
  onCancelInlineEdit,
  onUpdateTitle,
  onExportPDF,
  onMouseUp,
  onClickComment,
  isFreeTier = false,
}: LessonCardProps) => {

  const isHTML = (content: string) => {
    return content.trim().startsWith('<') && content.includes('</');
  };

  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [tempTitle, setTempTitle] = useState('');

  const handleStartEditTitle = (e: React.MouseEvent) => {
    e.stopPropagation();
    setTempTitle(extractMainHeading(lesson.content) || `Lesson ${lesson.chunkNumber}`);
    setIsEditingTitle(true);
  };

  const handleSaveTitle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (tempTitle.trim()) {
      onUpdateTitle(lesson.chunkNumber, tempTitle.trim());
    }
    setIsEditingTitle(false);
  };

  const handleCancelTitle = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsEditingTitle(false);
  };

  return (
    <Card
      key={lesson.chunkNumber}
      data-chunk-number={lesson.chunkNumber}
      className={cn(
        'transition-all duration-300 overflow-hidden',
        lesson.status === 'completed'
          ? 'shadow-card'
          : lesson.status === 'error'
          ? 'border-2 border-destructive/70 bg-destructive/5'
          : 'opacity-60'
      )}
    >
      <CardHeader
        className={cn(
          'cursor-pointer transition-colors py-3 px-3 sm:px-6',
          lesson.status === 'completed' && 'hover:bg-muted/50',
          lesson.status === 'error' && 'bg-destructive/10'
        )}
        onClick={(e) => {
          if ((e.target as HTMLElement).closest('button')) return;
          if (lesson.status === 'completed') {
            onToggle(lesson.chunkNumber);
          }
        }}
      >
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
            {lesson.status === 'completed' ? (
              <CheckCircle2 className="h-4 w-4 sm:h-5 sm:w-5 text-green-600 dark:text-green-500 flex-shrink-0" />
            ) : lesson.status === 'processing' ? (
              <Loader2 className="h-4 w-4 sm:h-5 sm:w-5 text-blue-500 animate-spin flex-shrink-0" />
            ) : lesson.status === 'error' ? (
              <AlertCircle className="h-4 w-4 sm:h-5 sm:w-5 text-destructive flex-shrink-0" />
            ) : null}
            <div className="flex flex-col gap-0.5 min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="font-medium text-foreground text-sm sm:text-base truncate">
                  Lesson {lesson.chunkNumber}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-muted-foreground hover:text-primary"
                  onClick={handleStartEditTitle}
                >
                  <Edit3 className="h-3 w-3" />
                </Button>
              </div>
              {lesson.status === 'completed' && lesson.content && (
                <div className="flex items-center gap-2 min-w-0" onClick={e => e.stopPropagation()}>
                  {isEditingTitle ? (
                    <div className="flex items-center gap-1 w-full max-w-sm">
                      <Input
                        value={tempTitle}
                        onChange={(e) => setTempTitle(e.target.value)}
                        className="h-7 text-xs py-1"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleSaveTitle(e as any);
                          if (e.key === 'Escape') handleCancelTitle(e as any);
                        }}
                      />
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-green-600" onClick={handleSaveTitle}>
                        <CheckCircle2 className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={handleCancelTitle}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground truncate italic">
                      {extractMainHeading(lesson.content) || 'Untitled'}
                    </span>
                  )}
                </div>
              )}
            </div>
            {lesson.status === 'error' && (
              <span className="text-xs font-semibold px-2 py-1 rounded bg-destructive/20 text-destructive flex-shrink-0">
                Failed
              </span>
            )}
          </div>
          <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
            {lesson.status === 'completed' && (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    onStartInlineEdit(lesson.chunkNumber, lesson.content);
                  }}
                  className="text-muted-foreground hover:text-primary"
                  title="Edit lesson"
                >
                  <Edit3 className="h-4 w-4" />
                </Button>
                {!isFreeTier && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      onExportPDF(lesson.chunkNumber, lesson.content);
                    }}
                    className="text-muted-foreground hover:text-primary relative group/export"
                    title="Export as PDF"
                  >
                    <FileDown className="h-4 w-4" />
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggle(lesson.chunkNumber);
                  }}
                  className="flex-shrink-0"
                  aria-label={isExpanded ? 'Collapse lesson' : 'Expand lesson'}
                >
                  {isExpanded ? (
                    <ChevronUp className="h-5 w-5" />
                  ) : (
                    <ChevronDown className="h-5 w-5" />
                  )}
                </Button>
              </>
            )}
          </div>
        </div>
        {lesson.status === 'error' && lesson.error && (
          <div className="mt-3 p-2 bg-destructive/10 border border-destructive/30 rounded text-sm text-destructive">
            <p className="font-semibold mb-1">Generation Error</p>
            <p className="text-xs">{lesson.error}</p>
          </div>
        )}
      </CardHeader>

      {lesson.status === 'completed' && isExpanded && (
        <CardContent className="pt-0 pb-4 px-2 sm:px-4">
          {inlineEditingLesson === lesson.chunkNumber ? (
            <div className="border-t border-border pt-4">
              <RichTextEditor
                content={lesson.content}
                onSave={(content) => onSaveInlineEdit(lesson.chunkNumber, content)}
                onClose={onCancelInlineEdit}
                title={`Edit Lesson ${lesson.chunkNumber}`}
              />
            </div>
          ) : (
            <div
              className="prose prose-sm sm:prose dark:prose-invert max-w-none prose-a:text-primary border-t border-border pt-4 select-text lesson-content-area"
              onMouseUp={() => onMouseUp(lesson)}
              onClick={(e) => {
                const target = e.target as HTMLElement;
                const commentSpan = target.closest('.has-comment') as HTMLElement;
                if (commentSpan) {
                  const comment = commentSpan.getAttribute('data-comment');
                  if (comment && comment !== 'PENDING_COMMENT') {
                    onClickComment?.(comment, commentSpan);
                  }
                }
              }}
            >
              {lesson.content ? (
                isHTML(lesson.content) ? (
                  <div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(lesson.content, {
                    ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'u', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'span', 'mark', 'a', 'blockquote', 'pre', 'code', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'div', 'hr', 'img', 'sup', 'sub'],
                    ALLOWED_ATTR: ['class', 'style', 'href', 'target', 'rel', 'src', 'alt', 'width', 'height', 'data-highlight-color', 'data-comment', 'data-chunk-number'],
                  }) }} />
                ) : (
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {stripMarkdownCodeBlocks(lesson.content)}
                  </ReactMarkdown>
                )
              ) : (
                <p className="text-muted-foreground italic">No content available</p>
              )}
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
});

LessonCard.displayName = 'LessonCard';

export function LessonViewer({ lessons, onUpdateLesson, onAskAI }: LessonViewerProps) {
  const { toast } = useToast();
  const { tier } = useSubscription();
  const isFreeTier = tier === 'free';
  const completedLessons = lessons.filter((l) => l.status === 'completed');
  const [expandedLessons, setExpandedLessons] = useState<Set<number>>(new Set([1]));
  const [editingLesson, setEditingLesson] = useState<number | null>(null);
  const [inlineEditingLesson, setInlineEditingLesson] = useState<number | null>(null);
  const [_selectedText, setSelectedText] = useState<string>('');
  const [selectedLessonContext, setSelectedLessonContext] = useState<string>('');
  const [activeChunkNumber, setActiveChunkNumber] = useState<number | null>(null);
  const [viewingComment, setViewingComment] = useState<string | null>(null);
  const [isViewCommentOpen, setIsViewCommentOpen] = useState(false);
  const [isEditingComment, setIsEditingComment] = useState(false);
  const [editingCommentValue, setEditingCommentValue] = useState('');
  const [activeCommentElement, setActiveCommentElement] = useState<HTMLElement | null>(null);

  // Comment Modal State
  const [isCommentModalOpen, setIsCommentModalOpen] = useState(false);
  const [commentInputValue, setCommentInputValue] = useState('');
  const [targetHighlightedText, setTargetHighlightedText] = useState('');

  const toggleLesson = useCallback((chunkNumber: number) => {
    setExpandedLessons((prev) => {
      const next = new Set(prev);
      if (next.has(chunkNumber)) {
        next.delete(chunkNumber);
      } else {
        next.add(chunkNumber);
      }
      return next;
    });
  }, []);

  const expandAll = useCallback(() => {
    setExpandedLessons(new Set(lessons.map((l) => l.chunkNumber)));
  }, [lessons]);

  const collapseAll = useCallback(() => {
    setExpandedLessons(new Set());
  }, []);

  const handleEditSave = (chunkNumber: number, content: string) => {
    if (onUpdateLesson) {
      onUpdateLesson(chunkNumber, content);
    }
    setEditingLesson(null);
  };

  const handleComment = (text: string) => {
    setTargetHighlightedText(text);
    setCommentInputValue('');

    // Apply a temporary comment highlight while selection is active
    highlightSelectedText('', true, 'PENDING_COMMENT');

    // Immediately capture the HTML and update state so it persists
    if (activeChunkNumber !== null && onUpdateLesson) {
      const element = document.querySelector(`[data-chunk-number="${activeChunkNumber}"] .lesson-content-area`);
      if (element) {
        const newHTML = element.innerHTML;
        const currentLesson = lessons.find(l => l.chunkNumber === activeChunkNumber);
        const wasHTML = currentLesson && currentLesson.content.trim().startsWith('<') && currentLesson.content.includes('</');

        if (!wasHTML) {
          removeAllHighlights(element as HTMLElement);
        }
        onUpdateLesson(activeChunkNumber, newHTML);
      }
    }

    setIsCommentModalOpen(true);
  };

  const handleSaveComment = () => {
    if (commentInputValue.trim()) {
      // Update the DOM and persist the actual comment text
      if (activeChunkNumber !== null && onUpdateLesson) {
        const element = document.querySelector(`[data-chunk-number="${activeChunkNumber}"] .lesson-content-area`);
        if (element) {
          const pendingSpan = element.querySelector('span[data-comment="PENDING_COMMENT"]');
          if (pendingSpan) {
            pendingSpan.setAttribute('data-comment', commentInputValue.trim());
            onUpdateLesson(activeChunkNumber, element.innerHTML);
          }
        }
      }

      toast({
        title: 'Comment added',
        description: 'Your comment has been saved.',
      });
      setIsCommentModalOpen(false);
    }
  };

  const handleHighlight = (text: string, color: string) => {
    // Apply the visual highlight (modifies DOM)
    highlightSelectedText(color);

    // After highlighting, we need to save the updated content
    if (activeChunkNumber !== null && onUpdateLesson) {
      // Find the element for this chunk
      const element = document.querySelector(`[data-chunk-number="${activeChunkNumber}"] .lesson-content-area`);
      if (element) {
        // Capture the HTML content with the new highlight
        const newHTML = element.innerHTML;

        // Determine if it was already HTML or rendered via ReactMarkdown
        const currentLesson = lessons.find(l => l.chunkNumber === activeChunkNumber);
        const wasHTML = currentLesson && currentLesson.content.trim().startsWith('<') && currentLesson.content.includes('</');

        // IMPORTANT: If it was rendered via ReactMarkdown, we must revert the DOM modification
        // before React tries to re-render, otherwise React's fine-grained DOM reconciliation
        // will crash with "removeChild: The node to be removed is not a child of this node"
        // because we moved/wrapped its children.
        if (!wasHTML) {
          removeAllHighlights(element as HTMLElement);
        }

        // Update state with the new HTML. The next render will use dangerouslySetInnerHTML
        onUpdateLesson(activeChunkNumber, newHTML);
      }
    }

    toast({
      title: 'Highlighted',
      description: `Text highlighted in lesson`,
    });
  };

  const handleAskAI = useCallback((text: string) => {
    // Open AI chat toggle with preloaded prompt about the selected text
    const prompt = `Can you please further elaborate on this?\n\n"${text}"`;
    window.dispatchEvent(new CustomEvent('openFlashcardExplanation', {
      detail: { prompt }
    }));
    if (onAskAI) {
      onAskAI(text, selectedLessonContext);
    }
  }, [onAskAI, selectedLessonContext]);

  const handleSaveCommentEdit = () => {
    if (activeCommentElement && editingCommentValue.trim() && activeChunkNumber !== null && onUpdateLesson) {
      // Update the attribute on the stored element
      activeCommentElement.setAttribute('data-comment', editingCommentValue.trim());

      // Get the full HTML content of the lesson area to persist it
      const element = document.querySelector(`[data-chunk-number="${activeChunkNumber}"] .lesson-content-area`);
      if (element) {
        onUpdateLesson(activeChunkNumber, element.innerHTML);
      }

      setViewingComment(editingCommentValue.trim());
      setIsEditingComment(false);
      toast({
        title: 'Comment updated',
        description: 'Your changes have been saved.',
      });
    }
  };

  const handleStartInlineEdit = (chunkNumber: number, content: string) => {
    setInlineEditingLesson(chunkNumber);
  };

  const handleSaveInlineEdit = (chunkNumber: number, content: string) => {
    if (onUpdateLesson) {
      onUpdateLesson(chunkNumber, content);
    }
    setInlineEditingLesson(null);
    toast({
      title: 'Lesson saved',
      description: 'Your changes have been saved',
    });
  };

  const handleCancelInlineEdit = () => {
    setInlineEditingLesson(null);
  };

  const handleUpdateLessonTitle = useCallback((chunkNumber: number, newTitle: string) => {
    const lesson = lessons.find(l => l.chunkNumber === chunkNumber);
    if (!lesson || !onUpdateLesson) return;

    // Replace or add the main heading in the content
    let content = lesson.content;
    const headingMatch = content.match(/^(#{1,2})\s+(.+)$/m);

    if (headingMatch) {
      // Replace existing heading
      content = content.replace(/^(#{1,2})\s+(.+)$/m, `$1 ${newTitle}`);
    } else {
      // Add heading at the top
      content = `# ${newTitle}\n\n${content}`;
    }

    onUpdateLesson(chunkNumber, content);
    toast({
      title: 'Title updated',
      description: `Lesson title changed to "${newTitle}"`,
    });
  }, [lessons, onUpdateLesson, toast]);

  const handleExportLessonPDF = async (chunkNumber: number, _content: string) => {
    if (isFreeTier) {
      toast({
        title: 'Premium Feature',
        description: 'Exporting lessons as PDF is only available for Pro users. Upgrade now to unlock!',
        variant: 'default',
      });
      return;
    }

    try {
      const lesson = lessons.find((l) => l.chunkNumber === chunkNumber);
      if (!lesson) return;

      toast({
        title: 'Generating PDF...',
        description: 'Please wait while your lesson is being converted to PDF',
      });

      await exportLessonToPDF(lesson, `lesson-${chunkNumber}.pdf`);

      toast({
        title: 'PDF Downloaded',
        description: `Lesson ${chunkNumber} has been exported as PDF`,
      });
    } catch (error) {
      console.error('Error exporting lesson:', error);
      toast({
        title: 'Export Failed',
        description: 'Failed to export lesson. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const handleExportAllLessonsPDF = async () => {
    if (isFreeTier) {
      toast({
        title: 'Premium Feature',
        description: 'Exporting all lessons as PDF is only available for Pro users. Upgrade now to unlock!',
        variant: 'default',
      });
      return;
    }

    try {
      if (completedLessons.length === 0) {
        toast({
          title: 'No Lessons',
          description: 'There are no completed lessons to export',
          variant: 'destructive',
        });
        return;
      }

      toast({
        title: 'Generating PDF...',
        description: 'Please wait while all lessons are being converted to PDF',
      });

      await exportAllLessonsToPDF(lessons, 'all-lessons.pdf');

      toast({
        title: 'PDF Downloaded',
        description: `All ${completedLessons.length} lessons have been exported as PDF`,
      });
    } catch (error) {
      console.error('Error exporting all lessons:', error);
      toast({
        title: 'Export Failed',
        description: 'Failed to export lessons. Please try again.',
        variant: 'destructive',
      });
    }
  };

  if (completedLessons.length === 0) {
    return null;
  }

  // The modal-style editor is no longer used, replaced by inline RichTextEditor
  // But we'll keep the logic if needed for a separate editing page in the future
  if (editingLesson !== null) {
    const lessonToEdit = lessons.find((l) => l.chunkNumber === editingLesson);
    if (lessonToEdit) {
      return (
        <RichTextEditor
          content={lessonToEdit.content}
          onSave={(content) => handleEditSave(editingLesson, content)}
          onClose={() => setEditingLesson(null)}
          title={`Edit Lesson ${lessonToEdit.chunkNumber}`}
        />
      );
    }
  }

  return (
    <div className="w-full animate-fade-in">
      {/* Main Lesson Content */}
      <div className="w-full">
        {/* Text Selection Toolbar */}
        <TextSelectionToolbar
          onComment={handleComment}
          onHighlight={handleHighlight}
          onAskAI={handleAskAI}
        />

        <div className="space-y-4 p-2 sm:p-4 lg:p-6">
          <div className="flex justify-between items-center flex-wrap gap-2">
            <h2 className="text-2xl font-semibold text-foreground">
              Lessons
            </h2>
            <div className="flex gap-2 flex-wrap">
              <Button variant="outline" size="sm" onClick={expandAll}>
                Expand All
              </Button>
              <Button variant="outline" size="sm" onClick={collapseAll}>
                Collapse All
              </Button>
              {!isFreeTier && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExportAllLessonsPDF}
                  className="gap-2 relative"
                >
                  <FileDown className="h-4 w-4" />
                  Export All as PDF
                </Button>
              )}
            </div>
          </div>

          <div className="space-y-3">
            {lessons.map((lesson) => {
              const isExpanded = expandedLessons.has(lesson.chunkNumber);

              return (
                <LessonCard
                  key={lesson.chunkNumber}
                  lesson={lesson}
                  isExpanded={isExpanded}
                  inlineEditingLesson={inlineEditingLesson}
                  onToggle={toggleLesson}
                  onStartInlineEdit={handleStartInlineEdit}
                  onSaveInlineEdit={handleSaveInlineEdit}
                  onCancelInlineEdit={handleCancelInlineEdit}
                  onUpdateTitle={handleUpdateLessonTitle}
                  onExportPDF={handleExportLessonPDF}
                  isFreeTier={isFreeTier}
                  onMouseUp={(lesson) => {
                    try {
                      const selection = window.getSelection();
                      if (selection && selection.toString().length > 0) {
                        setSelectedLessonContext(lesson.content);
                        setSelectedText(selection.toString());
                        setActiveChunkNumber(lesson.chunkNumber);
                      }
                    } catch (error) {
                      console.error('Error handling text selection:', error);
                    }
                  }}
                  onClickComment={(comment, element) => {
                    setViewingComment(comment);
                    setEditingCommentValue(comment);
                    setActiveCommentElement(element);
                    setActiveChunkNumber(lesson.chunkNumber);
                    setIsViewCommentOpen(true);
                    setIsEditingComment(false);
                  }}
                />
              );
            })}
          </div>
        </div>
      </div>

      {/* Comment Modal */}
      <Dialog open={isCommentModalOpen} onOpenChange={setIsCommentModalOpen}>
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
            {targetHighlightedText && (
              <div className="space-y-1.5">
                <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Selected Text</Label>
                <div className="bg-muted/50 p-3 rounded-lg border-l-4 border-primary/30 max-h-24 overflow-y-auto">
                  <p className="text-xs text-muted-foreground italic leading-relaxed">
                    "{targetHighlightedText}"
                  </p>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="comment-input" className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Your Notes</Label>
              <Textarea
                id="comment-input"
                placeholder="Type your comment here..."
                value={commentInputValue}
                onChange={(e) => setCommentInputValue(e.target.value)}
                className="min-h-[100px] resize-none border-muted focus-visible:ring-primary"
                autoFocus
              />
            </div>
          </div>

          <DialogFooter className="p-4 bg-muted/30 border-t flex flex-row gap-2 sm:justify-end">
            <Button variant="ghost" size="sm" onClick={() => setIsCommentModalOpen(false)} className="text-xs">
              Cancel
            </Button>
            <Button size="sm" onClick={handleSaveComment} disabled={!commentInputValue.trim()} className="text-xs px-6 shadow-sm">
              Save Comment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* View Comment Dialog */}
      <Dialog open={isViewCommentOpen} onOpenChange={(open) => {
        setIsViewCommentOpen(open);
        if (!open) setIsEditingComment(false);
      }}>
        <DialogContent className="sm:max-w-[400px] p-0 overflow-hidden border-none shadow-2xl">
          <div className="bg-primary px-6 py-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="bg-white/20 p-2 rounded-lg">
                <MessageSquarePlus className="w-5 h-5 text-white" />
              </div>
              <DialogTitle className="text-white text-lg">Your Note</DialogTitle>
            </div>
            {!isEditingComment && (
              <Button
                variant="ghost"
                size="icon"
                className="text-white hover:bg-white/20 h-8 w-8"
                onClick={() => setIsEditingComment(true)}
              >
                <Edit3 className="h-4 w-4" />
              </Button>
            )}
          </div>
          <div className="p-6 bg-background">
            {isEditingComment ? (
              <div className="space-y-4">
                <Textarea
                  value={editingCommentValue}
                  onChange={(e) => setEditingCommentValue(e.target.value)}
                  className="min-h-[120px] resize-none focus-visible:ring-primary"
                  autoFocus
                />
                <div className="flex justify-end gap-2">
                  <Button variant="ghost" size="sm" onClick={() => setIsEditingComment(false)}>
                    Cancel
                  </Button>
                  <Button size="sm" onClick={handleSaveCommentEdit}>
                    Save Changes
                  </Button>
                </div>
              </div>
            ) : (
              <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
                {viewingComment}
              </p>
            )}
          </div>
          {!isEditingComment && (
            <DialogFooter className="p-4 bg-muted/30 border-t">
              <Button size="sm" onClick={() => setIsViewCommentOpen(false)} className="text-xs px-6 shadow-sm">
                Close
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
