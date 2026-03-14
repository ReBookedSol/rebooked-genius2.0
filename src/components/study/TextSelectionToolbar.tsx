import { useState, useEffect, useRef, useCallback } from 'react';
import { MessageSquare, Highlighter, Zap, Edit2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { clearSelection } from '@/lib/textSelectionUtils';

interface TextSelectionToolbarProps {
  onComment: (text: string) => void;
  onHighlight: (text: string, color: string) => void;
  onAskAI: (text: string) => void;
  onEdit?: (text: string) => void;
}

const TextSelectionToolbar: React.FC<TextSelectionToolbarProps> = ({
  onComment,
  onHighlight,
  onAskAI,
  onEdit,
}) => {
  const [position, setPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [selectedText, setSelectedText] = useState<string>('');
  const [showHighlightPicker, setShowHighlightPicker] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const selectionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const highlightColors = [
    { name: 'Yellow', value: 'rgba(255, 255, 0, 0.4)' },
    { name: 'Green', value: 'rgba(0, 255, 0, 0.3)' },
    { name: 'Blue', value: 'rgba(135, 206, 235, 0.4)' },
    { name: 'Pink', value: 'rgba(255, 182, 193, 0.4)' },
    { name: 'Orange', value: 'rgba(255, 165, 0, 0.3)' },
  ];

  const checkSelection = useCallback(() => {
    if (selectionTimeoutRef.current) {
      clearTimeout(selectionTimeoutRef.current);
    }

    selectionTimeoutRef.current = setTimeout(() => {
      const selection = window.getSelection();
      if (!selection || selection.isCollapsed || selection.toString().trim().length === 0) {
        return;
      }

      // Check if selection is within lesson content area
      let anchorNode = selection.anchorNode;
      let isWithinLessonArea = false;

      while (anchorNode) {
        if (anchorNode instanceof HTMLElement && anchorNode.classList.contains('lesson-content-area')) {
          isWithinLessonArea = true;
          break;
        }
        anchorNode = anchorNode.parentNode;
      }

      if (!isWithinLessonArea) {
        return;
      }

      const text = selection.toString().trim();
      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();

      // Position toolbar above or below the selection
      const shouldBeAbove = rect.top > 100;
      const toolbarWidth = 220;
      const centeredX = Math.max(8, rect.left + rect.width / 2 - toolbarWidth / 2);
      const yPos = shouldBeAbove ? rect.top - 50 : rect.bottom + 10;

      setSelectedText(text);
      setPosition({
        x: Math.min(centeredX, window.innerWidth - toolbarWidth - 8),
        y: yPos,
      });
      setIsVisible(true);
    }, 50);
  }, []);

  useEffect(() => {
    const handleMouseUp = () => {
      checkSelection();
    };

    const handleTouchEnd = () => {
      // Longer delay for touch to let selection finalize
      setTimeout(() => checkSelection(), 200);
    };

    document.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('touchend', handleTouchEnd);

    return () => {
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('touchend', handleTouchEnd);
      if (selectionTimeoutRef.current) {
        clearTimeout(selectionTimeoutRef.current);
      }
    };
  }, [checkSelection]);

  // Close toolbar when clicking outside
  useEffect(() => {
    const handleMouseDown = (event: MouseEvent) => {
      if (
        toolbarRef.current &&
        !toolbarRef.current.contains(event.target as Node)
      ) {
        setTimeout(() => {
          const selection = window.getSelection();
          if (!selection || selection.isCollapsed || selection.toString().trim().length === 0) {
            setSelectedText('');
            setShowHighlightPicker(false);
            setIsVisible(false);
          }
        }, 200);
      }
    };

    if (selectedText) {
      document.addEventListener('mousedown', handleMouseDown);
      return () => document.removeEventListener('mousedown', handleMouseDown);
    }
  }, [selectedText]);

  const hideToolbar = () => {
    setSelectedText('');
    setShowHighlightPicker(false);
    setIsVisible(false);
  };

  if (!isVisible || !selectedText || selectedText.length === 0) {
    return null;
  }

  return (
    <div
      ref={toolbarRef}
      className="fixed bg-background dark:bg-card rounded-lg shadow-xl border border-border p-1.5 z-[100] flex items-center gap-0.5 backdrop-blur-sm"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        pointerEvents: 'auto',
      }}
    >
      {/* Comment Button */}
      <Button
        size="sm"
        variant="ghost"
        className="h-8 w-8 p-0"
        title="Add Comment"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          const text = selectedText;
          hideToolbar();
          onComment(text);
        }}
      >
        <MessageSquare className="w-4 h-4 text-blue-500" />
      </Button>

      {/* Highlight Button with Dropdown */}
      <div className="relative">
        <Button
          size="sm"
          variant="ghost"
          className="h-8 w-8 p-0"
          title="Highlight"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setShowHighlightPicker(!showHighlightPicker);
          }}
        >
          <Highlighter className="w-4 h-4 text-yellow-500" />
        </Button>

        {showHighlightPicker && (
          <div className="absolute top-full mt-1 left-0 bg-background dark:bg-card rounded-lg shadow-xl border border-border p-2 flex gap-2 z-[101]">
            {highlightColors.map((color) => (
              <button
                key={color.value}
                className="w-7 h-7 rounded-full border-2 border-border hover:border-foreground transition-all hover:scale-110"
                style={{ backgroundColor: color.value }}
                title={color.name}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  const text = selectedText;
                  onHighlight(text, color.value);
                  hideToolbar();
                }}
              />
            ))}
          </div>
        )}
      </div>

      {/* Ask AI Button */}
      <Button
        size="sm"
        variant="ghost"
        className="h-8 w-8 p-0"
        title="Ask AI about this"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          const text = selectedText;
          hideToolbar();
          clearSelection();
          onAskAI(text);
        }}
      >
        <Zap className="w-4 h-4 text-purple-500" />
      </Button>

      {/* Edit Button */}
      {onEdit && (
        <Button
          size="sm"
          variant="ghost"
          className="h-8 w-8 p-0"
          title="Edit this text"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            const text = selectedText;
            hideToolbar();
            clearSelection();
            onEdit(text);
          }}
        >
          <Edit2 className="w-4 h-4 text-green-500" />
        </Button>
      )}

      {/* Close Button */}
      <Button
        size="sm"
        variant="ghost"
        className="h-8 w-8 p-0"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          hideToolbar();
          clearSelection();
        }}
      >
        <X className="w-3 h-3 text-muted-foreground" />
      </Button>
    </div>
  );
};

export default TextSelectionToolbar;
