import { useState } from 'react';
import { GitBranch, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAutoLayout, type LayoutDirection } from '@/hooks/useAutoLayout';
import { useReactFlow } from '@xyflow/react';
import { useMindMapStore } from '@/store/mindMapStore';

interface AutoLayoutButtonProps {
  disabled?: boolean;
  projectId?: string;
  onLayoutChange?: (direction: LayoutDirection) => void;
}

export function AutoLayoutButton({ disabled, projectId, onLayoutChange }: AutoLayoutButtonProps) {
  const { applyAutoLayout } = useAutoLayout(projectId);
  const { getEdges, setEdges } = useReactFlow();
  const setLayoutDirection = useMindMapStore((state) => state.setLayoutDirection);
  const [isApplying, setIsApplying] = useState(false);

  const handleLayout = async (direction: LayoutDirection) => {
    setIsApplying(true);
    try {
      // Update the layout direction in the store
      setLayoutDirection(direction);
      
      // Apply the auto layout
      applyAutoLayout({ direction });
      
      // Notify parent component of layout change
      if (onLayoutChange) {
        onLayoutChange(direction);
      }
      
      // Update edge source/target handles based on direction
      const isVertical = direction === 'TB' || direction === 'BT';
      setEdges((edges) => 
        edges.map((edge) => ({
          ...edge,
          sourceHandle: isVertical ? undefined : undefined,
          targetHandle: isVertical ? undefined : undefined,
        }))
      );
    } catch (error) {
      console.error('Failed to apply auto layout:', error);
    } finally {
      setTimeout(() => setIsApplying(false), 1000);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          size="sm"
          variant="outline"
          disabled={disabled || isApplying}
          className="gap-2 bg-background/95 backdrop-blur"
        >
          <GitBranch className="h-4 w-4" />
          Auto Layout
          <ChevronDown className="h-3 w-3" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuItem onClick={() => handleLayout('TB')}>
          <span className="flex items-center gap-2">
            <span className="text-xs">↓</span>
            Top to Bottom
          </span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleLayout('BT')}>
          <span className="flex items-center gap-2">
            <span className="text-xs">↑</span>
            Bottom to Top
          </span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleLayout('LR')}>
          <span className="flex items-center gap-2">
            <span className="text-xs">→</span>
            Left to Right
          </span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleLayout('RL')}>
          <span className="flex items-center gap-2">
            <span className="text-xs">←</span>
            Right to Left
          </span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}