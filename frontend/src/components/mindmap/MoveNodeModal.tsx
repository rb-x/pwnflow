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

const truncateText = (text: string, maxLength = 60) => {
  if (text.length <= maxLength) return text;

  const slicePoint = Math.max(0, maxLength - 3);
  return `${text.slice(0, slicePoint).trimEnd()}...`;
};

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

  // Filter and sort nodes based on search query
  const filteredNodes = useMemo(() => {
    if (!searchQuery) return availableTargets;

    const query = searchQuery.toLowerCase();

    // Filter nodes that match the query
    const matchingNodes = availableTargets.filter(node => {
      const titleMatch = node.data.title.toLowerCase().includes(query);
      const descriptionMatch = node.data.description?.toLowerCase().includes(query) || false;
      const idMatch = node.id.toLowerCase().includes(query);

      return titleMatch || descriptionMatch || idMatch;
    });

    // Sort by relevance: ID exact match > title match > description match
    return matchingNodes.sort((a, b) => {
      const queryLower = query.toLowerCase();

      // Check for exact ID matches first
      const aIdExact = a.id.toLowerCase() === queryLower;
      const bIdExact = b.id.toLowerCase() === queryLower;
      if (aIdExact && !bIdExact) return -1;
      if (!aIdExact && bIdExact) return 1;

      // Then check for title matches (weighted higher)
      const aTitleMatch = a.data.title.toLowerCase().includes(queryLower);
      const bTitleMatch = b.data.title.toLowerCase().includes(queryLower);

      // Check if title starts with query (even higher weight)
      const aTitleStarts = a.data.title.toLowerCase().startsWith(queryLower);
      const bTitleStarts = b.data.title.toLowerCase().startsWith(queryLower);

      if (aTitleStarts && !bTitleStarts) return -1;
      if (!aTitleStarts && bTitleStarts) return 1;

      if (aTitleMatch && !bTitleMatch) return -1;
      if (!aTitleMatch && bTitleMatch) return 1;

      // Finally, check description matches
      const aDescMatch = a.data.description?.toLowerCase().includes(queryLower) || false;
      const bDescMatch = b.data.description?.toLowerCase().includes(queryLower) || false;

      if (aDescMatch && !bDescMatch) return -1;
      if (!aDescMatch && bDescMatch) return 1;

      // If all else is equal, sort alphabetically by title
      return a.data.title.localeCompare(b.data.title);
    });
  }, [availableTargets, searchQuery]);

  const handleMove = (targetId: string | null) => {
    onMove(targetId);
    setSearchQuery('');
    onClose();
  };

  if (!nodeToMove) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Move className="h-5 w-5" />
            Move Node
          </DialogTitle>
          <DialogDescription>
            Select a new parent for "{truncateText(nodeToMove.data.title)}"
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by title, ID, or description..."
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
                className="w-full text-left px-3 py-2 rounded-md hover:bg-accent transition-colors min-w-0"
              >
                <div className="font-medium truncate">Root Level</div>
                <div className="text-sm text-muted-foreground truncate pr-2">
                  Move to top level (no parent)
                </div>
              </button>

              {/* Other nodes as potential parents */}
              {filteredNodes.map((node) => (
                <button
                  key={node.id}
                  onClick={() => handleMove(node.id)}
                  className="w-full text-left px-3 py-2 rounded-md hover:bg-accent transition-colors min-w-0"
                >
                  <div className="font-medium truncate">
                    {truncateText(node.data.title)}
                  </div>
                  {node.data.description && (
                    <div className="text-sm text-muted-foreground truncate pr-2">
                      {truncateText(
                        node.data.description.startsWith('##')
                          ? node.data.description.slice(2).trim()
                          : node.data.description
                      )}
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
