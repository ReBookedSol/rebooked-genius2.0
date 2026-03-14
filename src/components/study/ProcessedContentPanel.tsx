import { useRef, useEffect, useState, useCallback } from 'react';
import {
  Bold,
  Italic,
  Underline,
  Highlighter,
  Save,
  Copy,
  Download,
  Loader2,
  Heading1,
  Heading2,
  Heading3,
  Lightbulb,
  BookMarked,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { saveLesson } from '@/lib/lessonService';

interface StudyDocument {
  id: string;
  file_name: string;
  summary: string | null;
  processed_content: string | null;
  key_concepts: string[];
}

interface ProcessedContentPanelProps {
  document: StudyDocument | null;
  onLessonSaved?: (lessonId: string, content: string) => void;
}

const ProcessedContentPanel: React.FC<ProcessedContentPanelProps> = ({
  document: studyDoc,
  onLessonSaved
}) => {
  const { user } = useAuth();
  const editorRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [showConcepts, setShowConcepts] = useState(true);
  const [currentLessonId, setCurrentLessonId] = useState<string | undefined>();
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    if (editorRef.current && studyDoc?.processed_content) {
      editorRef.current.innerHTML = studyDoc.processed_content;
    }
  }, [studyDoc?.id, studyDoc?.processed_content]);

  const handleAutoSave = useCallback(
    async (contentToSave: string) => {
      if (!user || !studyDoc) return;

      try {
        setIsSaving(true);
        const savedLesson = await saveLesson(user.id, {
          title: studyDoc.file_name,
          content: contentToSave,
          description: `Lesson from ${studyDoc.file_name}`,
          topic: 'Study Documents',
          documentId: studyDoc.id,
          lessonId: currentLessonId,
        });

        if (savedLesson) {
          if (!currentLessonId) {
            setCurrentLessonId(savedLesson.id);
          }
          if (onLessonSaved) {
            onLessonSaved(savedLesson.id, contentToSave);
          }
        }

        toast({
          title: 'Auto-saved',
          description: 'Your lesson has been saved',
        });
        setHasChanges(false);
      } catch (error) {
        console.error('Auto-save error:', error);
        toast({
          title: 'Auto-save failed',
          description: 'Could not save your lesson automatically',
          variant: 'destructive',
        });
      } finally {
        setIsSaving(false);
      }
    },
    [user, studyDoc, currentLessonId, toast, onLessonSaved]
  );

  const handleInput = (e: React.FormEvent<HTMLDivElement>) => {
    setHasChanges(true);

    // Clear existing timeout
    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
    }

    // Set new auto-save timeout (3 seconds of inactivity)
    autoSaveTimeoutRef.current = setTimeout(() => {
      const contentToSave = e.currentTarget.innerHTML;
      handleAutoSave(contentToSave);
    }, 3000);
  };

  const handleSave = async () => {
    const contentToSave = editorRef.current?.innerHTML || '';
    await handleAutoSave(contentToSave);
  };

  useEffect(() => {
    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
    };
  }, []);

  const handleCopy = () => {
    const text = editorRef.current?.innerText || '';
    navigator.clipboard.writeText(text).then(() => {
      toast({
        title: 'Copied',
        description: 'Content copied to clipboard',
      });
    });
  };

  const handleDownload = () => {
    const text = editorRef.current?.innerText || '';
    const element = window.document.createElement('a');
    element.setAttribute(
      'href',
      'data:text/plain;charset=utf-8,' + encodeURIComponent(text)
    );
    element.setAttribute('download', `${studyDoc?.file_name || 'document'}.txt`);
    element.style.display = 'none';
    window.document.body.appendChild(element);
    element.click();
    window.document.body.removeChild(element);

    toast({
      title: 'Downloaded',
      description: 'Document downloaded as text file',
    });
  };

  const applyFormatting = (command: string, value?: string) => {
    window.document.execCommand(command, false, value);
    editorRef.current?.focus();
  };

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="border-b border-border p-3 bg-muted flex items-center justify-between">
        <div className="flex-1">
          <h2 className="text-sm font-semibold text-foreground">
            {studyDoc?.file_name || 'Document'}
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            AI-processed content with key concepts
          </p>
        </div>
        {hasChanges && (
          <span className="text-xs text-amber-600 dark:text-amber-400">Unsaved changes</span>
        )}
      </div>

      {/* Key Concepts Bar */}
      {studyDoc?.key_concepts && studyDoc.key_concepts.length > 0 && (
        <div className="border-b border-border p-3 bg-primary/5 max-h-24 overflow-y-auto">
          <div className="flex items-start gap-2">
            <Lightbulb className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-xs font-semibold text-foreground mb-2">Key Concepts:</p>
              <div className="flex flex-wrap gap-2">
                {studyDoc.key_concepts.map((concept, idx) => (
                  <Badge key={idx} variant="secondary" className="text-xs cursor-default">
                    {concept}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Summary Box */}
      {studyDoc?.summary && (
        <div className="border-b border-border p-4 bg-muted/50">
          <div className="flex items-start gap-3">
            <BookMarked className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-foreground mb-2">Summary</h3>
              <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                {studyDoc.summary}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Toolbar */}
      <div className="border-b border-border p-2 bg-muted flex items-center gap-1 flex-wrap">
        <div className="flex items-center gap-1 border-r border-border pr-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => applyFormatting('formatBlock', '<h1>')}
            className="h-8 w-8 p-0"
            title="Heading 1"
          >
            <Heading1 className="w-4 h-4" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => applyFormatting('formatBlock', '<h2>')}
            className="h-8 w-8 p-0"
            title="Heading 2"
          >
            <Heading2 className="w-4 h-4" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => applyFormatting('formatBlock', '<h3>')}
            className="h-8 w-8 p-0"
            title="Heading 3"
          >
            <Heading3 className="w-4 h-4" />
          </Button>
        </div>

        <div className="flex items-center gap-1 border-r border-border px-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => applyFormatting('bold')}
            className="h-8 w-8 p-0"
            title="Bold (Ctrl+B)"
          >
            <Bold className="w-4 h-4" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => applyFormatting('italic')}
            className="h-8 w-8 p-0"
            title="Italic (Ctrl+I)"
          >
            <Italic className="w-4 h-4" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => applyFormatting('underline')}
            className="h-8 w-8 p-0"
            title="Underline (Ctrl+U)"
          >
            <Underline className="w-4 h-4" />
          </Button>
        </div>

        <div className="flex items-center gap-1 border-r border-border px-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => applyFormatting('backColor', '#FFFF00')}
            className="h-8 w-8 p-0"
            title="Highlight"
          >
            <Highlighter className="w-4 h-4" />
          </Button>
        </div>

        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant="ghost"
            onClick={handleCopy}
            className="h-8 w-8 p-0"
            title="Copy"
          >
            <Copy className="w-4 h-4" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={handleDownload}
            className="h-8 w-8 p-0"
            title="Download"
          >
            <Download className="w-4 h-4" />
          </Button>
        </div>

        <div className="ml-auto flex items-center gap-1">
          {hasChanges && (
            <Button
              size="sm"
              onClick={handleSave}
              disabled={isSaving}
              className="gap-2"
            >
              {isSaving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              Save
            </Button>
          )}
        </div>
      </div>

      {/* Editor Content Area - Full WYSIWYG */}
      <div className="flex-1 overflow-auto bg-white dark:bg-slate-950 flex flex-col">
        <div className="flex-1 w-full h-full overflow-auto">
          <div className="w-full h-full max-w-5xl mx-auto p-8 md:p-12">
            <div
              ref={editorRef}
              contentEditable
              suppressContentEditableWarning
              onInput={handleInput}
              className="w-full min-h-full prose prose-base dark:prose-invert max-w-none focus:outline-none
                text-foreground leading-relaxed
                [&_p]:my-4 [&_p]:text-base [&_h1]:text-4xl [&_h1]:font-bold [&_h1]:my-8
                [&_h2]:text-3xl [&_h2]:font-bold [&_h2]:my-6
                [&_h3]:text-2xl [&_h3]:font-semibold [&_h3]:my-4
                [&_ul]:list-disc [&_ul]:ml-8 [&_ul]:my-4
                [&_ol]:list-decimal [&_ol]:ml-8 [&_ol]:my-4
                [&_li]:my-2 [&_li]:text-base
                [&_blockquote]:border-l-4 [&_blockquote]:border-primary [&_blockquote]:pl-6 [&_blockquote]:italic [&_blockquote]:my-4
                [&_mark]:bg-yellow-200 [&_mark]:dark:bg-yellow-800
                [&_code]:bg-muted [&_code]:px-2 [&_code]:py-1 [&_code]:rounded [&_code]:text-sm
                [&_pre]:bg-muted [&_pre]:p-4 [&_pre]:rounded [&_pre]:overflow-x-auto [&_pre]:my-4
              "
            >
              {!studyDoc?.processed_content && (
                <p className="text-muted-foreground italic text-lg">
                  Processing your document... The AI is reading, summarizing, and extracting key concepts. This will be available shortly.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Footer with stats */}
      <div className="border-t border-border p-3 bg-muted text-xs text-muted-foreground">
        <div className="flex items-center justify-between">
          <span>
            {editorRef.current?.innerText.split(/\s+/).filter((w) => w.length > 0)
              .length || 0}{' '}
            words
          </span>
          <span>
            {editorRef.current?.innerText.length || 0} characters
          </span>
        </div>
      </div>
    </div>
  );
};

export default ProcessedContentPanel;
