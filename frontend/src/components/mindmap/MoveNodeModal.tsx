import { useState, useMemo } from 'react';
import { Move, Search } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { Node } from '@xyflow/react';
import type { NodeData } from '@/types';

interface MoveNodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  nodeToMove: Node<NodeData> | null;
  nodes: Node<NodeData>[];
  onMove: (targetParentId: string | null) => void;
}

export function MoveNodeModal({
  isOpen,
  onClose,
  nodeToMove,
  nodes,
  onMove,
}: MoveNodeModalProps) {
  const [searchQuery, setSearchQuery] = useState('');

  // Get available target nodes (exclude the node being moved and its descendants)
  const availableTargets = useMemo(() => {
    if (!nodeToMove) return [];

    const nodeToMoveId = nodeToMove.id;
    const descendantIds = new Set<string>();

    // Recursively find all descendants
    const findDescendants = (nodeId: string) => {
      const node = nodes.find(n => n.id === nodeId);
      if (node?.data.children) {
        node.data.children.forEach((childId: string) => {
          descendantIds.add(childId);
          findDescendants(childId);
        });
      }
    };

    findDescendants(nodeToMoveId);

    // Filter out the node itself and its descendants
    return nodes.filter(
      node => node.id !== nodeToMoveId && !descendantIds.has(node.id)
    );
  }, [nodeToMove, nodes]);

  // Filter nodes based on search query
  const filteredNodes = useMemo(() => {
    if (!searchQuery) return availableTargets;
    
    const query = searchQuery.toLowerCase();
    return availableTargets.filter(
      node => 
        node.data.title.toLowerCase().includes(query) ||
        node.data.description?.toLowerCase().includes(query)
    );
  }, [availableTargets, searchQuery]);

  const handleMove = (targetId: string | null) => {
    onMove(targetId);
    setSearchQuery('');
    onClose();
  };

  if (!nodeToMove) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Move className="h-5 w-5" />
            Move Node
          </DialogTitle>
          <DialogDescription>
            Select a new parent for "{nodeToMove.data.title}"
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search nodes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
              autoFocus
            />
          </div>

          <ScrollArea className="h-[300px] border rounded-md">
            <div className="p-2 space-y-1">
              {/* Option to move to root */}
              <button
                onClick={() => handleMove(null)}
                className="w-full text-left px-3 py-2 rounded-md hover:bg-accent transition-colors"
              >
                <div className="font-medium">Root Level</div>
                <div className="text-sm text-muted-foreground">
                  Move to top level (no parent)
                </div>
              </button>

              {/* Other nodes as potential parents */}
              {filteredNodes.map((node) => (
                <button
                  key={node.id}
                  onClick={() => handleMove(node.id)}
                  className="w-full text-left px-3 py-2 rounded-md hover:bg-accent transition-colors"
                >
                  <div className="font-medium">{node.data.title}</div>
                  {node.data.description && (
                    <div className="text-sm text-muted-foreground line-clamp-1">
                      {node.data.description}
                    </div>
                  )}
                </button>
              ))}

              {filteredNodes.length === 0 && searchQuery && (
                <div className="text-center py-8 text-muted-foreground">
                  No nodes found matching "{searchQuery}"
                </div>
              )}
            </div>
          </ScrollArea>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}