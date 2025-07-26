import { useEffect } from 'react';
import { Plus, Edit2, Trash2, Copy, Sparkles, Move } from 'lucide-react';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';

interface NodeContextMenuProps {
  x: number;
  y: number;
  nodeId?: string;
  onAddNode: (position?: { x: number; y: number }) => void;
  onEditNode: (nodeId: string) => void;
  onDeleteNode: (nodeId: string) => void;
  onDuplicateNode: (nodeId: string) => void;
  onMoveNode?: (nodeId: string) => void;
  onSuggestChildren?: (nodeId: string) => void;
  onClose: () => void;
}

export function NodeContextMenu({
  x,
  y,
  nodeId,
  onAddNode,
  onEditNode,
  onDeleteNode,
  onDuplicateNode,
  onMoveNode,
  onSuggestChildren,
  onClose,
}: NodeContextMenuProps) {
  useEffect(() => {
    const handleClick = () => onClose();
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    document.addEventListener('click', handleClick);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('click', handleClick);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  return (
    <div
      className="fixed bg-background border rounded-md shadow-lg p-1 z-50"
      style={{ left: x, top: y }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex flex-col">
        {nodeId ? (
          <>
            <button
              className="flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-accent rounded-sm"
              onClick={() => onEditNode(nodeId)}
            >
              <Edit2 className="h-3.5 w-3.5" />
              Edit Node
            </button>
            <button
              className="flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-accent rounded-sm"
              onClick={() => onDuplicateNode(nodeId)}
            >
              <Copy className="h-3.5 w-3.5" />
              Duplicate
            </button>
            {onMoveNode && (
              <button
                className="flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-accent rounded-sm"
                onClick={() => onMoveNode(nodeId)}
              >
                <Move className="h-3.5 w-3.5" />
                Move to...
              </button>
            )}
            <div className="h-px bg-border my-1" />
            {onSuggestChildren && (
              <button
                className="flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-accent rounded-sm text-primary"
                onClick={() => onSuggestChildren(nodeId)}
              >
                <Sparkles className="h-3.5 w-3.5" />
                AI Suggest Children
              </button>
            )}
            <div className="h-px bg-border my-1" />
            <button
              className="flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-accent text-destructive rounded-sm"
              onClick={() => onDeleteNode(nodeId)}
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete
            </button>
          </>
        ) : (
          <button
            className="flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-accent rounded-sm"
            onClick={() => onAddNode({ x, y })}
          >
            <Plus className="h-3.5 w-3.5" />
            Add Node
          </button>
        )}
      </div>
    </div>
  );
}