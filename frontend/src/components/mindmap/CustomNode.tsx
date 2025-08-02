import { memo, useState, useCallback, useEffect } from "react";
import { Handle, Position, NodeToolbar, useReactFlow } from "@xyflow/react";
import type { NodeProps } from "@xyflow/react";
import {
  CheckCircle2,
  XCircle,
  PlayCircle,
  CircleDashed,
  HelpCircle,
  CircleDot,
  Plus,
  Trash2,
  Copy,
  Focus,
  Move,
  Bug,
  FileText,
  Terminal,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { MagicCard } from "@/components/ui/magic-card";
import type { NodeData } from "@/types";
import { useMindMapStore } from "@/store/mindMapStore";
import { useTheme } from "@/components/theme-provider";
import { useNodeCommands } from "@/hooks/api/useCommands";

// Status icon mapping
const statusIcons = {
  SUCCESS: <CheckCircle2 className="h-4 w-4 text-green-500" />,
  FAILED: <XCircle className="h-4 w-4 text-red-500" />,
  IN_PROGRESS: <PlayCircle className="h-4 w-4 text-yellow-500" />,
  NOT_STARTED: <CircleDashed className="h-4 w-4 text-blue-500" />,
  NOT_APPLICABLE: <HelpCircle className="h-4 w-4 text-muted-foreground" />,
  DEFAULT: <CircleDot className="h-4 w-4 text-muted-foreground" />,
} as const;

interface CustomNodeData extends NodeData {
  label?: string;
  projectId: string; // Add projectId to the interface
  commands?: any[]; // Commands are included in node data for templates
}

export const CustomNode = memo(
  ({ data, id, selected }: NodeProps<CustomNodeData>) => {
    const [isHovered, setIsHovered] = useState(false);
    const [hideTimeout, setHideTimeout] = useState<NodeJS.Timeout | null>(null);
    const reactFlowInstance = useReactFlow();
    const layoutDirection = useMindMapStore((state) => state.layoutDirection);

    // Get real-time command count - use hook for projects, data for templates
    const isTemplate = !data.projectId || data.projectId === "template";
    const { data: fetchedCommands = [] } = useNodeCommands(data.projectId, id, {
      enabled: !isTemplate && !!data.projectId && !!id
    });
    const commands = isTemplate ? (data.commands || []) : fetchedCommands;

    // Check if this node is in focus mode
    const nodes = reactFlowInstance.getNodes();
    const isFocused =
      nodes.find((n) => n.id === id)?.style?.opacity === 1 &&
      nodes.some((n) => n.style?.opacity === 0.2);

    const status = data.status || "NOT_STARTED";
    const statusIcon =
      statusIcons[status as keyof typeof statusIcons] || statusIcons.DEFAULT;

    // Determine handle positions based on layout direction
    const isHorizontal = layoutDirection === "LR" || layoutDirection === "RL";
    const sourcePos = isHorizontal
      ? layoutDirection === "LR"
        ? Position.Right
        : Position.Left
      : layoutDirection === "TB"
      ? Position.Bottom
      : Position.Top;
    const targetPos = isHorizontal
      ? layoutDirection === "LR"
        ? Position.Left
        : Position.Right
      : layoutDirection === "TB"
      ? Position.Top
      : Position.Bottom;

    const handleAddChild = useCallback(
      (e: React.MouseEvent) => {
        e.stopPropagation();
        // Emit custom event
        window.dispatchEvent(
          new CustomEvent("nodeAddChild", { detail: { nodeId: id } })
        );
      },
      [id]
    );

    const handleDelete = useCallback(
      (e: React.MouseEvent) => {
        e.stopPropagation();
        window.dispatchEvent(
          new CustomEvent("nodeDelete", { detail: { nodeId: id } })
        );
      },
      [id]
    );

    const handleDuplicate = useCallback(
      (e: React.MouseEvent) => {
        e.stopPropagation();
        window.dispatchEvent(
          new CustomEvent("nodeDuplicate", { detail: { nodeId: id } })
        );
      },
      [id]
    );

    const handleFocus = useCallback(
      (e: React.MouseEvent) => {
        e.stopPropagation();
        window.dispatchEvent(
          new CustomEvent("nodeFocus", { detail: { nodeId: id } })
        );
      },
      [id]
    );

    const handleMove = useCallback(
      (e: React.MouseEvent) => {
        e.stopPropagation();
        window.dispatchEvent(
          new CustomEvent("nodeMove", { detail: { nodeId: id } })
        );
      },
      [id]
    );

    const handleMouseEnter = useCallback(() => {
      if (hideTimeout) {
        clearTimeout(hideTimeout);
        setHideTimeout(null);
      }
      setIsHovered(true);
    }, [hideTimeout]);

    const handleMouseLeave = useCallback(() => {
      const timeout = setTimeout(() => {
        setIsHovered(false);
      }, 300); // 300ms delay before hiding
      setHideTimeout(timeout);
    }, []);

    // Clean up timeout on unmount
    useEffect(() => {
      return () => {
        if (hideTimeout) {
          clearTimeout(hideTimeout);
        }
      };
    }, [hideTimeout]);

    // Check if node has content
    const hasFindings = data.findings && data.findings.trim().length > 0;
    const hasDescription =
      data.description && data.description.trim().length > 0;
    const hasCommands = commands && commands.length > 0; // Use live command data
    const hasContent = hasFindings || hasDescription || hasCommands;

    return (
      <div onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>
        <MagicCard className="p-4 cursor-pointer" gradientSize={50}>
          <div className="flex items-center gap-3">
            <div className="shrink-0">{statusIcon}</div>
            <span
              className={cn(
                "text-base font-normal truncate",
                "text-foreground"
              )}
              title={data.title}
            >
              {data.title || "Unnamed Node"}
            </span>
          </div>
          <Handle type="target" position={targetPos} />
          <Handle type="source" position={sourcePos} />
        </MagicCard>
        {/* Content indicators */}
        {hasContent && (
          <div
            className={cn(
              "absolute -bottom-7.5 left-1/2 transform -translate-x-1/2 flex items-center gap-3 rounded-md px-2 py-1 shadow-sm",
              "bg-card border border-border"
            )}
          >
            {hasFindings && (
              <div
                className={cn(
                  "flex items-center gap-1 text-xs",
                  "text-muted-foreground"
                )}
              >
                <Bug className="h-3 w-3" />
                <span>1</span>
              </div>
            )}
            {hasDescription && (
              <div
                className={cn(
                  "flex items-center gap-1 text-xs",
                  "text-muted-foreground"
                )}
              >
                <FileText className="h-3 w-3" />
                <span>1</span>
              </div>
            )}
            {hasCommands && (
              <div
                className={cn(
                  "flex items-center gap-1 text-xs",
                  "text-muted-foreground"
                )}
              >
                <Terminal className="h-3 w-3" />
                <span>{commands.length}</span> {/* Use live command count */}
              </div>
            )}
          </div>
        )}

        {(isHovered || selected) && (
          <div
            className={cn(
              "absolute -top-12 left-1/2 transform -translate-x-1/2 rounded-lg p-1 shadow-lg flex items-center gap-1",
              "bg-card border border-border"
            )}
          >
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={handleAddChild}
              title="Add Child Node"
            >
              <Plus className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={handleDuplicate}
              title="Duplicate Node"
            >
              <Copy className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className={cn("h-7 w-7", isFocused && "text-primary")}
              onClick={handleFocus}
              title="Focus Mode"
            >
              <Focus className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={handleMove}
              title="Move Node"
            >
              <Move className="h-3.5 w-3.5" />
            </Button>
            <div className="w-px h-5 bg-border mx-1" />
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 hover:text-destructive"
              onClick={handleDelete}
              title="Delete Node"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}
      </div>
    );
  }
);

CustomNode.displayName = "CustomNode";
