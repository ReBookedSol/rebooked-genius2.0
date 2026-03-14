import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Highlight from '@tiptap/extension-highlight';
import Underline from '@tiptap/extension-underline';
import Placeholder from '@tiptap/extension-placeholder';
import { TextStyle } from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';
import { useCallback, useEffect, useState, useMemo } from 'react';
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Highlighter,
  List,
  ListOrdered,
  Heading1,
  Heading2,
  Heading3,
  Undo2,
  Redo2,
  MessageSquare,
  Save,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface Comment {
  id: string;
  text: string;
  selectedText: string;
  position: number;
  createdAt: string;
}

interface RichTextEditorProps {
  content: string;
  onSave: (content: string) => void;
  onClose: () => void;
  title?: string;
  onAddComment?: (selectedText: string, position: number) => void;
  comments?: Comment[];
}

// Toolbar button component
const ToolbarButton = ({
  onClick,
  active,
  disabled,
  children,
  title,
}: {
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  children: React.ReactNode;
  title: string;
}) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    title={title}
    className={cn(
      'p-2 rounded-md transition-colors',
      active
        ? 'bg-primary text-primary-foreground'
        : 'hover:bg-secondary text-foreground',
      disabled && 'opacity-50 cursor-not-allowed'
    )}
  >
    {children}
  </button>
);

// Highlight color options
const HIGHLIGHT_COLORS = [
  { name: 'Yellow', value: '#fef08a' },
  { name: 'Green', value: '#bbf7d0' },
  { name: 'Blue', value: '#bfdbfe' },
  { name: 'Pink', value: '#fbcfe8' },
  { name: 'Orange', value: '#fed7aa' },
];

export function RichTextEditor({
  content,
  onSave,
  onClose,
  title = 'Edit Content',
  onAddComment,
}: RichTextEditorProps) {
  const [hasChanges, setHasChanges] = useState(false);
  const [showHighlightPicker, setShowHighlightPicker] = useState(false);
  const [originalContent] = useState(content);

  // Helper to convert basic markdown to HTML for the editor
  const processedContent = useMemo(() => {
    if (!content) return '';

    // If it looks like HTML already, return as is
    if (content.trim().startsWith('<') && content.includes('</')) {
      return content;
    }

    // Basic Markdown to HTML conversion for better editing experience
    return content
      .split('\n')
      .map(line => {
        const trimmed = line.trim();
        if (!trimmed) return '<p><br></p>';

        // Headings
        if (line.startsWith('# ')) return `<h1>${line.substring(2)}</h1>`;
        if (line.startsWith('## ')) return `<h2>${line.substring(3)}</h2>`;
        if (line.startsWith('### ')) return `<h3>${line.substring(4)}</h3>`;

        // Lists (very basic)
        if (line.startsWith('- ') || line.startsWith('* ')) return `<li>${line.substring(2)}</li>`;

        // Bold/Italic
        let processedLine = line
          .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
          .replace(/\*(.*?)\*/g, '<em>$1</em>')
          .replace(/__(.*?)__/g, '<strong>$1</strong>')
          .replace(/_(.*?)_/g, '<em>$1</em>');

        return `<p>${processedLine}</p>`;
      })
      .join('');
  }, [content]);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
      }),
      Highlight.configure({
        multicolor: true,
      }),
      Underline,
      Placeholder.configure({
        placeholder: 'Start writing your content here...',
      }),
      TextStyle,
      Color,
    ],
    content: processedContent,
    onUpdate: ({ editor }) => {
      const currentContent = editor.getHTML();
      setHasChanges(currentContent !== originalContent);
    },
    editorProps: {
      attributes: {
        class:
          'prose prose-sm sm:prose dark:prose-invert max-w-none min-h-[400px] focus:outline-none p-4',
      },
    },
  });

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        if (hasChanges) {
          handleSave();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [hasChanges]);

  const handleSave = useCallback(() => {
    if (!editor) return;
    onSave(editor.getHTML());
    setHasChanges(false);
  }, [editor, onSave]);

  const handleReset = useCallback(() => {
    if (!editor) return;
    editor.commands.setContent(originalContent);
    setHasChanges(false);
  }, [editor, originalContent]);

  const handleAddComment = useCallback(() => {
    if (!editor || !onAddComment) return;
    const { from, to } = editor.state.selection;
    const selectedText = editor.state.doc.textBetween(from, to, ' ');
    if (selectedText.trim()) {
      onAddComment(selectedText, from);
    }
  }, [editor, onAddComment]);

  if (!editor) {
    return null;
  }

  return (
    <div className="bg-card border border-border rounded-xl shadow-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/30">
        <h3 className="font-semibold text-foreground">{title}</h3>
        <div className="flex items-center gap-2">
          {hasChanges && (
            <span className="text-xs text-amber-600 dark:text-amber-400 font-medium">
              Unsaved changes
            </span>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleReset}
            disabled={!hasChanges}
            className="gap-1"
          >
            <Undo2 className="w-4 h-4" />
            Reset
          </Button>
          <Button
            variant="default"
            size="sm"
            onClick={handleSave}
            disabled={!hasChanges}
            className="gap-1"
          >
            <Save className="w-4 h-4" />
            Save
          </Button>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-1 px-4 py-2 border-b border-border bg-background">
        {/* Text formatting */}
        <div className="flex items-center gap-0.5">
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleBold().run()}
            active={editor.isActive('bold')}
            title="Bold (Ctrl+B)"
          >
            <Bold className="w-4 h-4" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleItalic().run()}
            active={editor.isActive('italic')}
            title="Italic (Ctrl+I)"
          >
            <Italic className="w-4 h-4" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleUnderline().run()}
            active={editor.isActive('underline')}
            title="Underline (Ctrl+U)"
          >
            <UnderlineIcon className="w-4 h-4" />
          </ToolbarButton>
        </div>

        <div className="w-px h-6 bg-border mx-1" />

        {/* Headings */}
        <div className="flex items-center gap-0.5">
          <ToolbarButton
            onClick={() =>
              editor.chain().focus().toggleHeading({ level: 1 }).run()
            }
            active={editor.isActive('heading', { level: 1 })}
            title="Heading 1"
          >
            <Heading1 className="w-4 h-4" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() =>
              editor.chain().focus().toggleHeading({ level: 2 }).run()
            }
            active={editor.isActive('heading', { level: 2 })}
            title="Heading 2"
          >
            <Heading2 className="w-4 h-4" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() =>
              editor.chain().focus().toggleHeading({ level: 3 }).run()
            }
            active={editor.isActive('heading', { level: 3 })}
            title="Heading 3"
          >
            <Heading3 className="w-4 h-4" />
          </ToolbarButton>
        </div>

        <div className="w-px h-6 bg-border mx-1" />

        {/* Lists */}
        <div className="flex items-center gap-0.5">
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            active={editor.isActive('bulletList')}
            title="Bullet List"
          >
            <List className="w-4 h-4" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            active={editor.isActive('orderedList')}
            title="Numbered List"
          >
            <ListOrdered className="w-4 h-4" />
          </ToolbarButton>
        </div>

        <div className="w-px h-6 bg-border mx-1" />

        {/* Highlight */}
        <div className="relative">
          <ToolbarButton
            onClick={() => setShowHighlightPicker(!showHighlightPicker)}
            active={editor.isActive('highlight')}
            title="Highlight"
          >
            <Highlighter className="w-4 h-4" />
          </ToolbarButton>
          {showHighlightPicker && (
            <div className="absolute top-full left-0 mt-1 p-2 bg-popover border border-border rounded-lg shadow-lg flex gap-1.5 z-10">
              {HIGHLIGHT_COLORS.map((color) => (
                <button
                  key={color.value}
                  onClick={() => {
                    editor
                      .chain()
                      .focus()
                      .toggleHighlight({ color: color.value })
                      .run();
                    setShowHighlightPicker(false);
                  }}
                  className="w-6 h-6 rounded border-2 border-border hover:border-primary transition-colors"
                  style={{ backgroundColor: color.value }}
                  title={color.name}
                />
              ))}
              <button
                onClick={() => {
                  editor.chain().focus().unsetHighlight().run();
                  setShowHighlightPicker(false);
                }}
                className="w-6 h-6 rounded border-2 border-border hover:border-primary transition-colors bg-background flex items-center justify-center text-xs"
                title="Remove highlight"
              >
                ×
              </button>
            </div>
          )}
        </div>

        {/* Comment button (if handler provided) */}
        {onAddComment && (
          <>
            <div className="w-px h-6 bg-border mx-1" />
            <ToolbarButton
              onClick={handleAddComment}
              title="Add Comment"
              disabled={editor.state.selection.empty}
            >
              <MessageSquare className="w-4 h-4" />
            </ToolbarButton>
          </>
        )}

        <div className="w-px h-6 bg-border mx-1" />

        {/* Undo/Redo */}
        <div className="flex items-center gap-0.5">
          <ToolbarButton
            onClick={() => editor.chain().focus().undo().run()}
            disabled={!editor.can().undo()}
            title="Undo (Ctrl+Z)"
          >
            <Undo2 className="w-4 h-4" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().redo().run()}
            disabled={!editor.can().redo()}
            title="Redo (Ctrl+Y)"
          >
            <Redo2 className="w-4 h-4" />
          </ToolbarButton>
        </div>
      </div>


      {/* Editor Content */}
      <div className="min-h-[400px] max-h-[600px] overflow-y-auto bg-background">
        <EditorContent editor={editor} />
      </div>

      {/* Footer hint */}
      <div className="px-4 py-2 border-t border-border bg-muted/30">
        <p className="text-xs text-muted-foreground">
          <strong>Tip:</strong> Select text to see formatting options. Use{' '}
          <kbd className="px-1 py-0.5 bg-muted rounded text-xs">Ctrl+S</kbd> to
          save.
        </p>
      </div>
    </div>
  );
}

export default RichTextEditor;
