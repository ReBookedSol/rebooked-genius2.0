import { useRef, useEffect, useState } from 'react';
import { MessageSquare, X, Pencil, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

interface InlineCommentPopoverProps {
  visible: boolean;
  x: number;
  y: number;
  comment: string;
  highlightedText: string;
  onClose: () => void;
  onEdit?: (newComment: string) => void;
}

const InlineCommentPopover: React.FC<InlineCommentPopoverProps> = ({
  visible,
  x,
  y,
  comment,
  highlightedText,
  onClose,
  onEdit,
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(comment);

  useEffect(() => {
    setEditValue(comment);
    setIsEditing(false);
  }, [comment]);

  useEffect(() => {
    if (!visible) return;
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [visible, onClose]);

  if (!visible || !comment || comment === 'PENDING_COMMENT') return null;

  // Clamp position to viewport
  const popoverWidth = 280;
  const clampedX = Math.max(8, Math.min(x - popoverWidth / 2, window.innerWidth - popoverWidth - 8));
  const clampedY = Math.min(y, window.innerHeight - 120);

  const handleSaveEdit = () => {
    if (onEdit && editValue.trim()) {
      onEdit(editValue.trim());
    }
    setIsEditing(false);
  };

  return (
    <div
      ref={ref}
      className="fixed z-[200] animate-in fade-in-0 zoom-in-95 duration-150"
      style={{
        left: `${clampedX}px`,
        top: `${clampedY}px`,
        width: `${popoverWidth}px`,
      }}
    >
      <div className="bg-card border border-border rounded-xl shadow-xl overflow-hidden">
        <div className="flex items-center justify-between px-3 py-2 bg-primary/5 border-b border-border">
          <div className="flex items-center gap-1.5">
            <MessageSquare className="w-3.5 h-3.5 text-primary" />
            <span className="text-xs font-bold text-primary">Comment</span>
          </div>
          <div className="flex items-center gap-1">
            {onEdit && !isEditing && (
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5 text-muted-foreground hover:text-foreground"
                onClick={() => setIsEditing(true)}
              >
                <Pencil className="w-3 h-3" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-5 w-5 text-muted-foreground hover:text-foreground"
              onClick={onClose}
            >
              <X className="w-3 h-3" />
            </Button>
          </div>
        </div>
        <div className="px-3 py-2.5">
          {highlightedText && (
            <p className="text-[11px] text-muted-foreground italic mb-1.5 line-clamp-2 border-l-2 border-primary/30 pl-2">
              "{highlightedText}"
            </p>
          )}
          {isEditing ? (
            <div className="space-y-2">
              <Textarea
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                className="text-sm min-h-[60px]"
                autoFocus
              />
              <div className="flex justify-end gap-1">
                <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => { setIsEditing(false); setEditValue(comment); }}>
                  Cancel
                </Button>
                <Button size="sm" className="h-7 text-xs gap-1" onClick={handleSaveEdit}>
                  <Check className="w-3 h-3" />
                  Save
                </Button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-foreground leading-relaxed">{comment}</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default InlineCommentPopover;
