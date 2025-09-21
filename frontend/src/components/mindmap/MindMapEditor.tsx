import { useCallback, useRef, useState, useEffect, memo, useMemo } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  addEdge,
  type Node,
  type Edge,
  type Connection,
  type ReactFlowInstance,
  Panel,
  BackgroundVariant,
  type EdgeTypes as EdgeType,
  useStore,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  Plus,
  Save,
  Trash2,
  Edit2,
  Copy,
  Maximize2,
  Undo2,
  Lock,
  Unlock,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  ArrowRight,
  Network,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useTheme } from "@/components/theme-provider";
import { CustomNode } from "./CustomNode";
import { NodeContextMenu } from "./NodeContextMenu";
import { NodeDetailsDrawer } from "./NodeDetailsDrawer";
import { NodePreviewFloat } from "./NodePreviewFloat";
import { CommandPaletteDock } from "./CommandPaletteDock";
import { TimelineDrawer } from "@/components/timeline/TimelineDrawer";
import { AISuggestChildrenDialog } from "./AISuggestChildrenDialog";
import { MoveNodeModal } from "./MoveNodeModal";
import {
  useProjectNodes,
  useDeleteNode,
  useBulkDeleteNodes,
  useUpdateNodePosition,
  useLinkNodes,
  useUnlinkNodes,
  useCreateNode,
  useDuplicateNode,
} from "@/hooks/api/useNodes";
import { useUpdateProject } from "@/hooks/api/useProjects";
import { useMindMapStore } from "@/store/mindMapStore";
import { useUndoStore } from "@/store/undoStore";
import type { NodeCreateUndoAction, NodeDeleteUndoAction, EdgeLinkUndoAction, EdgeUnlinkUndoAction } from "@/store/undoStore";
import { toast } from "sonner";
import { useDebouncedCallback } from "use-debounce";
import { useQueryClient } from "@tanstack/react-query";
import type { NodeData } from "@/types";
import type { NodeProps } from "@xyflow/react";
import { cn } from "@/lib/utils";
import { useProjectRefresh } from "@/hooks/useProjectRefresh";
import { useAutoLayout } from "@/hooks/useAutoLayout";

// Memoized components
const MemoizedTooltip = memo(function MemoizedTooltip({
  children,
  content,
}: {
  children: React.ReactNode;
  content: string;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent>
        <p>{content}</p>
      </TooltipContent>
    </Tooltip>
  );
});

const ZoomDisplay = memo(function ZoomDisplay({ zoom }: { zoom: number }) {
  return (
    <div className="px-3 py-1 text-sm font-medium rounded-md min-w-[70px] text-center">
      {Math.round(zoom * 100)}%
    </div>
  );
});

const ControlButton = memo(function ControlButton({
  onClick,
  icon,
  tooltip,
  isActive = false,
  disabled = false,
}: {
  onClick: () => void;
  icon: React.ReactNode;
  tooltip: string;
  isActive?: boolean;
  disabled?: boolean;
}) {
  return (
    <MemoizedTooltip content={tooltip}>
      <Button
        variant="ghost"
        size="sm"
        onClick={onClick}
        disabled={disabled}
        className={cn("h-8 px-2", isActive && "text-orange-500")}
      >
        {icon}
      </Button>
    </MemoizedTooltip>
  );
});

const Separator = memo(function Separator() {
  return <div className={cn("h-6 w-px", "bg-border")} />;
});

const BezierEdgeIcon = memo(() => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
  >
    <path d="M2 8C2 8 4 3 8 3C12 3 14 8 14 8" strokeLinecap="round" />
  </svg>
));

const StraightEdgeIcon = memo(() => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
  >
    <line x1="2" y1="8" x2="14" y2="8" strokeLinecap="round" />
  </svg>
));

const StepEdgeIcon = memo(() => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
  >
    <path d="M2 8H8V4H14" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
));

const SmoothStepEdgeIcon = memo(() => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
  >
    <path
      d="M2 8C2 8 6 8 8 8C8 6 10 4 14 4"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
));

const DirectionIcon = memo(function DirectionIcon({
  direction,
}: {
  direction: "TB" | "BT" | "LR" | "RL";
}) {
  const className = useMemo(
    () =>
      cn("h-4 w-4 transition-transform", {
        "rotate-0": direction === "LR",
        "rotate-180": direction === "RL",
        "rotate-90": direction === "TB",
        "-rotate-90": direction === "BT",
      }),
    [direction]
  );

  return <ArrowRight className={className} />;
});

interface MindMapEditorProps {
  projectId: string;
  isTemplate?: boolean;
  initialLayoutDirection?: "TB" | "BT" | "LR" | "RL";
  targetNodeId?: string;
}

const nodeTypes = {
  custom: CustomNode,
};

export function MindMapEditor({
  projectId,
  isTemplate = false,
  initialLayoutDirection,
  targetNodeId,
}: MindMapEditorProps) {
  const { theme } = useTheme();

  // Dynamic background styles based on theme
  const backgroundStyle = useMemo(() => {
    return {
      backgroundColor: theme === "dark" ? "var(--card)" : "var(--card)",
      backgroundImage: "radial-gradient(var(--border) 1px, transparent 1px)",
      backgroundSize: "20px 20px",
      width: "100%",
      height: "100%",
      borderRadius: "10px",
      overflow: "hidden",
      position: "relative" as const,
      zIndex: 0,
    };
  }, []);

  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const [reactFlowInstance, setReactFlowInstance] =
    useState<ReactFlowInstance | null>(null);

  // State
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    nodeId?: string;
    flowX?: number;
    flowY?: number;
  } | null>(null);
  const [focusedNodeId, setFocusedNodeId] = useState<string | null>(null);
  const [moveNodeId, setMoveNodeId] = useState<string | null>(null);
  const [edgeType, setEdgeType] = useState<EdgeType>("default");
  const [nodesLocked, setNodesLocked] = useState(false);
  const [suggestChildrenNodeId, setSuggestChildrenNodeId] = useState<
    string | null
  >(null);
  const [activeStatusTrail, setActiveStatusTrail] = useState<string | null>(
    null
  );
  const [timelineOpen, setTimelineOpen] = useState(false);
  const [previewNodeId, setPreviewNodeId] = useState<string | null>(null);
  const [previewPosition, setPreviewPosition] = useState<
    { x: number; y: number } | null
  >(null);

  const closePreview = useCallback(() => {
    setPreviewNodeId(null);
    setPreviewPosition(null);
  }, [setPreviewNodeId, setPreviewPosition]);

  const updatePreviewPosition = useCallback(
    (nextPosition: { x: number; y: number }) => {
      setPreviewPosition(nextPosition);
    },
    [setPreviewPosition]
  );

  // Toolbar state
  const [isLocked, setIsLocked] = useState(false);

  // Bulk delete state for confirmation dialog
  const [bulkDeleteNodes, setBulkDeleteNodes] = useState<Node[]>([]);
  const [showBulkDeleteDialog, setShowBulkDeleteDialog] = useState(false);

  // Store
  const {
    selectedNodeId,
    setSelectedNodeId,
    setLayoutDirection,
    layoutDirection,
  } = useMindMapStore();
  const queryClient = useQueryClient();

  // Undo store
  const pushUndoAction = useUndoStore((state) => state.pushAction);
  const popUndoAction = useUndoStore((state) => state.popAction);
  const undoStack = useUndoStore((state) => state.stack);
  const canUndo = undoStack.length > 0;

  // Enable real-time refresh via WebSocket
  useProjectRefresh(projectId);

  // Auto layout
  const { applyAutoLayout } = useAutoLayout(projectId);

  // API
  const { data: apiData, isLoading } = useProjectNodes(projectId, isTemplate);
  const deleteNodeMutation = useDeleteNode();
  const bulkDeleteNodesMutation = useBulkDeleteNodes();
  const updatePositionMutation = useUpdateNodePosition();
  const linkNodesMutation = useLinkNodes();
  const unlinkNodesMutation = useUnlinkNodes();
  const createNodeMutation = useCreateNode();
  const duplicateNodeMutation = useDuplicateNode();
  const updateProjectMutation = useUpdateProject();

  // Toolbar functionality
  const zoom = useStore((state) => state.transform[2]);
  const currentZoom = Math.round(zoom * 100);

  const handleZoomIn = useCallback(() => {
    reactFlowInstance?.zoomIn({ duration: 200 });
  }, [reactFlowInstance]);

  const handleZoomOut = useCallback(() => {
    reactFlowInstance?.zoomOut({ duration: 200 });
  }, [reactFlowInstance]);

  const handleResetZoom = useCallback(() => {
    reactFlowInstance?.setViewport({ x: 0, y: 0, zoom: 1 }, { duration: 200 });
  }, [reactFlowInstance]);

  const toggleLock = useCallback(() => {
    setIsLocked(!isLocked);
    window.dispatchEvent(
      new CustomEvent("toggleNodeLock", { detail: { locked: !isLocked } })
    );
  }, [isLocked]);

  const cycleEdgeType = useCallback(() => {
    const edgeTypes: EdgeType[] = ["default", "smoothstep", "straight", "step"];
    const currentIndex = edgeTypes.indexOf(edgeType);
    const nextIndex = (currentIndex + 1) % edgeTypes.length;
    setEdgeType(edgeTypes[nextIndex]);
  }, [edgeType, setEdgeType]);

  const getEdgeTypeIcon = useCallback((type: EdgeType) => {
    switch (type) {
      case "straight":
        return <StraightEdgeIcon />;
      case "step":
        return <StepEdgeIcon />;
      case "smoothstep":
        return <SmoothStepEdgeIcon />;
      case "default":
      default:
        return <BezierEdgeIcon />;
    }
  }, []);

  const getLayoutIcon = useCallback((direction: "TB" | "BT" | "LR" | "RL") => {
    return <DirectionIcon direction={direction} />;
  }, []);

  // Debounced position update to avoid too many API calls
  const debouncedUpdatePosition = useDebouncedCallback(
    (nodeId: string, position: { x: number; y: number }) => {
      updatePositionMutation.mutate(
        {
          projectId,
          nodeId,
          position,
        },
        {
          onError: (error) => {
            console.error("Failed to save node position:", error);
            toast.error("Failed to save node position");
            // Refetch nodes to ensure UI is in sync
            queryClient.invalidateQueries({
              queryKey: ["nodes", "list", projectId],
            });
          },
        }
      );
    },
    500 // Wait 500ms after user stops dragging
  );

  const onConnect = useCallback(
    async (params: Edge | Connection) => {
      // Optimistically add the edge to the UI
      setEdges((eds) => addEdge(params, eds));

      // API call to create relationship
      if (params.source && params.target) {
        const edgeId = `${params.source}-${params.target}`;

        linkNodesMutation.mutate(
          {
            projectId,
            sourceId: params.source,
            targetId: params.target,
          },
          {
            onSuccess: () => {
              // Push to undo stack
              const newEdge: Edge = {
                id: edgeId,
                source: params.source,
                target: params.target,
                type: edgeType,
                style: { stroke: "var(--muted-foreground)", strokeWidth: 2 },
              };

              pushUndoAction({
                type: "edge-link",
                projectId,
                edgeSnapshot: newEdge,
              });

              toast.success("Nodes connected");
            },
            onError: (error) => {
              console.error("Failed to connect nodes:", error);
              toast.error("Failed to connect nodes");
              // Revert the edge addition on error
              setEdges((eds) =>
                eds.filter((e) => e.id !== edgeId)
              );
            },
          }
        );
      }
    },
    [setEdges, projectId, linkNodesMutation, pushUndoAction, edgeType]
  );

  const onInit = useCallback((instance: ReactFlowInstance) => {
    setReactFlowInstance(instance);
  }, []);

  const handlePaneClick = useCallback((event: React.MouseEvent) => {
    // Close context menu when clicking on pane
    setContextMenu(null);
    // Clear URL hash when clicking on empty space
    if (window.location.hash) {
      window.location.hash = "";
    }
  }, []);

  const handlePaneContextMenu = useCallback(
    (event: React.MouseEvent) => {
      event.preventDefault();

      // Disable context menu in templates
      if (!isTemplate && reactFlowInstance) {
        // Convert screen coordinates to flow coordinates
        const flowPosition = reactFlowInstance.screenToFlowPosition({
          x: event.clientX,
          y: event.clientY,
        });

        setContextMenu({
          x: event.clientX,
          y: event.clientY,
          flowX: flowPosition.x,
          flowY: flowPosition.y,
        });
      }
    },
    [isTemplate, reactFlowInstance]
  );

  const handleNodeContextMenu = useCallback(
    (event: React.MouseEvent, node: Node) => {
      event.preventDefault();
      // Disable context menu in templates
      if (!isTemplate) {
        setContextMenu({
          x: event.clientX,
          y: event.clientY,
          nodeId: node.id,
        });
      }
    },
    [isTemplate]
  );

  const handleFocusMode = useCallback(
    (nodeId: string) => {
      if (focusedNodeId === nodeId) {
        // Toggle off focus mode - restore all nodes and edges from original data
        setFocusedNodeId(null);
        
        if (apiData) {
          // Restore all nodes
          const sourcePos = layoutDirection === "TB" || layoutDirection === "BT"
            ? "bottom"
            : "right";
          const targetPos = layoutDirection === "TB" || layoutDirection === "BT"
            ? "top"
            : "left";
            
          const allFlowNodes: Node[] = apiData.nodes.map((node) => ({
            id: node.id,
            type: "custom",
            position: { x: node.x_pos || 0, y: node.y_pos || 0 },
            sourcePosition: sourcePos as any,
            targetPosition: targetPos as any,
            data: {
              ...node,
              label: node.title,
              projectId,
            },
          }));
          
          setNodes(allFlowNodes);
          
          // Restore all edges
          const allFlowEdges: Edge[] = apiData.links.map((link) => ({
            id: `${link.source}-${link.target}`,
            source: link.source,
            target: link.target,
            type: edgeType,
            style: { stroke: "var(--muted-foreground)", strokeWidth: 2 },
          }));
          
          setEdges(allFlowEdges);
          
          // Fit view to show all nodes
          setTimeout(() => {
            reactFlowInstance?.fitView({ duration: 800, padding: 0.1 });
          }, 100);
        }
      } else {
        // Enable focus mode for this node
        setFocusedNodeId(nodeId);
        toast.info("Focus mode enabled (ESC to exit)", {
          duration: 2000,
        });

        // Get all related nodes
        const relatedNodeIds = new Set<string>([nodeId]);

        // Recursive function to get all ancestors
        const getAncestors = (nodeId: string) => {
          const node = nodes.find((n) => n.id === nodeId);
          if (node?.data.parents) {
            node.data.parents.forEach((parentId: string) => {
              if (!relatedNodeIds.has(parentId)) {
                relatedNodeIds.add(parentId);
                getAncestors(parentId); // Recursive call
              }
            });
          }
        };

        // Recursive function to get all descendants
        const getDescendants = (nodeId: string) => {
          const node = nodes.find((n) => n.id === nodeId);
          if (node?.data.children) {
            node.data.children.forEach((childId: string) => {
              if (!relatedNodeIds.has(childId)) {
                relatedNodeIds.add(childId);
                getDescendants(childId); // Recursive call
              }
            });
          }
        };

        // Get all ancestors and descendants recursively
        getAncestors(nodeId);
        getDescendants(nodeId);

        // Filter nodes to show only lineage with blue glow
        setNodes((nds) =>
          nds
            .filter((node) => relatedNodeIds.has(node.id))
            .map((node) => ({
              ...node,
              style: {
                ...node.style,
                filter: "drop-shadow(0 0 10px rgba(59, 130, 246, 0.5))",
                transition: "all 0.3s ease-in-out",
              },
            }))
        );

        // Filter edges to show only those connecting lineage nodes
        setEdges((eds) =>
          eds.filter((edge) => 
            relatedNodeIds.has(edge.source) && relatedNodeIds.has(edge.target)
          )
        );

        // Smooth zoom to focused nodes
        setTimeout(() => {
          reactFlowInstance?.fitView({
            padding: 0.3,
            duration: 800, // Smooth animation duration
            nodes: nodes.filter((n) => relatedNodeIds.has(n.id)),
          });
        }, 100); // Small delay to ensure styles are applied first
      }
    },
    [focusedNodeId, nodes, setNodes, setEdges, reactFlowInstance, apiData, layoutDirection, projectId, edgeType]
  );

  // Handle status trail highlighting
  const handleStatusTrail = useCallback(
    (status: string | null) => {
      if (!status) {
        // Clear status trail highlighting
        setActiveStatusTrail(null);
        setNodes((nds) =>
          nds.map((node) => ({
            ...node,
            style: {
              ...node.style,
              opacity: 1,
              filter: "none",
              transition: "all 0.3s ease-in-out",
            },
          }))
        );
        setEdges((eds) =>
          eds.map((edge) => ({
            ...edge,
            className: "",
            style: {
              ...edge.style,
              opacity: 1,
              transition: "opacity 0.3s ease-in-out",
            },
          }))
        );
        return;
      }

      setActiveStatusTrail(status);

      // Find all nodes that match the status
      const matchingNodes = nodes.filter((node) => node.data.status === status);

      const highlightedNodeIds = new Set<string>();
      const highlightedEdgeIds = new Set<string>();

      // For each matching node, trace back to root
      matchingNodes.forEach((matchingNode) => {
        let currentNodeId = matchingNode.id;
        let blocked = false;

        // Special handling for NOT_STARTED status
        if (status === "NOT_STARTED") {
          // For NOT_STARTED, trace all the way up to root just like other statuses
          while (currentNodeId) {
            const currentNode = nodes.find((n) => n.id === currentNodeId);
            if (!currentNode) break;

            highlightedNodeIds.add(currentNodeId);

            // Add edges from parents to this node
            if (
              currentNode.data.parents &&
              currentNode.data.parents.length > 0
            ) {
              currentNode.data.parents.forEach((parentId: string) => {
                const edgeId = `${parentId}-${currentNodeId}`;
                highlightedEdgeIds.add(edgeId);
              });
              // Continue with first parent
              currentNodeId = currentNode.data.parents[0];
            } else {
              currentNodeId = null; // Reached root
            }
          }
        } else {
          // For other statuses, trace up to root but stop at NOT_STARTED
          while (currentNodeId && !blocked) {
            const currentNode = nodes.find((n) => n.id === currentNodeId);
            if (!currentNode) break;

            // Check if this node is NOT_STARTED (blocks propagation)
            if (
              currentNode.data.status === "NOT_STARTED" &&
              currentNode.id !== matchingNode.id
            ) {
              blocked = true;
              break;
            }

            highlightedNodeIds.add(currentNodeId);

            // Add edges from parents to this node
            if (
              currentNode.data.parents &&
              currentNode.data.parents.length > 0
            ) {
              currentNode.data.parents.forEach((parentId: string) => {
                const edgeId = `${parentId}-${currentNodeId}`;
                highlightedEdgeIds.add(edgeId);
              });
              // Continue with first parent
              currentNodeId = currentNode.data.parents[0];
            } else {
              currentNodeId = null; // Reached root
            }
          }
        }
      });

      // Update visual state
      setNodes((nds) =>
        nds.map((node) => ({
          ...node,
          style: {
            ...node.style,
            opacity: highlightedNodeIds.has(node.id) ? 1 : 0.2,
            filter: highlightedNodeIds.has(node.id) ? "none" : "blur(2px)",
            transition: "all 0.3s ease-in-out",
          },
        }))
      );

      setEdges((eds) =>
        eds.map((edge) => {
          const isHighlighted = highlightedEdgeIds.has(edge.id);
          return {
            ...edge,
            className: isHighlighted
              ? `status-trail-${status.toLowerCase()}`
              : "",
            style: {
              ...edge.style,
              opacity: isHighlighted ? 1 : 0.1,
              transition: "opacity 0.3s ease-in-out",
            },
          };
        })
      );
    },
    [nodes, setNodes, setEdges]
  );

  const handleMoveNode = useCallback(
    async (targetParentId: string | null) => {
      if (!moveNodeId) return;

      const nodeToMove = nodes.find((n) => n.id === moveNodeId);
      if (!nodeToMove) return;

      try {
        // First, unlink from all current parents
        if (nodeToMove.data.parents && nodeToMove.data.parents.length > 0) {
          await Promise.all(
            nodeToMove.data.parents.map((parentId: string) =>
              unlinkNodesMutation.mutateAsync({
                projectId,
                sourceId: parentId,
                targetId: moveNodeId,
              })
            )
          );
        }

        // Then, link to new parent if not moving to root
        if (targetParentId) {
          await linkNodesMutation.mutateAsync({
            projectId,
            sourceId: targetParentId,
            targetId: moveNodeId,
          });
        }

        // Update local state
        setNodes((nds) =>
          nds.map((node) => {
            if (node.id === moveNodeId) {
              return {
                ...node,
                data: {
                  ...node.data,
                  parents: targetParentId ? [targetParentId] : [],
                },
              };
            }
            // Update old parents
            if (node.data.children && node.data.children.includes(moveNodeId)) {
              return {
                ...node,
                data: {
                  ...node.data,
                  children: node.data.children.filter(
                    (id: string) => id !== moveNodeId
                  ),
                },
              };
            }
            // Update new parent
            if (targetParentId && node.id === targetParentId) {
              return {
                ...node,
                data: {
                  ...node.data,
                  children: [...(node.data.children || []), moveNodeId],
                },
              };
            }
            return node;
          })
        );

        // Update edges
        setEdges((eds) => {
          // Remove old edges
          const filteredEdges = eds.filter(
            (e) =>
              e.target !== moveNodeId ||
              !nodeToMove.data.parents?.includes(e.source)
          );

          // Add new edge if not root
          if (targetParentId) {
            const newEdge: Edge = {
              id: `${targetParentId}-${moveNodeId}`,
              source: targetParentId,
              target: moveNodeId,
              type: "smoothstep",
              style: { stroke: "var(--muted-foreground)", strokeWidth: 2 },
            };
            return [...filteredEdges, newEdge];
          }

          return filteredEdges;
        });

        toast.success(
          targetParentId ? "Node moved to new parent" : "Node moved to root"
        );
      } catch (error) {
        toast.error("Failed to move node");
      }

      setMoveNodeId(null);
    },
    [
      moveNodeId,
      nodes,
      projectId,
      setNodes,
      setEdges,
      linkNodesMutation,
      unlinkNodesMutation,
    ]
  );

  const handleAddNode = useCallback(
    async (position?: { x: number; y: number }) => {
      try {
        // Get the current viewport center if no position provided
        let nodePosition = position;
        if (!nodePosition && reactFlowInstance) {
          const { x, y, zoom } = reactFlowInstance.getViewport();
          const centerX = (window.innerWidth / 2 - x) / zoom;
          const centerY = (window.innerHeight / 2 - y) / zoom;
          nodePosition = { x: centerX, y: centerY };
        }

        // Create the new node directly
        const createdNode = await createNodeMutation.mutateAsync({
          projectId,
          data: {
            title: "New Node",
            description: "",
            status: "NOT_STARTED",
            findings: null,
            x_pos: nodePosition?.x || 250,
            y_pos: nodePosition?.y || 250,
          },
        });

        // Add the node to the flow immediately
        const isHorizontal =
          layoutDirection === "LR" || layoutDirection === "RL";
        const sourcePos = isHorizontal
          ? layoutDirection === "LR"
            ? "right"
            : "left"
          : layoutDirection === "TB"
          ? "bottom"
          : "top";
        const targetPos = isHorizontal
          ? layoutDirection === "LR"
            ? "left"
            : "right"
          : layoutDirection === "TB"
          ? "top"
          : "bottom";

        const newFlowNode: Node = {
          id: createdNode.id,
          type: "custom",
          position: { x: nodePosition?.x || 250, y: nodePosition?.y || 250 },
          sourcePosition: sourcePos as any,
          targetPosition: targetPos as any,
          data: {
            ...createdNode,
            label: createdNode.title,
          },
        };

        setNodes((nds) => [...nds, newFlowNode]);

        // Push to undo stack
        pushUndoAction({
          type: "node-create",
          projectId,
          nodeId: createdNode.id,
        });

        toast.success("Node created");
        setContextMenu(null);
      } catch (error) {
        toast.error("Failed to create node");
      }
    },
    [projectId, createNodeMutation, reactFlowInstance, setNodes, pushUndoAction, layoutDirection]
  );

  const handleEdgeDoubleClick = useCallback(
    async (_event: React.MouseEvent, edge: Edge) => {
      try {
        // Extract source and target from the edge
        const { source, target } = edge;

        // Remove the edge from local state immediately for better UX
        setEdges((eds) => eds.filter((e) => e.id !== edge.id));

        // Call the unlink API
        await unlinkNodesMutation.mutateAsync({
          projectId,
          sourceId: source,
          targetId: target,
        });

        // Push to undo stack
        pushUndoAction({
          type: "edge-unlink",
          projectId,
          edgeSnapshot: edge,
        });

        toast.success("Connection removed");
      } catch (error) {
        // Restore the edge if the API call fails
        setEdges((eds) => [...eds, edge]);
        toast.error("Failed to remove connection");
      }
    },
    [projectId, setEdges, unlinkNodesMutation, pushUndoAction]
  );

  const handleInstantAddChildNode = useCallback(
    async (parentNodeId: string) => {
      const parentNode = reactFlowInstance?.getNode(parentNodeId);
      if (!parentNode) return;

      // Find existing children of this parent
      const existingChildren = nodes.filter(node => {
        // Check if this node is connected as a child to the parent
        return edges.some(edge =>
          edge.source === parentNodeId && edge.target === node.id
        );
      });

      // Calculate position for the child node based on layout direction
      const isHorizontal = layoutDirection === "LR" || layoutDirection === "RL";

      // Calculate offset based on number of existing children
      const siblingOffset = existingChildren.length * 100; // 100px spacing between siblings

      const childPosition = {
        x: isHorizontal
          ? layoutDirection === "LR"
            ? parentNode.position.x + 250
            : parentNode.position.x - 250
          : parentNode.position.x + siblingOffset - (existingChildren.length * 50), // Center siblings
        y: isHorizontal
          ? parentNode.position.y + siblingOffset - (existingChildren.length * 50) // Offset siblings vertically in horizontal layout
          : layoutDirection === "TB"
          ? parentNode.position.y + 150
          : parentNode.position.y - 150,
      };

      try {
        // Create the new node
        const createdNode = await createNodeMutation.mutateAsync({
          projectId,
          data: {
            title: "New Node",
            description: "",
            status: "NOT_STARTED",
            findings: null,
            x_pos: childPosition.x,
            y_pos: childPosition.y,
          },
        });

        // Immediately add the node to the flow
        const sourcePos = isHorizontal
          ? layoutDirection === "LR"
            ? "right"
            : "left"
          : layoutDirection === "TB"
          ? "bottom"
          : "top";
        const targetPos = isHorizontal
          ? layoutDirection === "LR"
            ? "left"
            : "right"
          : layoutDirection === "TB"
          ? "top"
          : "bottom";

        const newFlowNode: Node = {
          id: createdNode.id,
          type: "custom",
          position: childPosition,
          sourcePosition: sourcePos as any,
          targetPosition: targetPos as any,
          data: {
            ...createdNode,
            label: createdNode.title,
          },
        };

        setNodes((nds) => [...nds, newFlowNode]);

        // Create the edge immediately (optimistic update)
        const newEdge: Edge = {
          id: `${parentNodeId}-${createdNode.id}`,
          source: parentNodeId,
          target: createdNode.id,
          type: "smoothstep",
          style: { stroke: "var(--muted-foreground)", strokeWidth: 2 },
        };

        setEdges((eds) => [...eds, newEdge]);

        // Link the nodes in the backend
        await linkNodesMutation.mutateAsync({
          projectId,
          sourceId: parentNodeId,
          targetId: createdNode.id,
        });

        // Push both node creation and edge link to undo stack
        pushUndoAction({
          type: "node-create",
          projectId,
          nodeId: createdNode.id,
        });

        pushUndoAction({
          type: "edge-link",
          projectId,
          edgeSnapshot: newEdge,
        });

        toast.success("Child node created");

        // Select the new node but don't open drawer
        setSelectedNodeId(createdNode.id);
      } catch (error) {
        console.error("Failed to create child node:", error);
        toast.error("Failed to create child node");
      }
    },
    [
      reactFlowInstance,
      createNodeMutation,
      linkNodesMutation,
      projectId,
      setNodes,
      setEdges,
      setSelectedNodeId,
      nodes,
      edges,
      pushUndoAction,
    ]
  );

  const handleEditNode = useCallback(
    (nodeId: string) => {
      closePreview();
      setSelectedNodeId(nodeId);
      useMindMapStore.getState().setDrawerOpen(true);
      setContextMenu(null);
    },
    [closePreview, setSelectedNodeId]
  );

  const handleDeleteNode = useCallback(
    async (nodeId: string) => {
      try {
        // Find the node to save its snapshot
        const nodeToDelete = nodes.find(n => n.id === nodeId);
        if (!nodeToDelete) return;

        // Save connected edges for undo
        const connectedEdges = edges.filter(
          edge => edge.source === nodeId || edge.target === nodeId
        );

        await deleteNodeMutation.mutateAsync({ nodeId, projectId });
        setNodes((nds) => nds.filter((node) => node.id !== nodeId));
        setEdges((eds) =>
          eds.filter((edge) => edge.source !== nodeId && edge.target !== nodeId)
        );

        // Push to undo stack
        pushUndoAction({
          type: "node-delete",
          projectId,
          nodeSnapshot: nodeToDelete,
          connectedEdges,
        });

        toast.success("Node deleted");
      } catch (error) {
        toast.error("Failed to delete node");
      }
      setContextMenu(null);
    },
    [setNodes, setEdges, deleteNodeMutation, projectId, nodes, edges, pushUndoAction]
  );

  const handleNodesDelete = useCallback(
    async (nodesToDelete: Node[]) => {
      if (nodesToDelete.length === 0) return;

      if (nodesToDelete.length > 1) {
        setBulkDeleteNodes(nodesToDelete);
        setShowBulkDeleteDialog(true);
        return;
      }
      try {
        const nodeToDelete = nodesToDelete[0];
        const connectedEdges = edges.filter(
          edge => edge.source === nodeToDelete.id || edge.target === nodeToDelete.id
        );

        await deleteNodeMutation.mutateAsync({
          nodeId: nodeToDelete.id,
          projectId,
        });

        pushUndoAction({
          type: "node-delete",
          projectId,
          nodeSnapshot: nodeToDelete,
          connectedEdges,
        });
        setNodes((nds) =>
          nds.filter((node) => node.id !== nodeToDelete.id)
        );
        setEdges((eds) =>
          eds.filter(
            (edge) =>
              edge.source !== nodeToDelete.id &&
              edge.target !== nodeToDelete.id
          )
        );

        if (selectedNodeId === nodeToDelete.id) {
          setSelectedNodeId(null);
        }

        toast.success("Node deleted");
      } catch (error) {
        toast.error("Failed to delete node");
      }
    },
    [
      deleteNodeMutation,
      bulkDeleteNodesMutation,
      projectId,
      setNodes,
      setEdges,
      selectedNodeId,
      setSelectedNodeId,
      edges,
      pushUndoAction,
      setBulkDeleteNodes,
      setShowBulkDeleteDialog,
    ]
  );

  const handleDuplicateNode = useCallback(
    async (nodeId: string) => {
      const node = reactFlowInstance?.getNode(nodeId);
      if (!node) return;

      try {
        // Duplicate the node with all its commands and findings
        const duplicatedNode = await duplicateNodeMutation.mutateAsync({
          projectId,
          nodeId,
        });

        // Add the duplicated node to the flow
        const isHorizontal =
          layoutDirection === "LR" || layoutDirection === "RL";
        const sourcePos = isHorizontal
          ? layoutDirection === "LR"
            ? "right"
            : "left"
          : layoutDirection === "TB"
          ? "bottom"
          : "top";
        const targetPos = isHorizontal
          ? layoutDirection === "LR"
            ? "left"
            : "right"
          : layoutDirection === "TB"
          ? "top"
          : "bottom";

        const newFlowNode: Node = {
          id: duplicatedNode.id,
          type: "custom",
          position: { x: node.position.x + 50, y: node.position.y + 50 },
          sourcePosition: sourcePos as any,
          targetPosition: targetPos as any,
          data: {
            ...duplicatedNode,
            label: duplicatedNode.title,
          },
        };

        setNodes((nds) => [...nds, newFlowNode]);
        toast.success("Node duplicated");
      } catch (error) {
        toast.error("Failed to duplicate node");
      }
      setContextMenu(null);
    },
    [
      reactFlowInstance,
      projectId,
      duplicateNodeMutation,
      layoutDirection,
      setNodes,
    ]
  );

  const handleSuggestChildren = useCallback((nodeId: string) => {
    setSuggestChildrenNodeId(nodeId);
    setContextMenu(null);
  }, []);

  // Handle bulk delete confirmation
  const handleBulkDeleteConfirm = useCallback(async () => {
    try {
      const nodeIds = bulkDeleteNodes.map((node) => node.id);
      await bulkDeleteNodesMutation.mutateAsync({ nodeIds, projectId });

      // Update local state
      setNodes((nds) =>
        nds.filter((node) => !bulkDeleteNodes.find((n) => n.id === node.id))
      );
      setEdges((eds) => {
        const deletedIds = bulkDeleteNodes.map((n) => n.id);
        return eds.filter(
          (edge) =>
            !deletedIds.includes(edge.source) &&
            !deletedIds.includes(edge.target)
        );
      });

      // Clear selection if selected node was deleted
      if (
        selectedNodeId &&
        bulkDeleteNodes.find((n) => n.id === selectedNodeId)
      ) {
        setSelectedNodeId(null);
      }

      toast.success(`${bulkDeleteNodes.length} nodes permanently deleted`);
      setShowBulkDeleteDialog(false);
      setBulkDeleteNodes([]);
    } catch (error) {
      toast.error("Failed to delete nodes");
    }
  }, [
    bulkDeleteNodes,
    bulkDeleteNodesMutation,
    projectId,
    setNodes,
    setEdges,
    selectedNodeId,
    setSelectedNodeId,
  ]);

  // Handle undo operation
  const handleUndo = useCallback(async () => {
    const action = popUndoAction();
    if (!action) return;

    try {
      switch (action.type) {
        case "node-create":
          // Undo node creation by deleting the node
          await deleteNodeMutation.mutateAsync({
            nodeId: action.nodeId,
            projectId: action.projectId,
          });
          setNodes((nds) => nds.filter((node) => node.id !== action.nodeId));
          setEdges((eds) =>
            eds.filter((edge) => edge.source !== action.nodeId && edge.target !== action.nodeId)
          );
          toast.success("Undone: Node creation");
          break;

        case "node-delete":
          // Undo node deletion by recreating the node
          const createdNode = await createNodeMutation.mutateAsync({
            projectId: action.projectId,
            data: {
              title: action.nodeSnapshot.data.title,
              description: action.nodeSnapshot.data.description || "",
              status: action.nodeSnapshot.data.status,
              findings: action.nodeSnapshot.data.findings || null,
              x_pos: action.nodeSnapshot.position.x,
              y_pos: action.nodeSnapshot.position.y,
            },
          });

          // Recreate the node in the flow
          const restoredNode: Node = {
            ...action.nodeSnapshot,
            id: createdNode.id,
            data: {
              ...createdNode,
              label: createdNode.title,
            },
          };
          setNodes((nds) => [...nds, restoredNode]);

          // Restore edges
          for (const edge of action.connectedEdges) {
            const newSource = edge.source === action.nodeSnapshot.id ? createdNode.id : edge.source;
            const newTarget = edge.target === action.nodeSnapshot.id ? createdNode.id : edge.target;

            await linkNodesMutation.mutateAsync({
              projectId: action.projectId,
              sourceId: newSource,
              targetId: newTarget,
            });

            setEdges((eds) => [...eds, {
              ...edge,
              id: `${newSource}-${newTarget}`,
              source: newSource,
              target: newTarget,
            }]);
          }

          toast.success("Undone: Node deletion");
          break;

        case "edge-link":
          // Undo edge creation by removing it
          await unlinkNodesMutation.mutateAsync({
            projectId: action.projectId,
            sourceId: action.edgeSnapshot.source,
            targetId: action.edgeSnapshot.target,
          });
          setEdges((eds) => eds.filter((e) => e.id !== action.edgeSnapshot.id));
          toast.success("Undone: Edge connection");
          break;

        case "edge-unlink":
          // Undo edge deletion by recreating it
          await linkNodesMutation.mutateAsync({
            projectId: action.projectId,
            sourceId: action.edgeSnapshot.source,
            targetId: action.edgeSnapshot.target,
          });
          setEdges((eds) => [...eds, action.edgeSnapshot]);
          toast.success("Undone: Edge removal");
          break;
      }
    } catch (error) {
      console.error("Undo failed:", error);
      toast.error("Failed to undo action");
      // Re-push the action back onto the stack since undo failed
      pushUndoAction(action);
    }
  }, [
    popUndoAction,
    pushUndoAction,
    deleteNodeMutation,
    createNodeMutation,
    linkNodesMutation,
    unlinkNodesMutation,
    setNodes,
    setEdges,
  ]);

  const handleNodeDoubleClick = useCallback(
    (event: React.MouseEvent, node: Node) => {
      // Double-click no longer opens the edit drawer
      // Users should right-click and select "Edit Node" instead
    },
    []
  );

  const handleNodeClick = useCallback(
    (event: React.MouseEvent, node: Node) => {
      window.location.hash = node.id;
      setSelectedNodeId(node.id);

      if (reactFlowWrapper.current) {
        const bounds = reactFlowWrapper.current.getBoundingClientRect();
        const pointerX = event.clientX - bounds.left;
        const pointerY = event.clientY - bounds.top;
        const nextPosition = {
          x: pointerX + 24,
          y: pointerY - 12,
        };
        setPreviewPosition(nextPosition);
      }

      setPreviewNodeId(node.id);
    },
    [setSelectedNodeId, setPreviewNodeId, setPreviewPosition]
  );

  // Listen to node events
  useEffect(() => {
    const handleNodeAddChild = (e: CustomEvent) => {
      handleInstantAddChildNode(e.detail.nodeId);
    };

    const handleNodeEditEvent = (e: CustomEvent) => {
      handleEditNode(e.detail.nodeId);
    };

    const handleNodeDeleteEvent = (e: CustomEvent) => {
      handleDeleteNode(e.detail.nodeId);
    };

    const handleNodeDuplicateEvent = (e: CustomEvent) => {
      handleDuplicateNode(e.detail.nodeId);
    };

    const handleNodeFocusEvent = (e: CustomEvent) => {
      handleFocusMode(e.detail.nodeId);
    };

    const handleNodeMoveEvent = (e: CustomEvent) => {
      setMoveNodeId(e.detail.nodeId);
    };

    const handleStatusTrailChange = (e: CustomEvent) => {
      handleStatusTrail(e.detail.status);
    };

    window.addEventListener(
      "nodeAddChild",
      handleNodeAddChild as EventListener
    );
    window.addEventListener("nodeEdit", handleNodeEditEvent as EventListener);
    window.addEventListener(
      "nodeDelete",
      handleNodeDeleteEvent as EventListener
    );
    window.addEventListener(
      "nodeDuplicate",
      handleNodeDuplicateEvent as EventListener
    );
    window.addEventListener("nodeFocus", handleNodeFocusEvent as EventListener);
    window.addEventListener("nodeMove", handleNodeMoveEvent as EventListener);
    window.addEventListener(
      "statusTrailChange",
      handleStatusTrailChange as EventListener
    );

    return () => {
      window.removeEventListener(
        "nodeAddChild",
        handleNodeAddChild as EventListener
      );
      window.removeEventListener(
        "nodeEdit",
        handleNodeEditEvent as EventListener
      );
      window.removeEventListener(
        "nodeDelete",
        handleNodeDeleteEvent as EventListener
      );
      window.removeEventListener(
        "nodeDuplicate",
        handleNodeDuplicateEvent as EventListener
      );
      window.removeEventListener(
        "nodeFocus",
        handleNodeFocusEvent as EventListener
      );
      window.removeEventListener(
        "nodeMove",
        handleNodeMoveEvent as EventListener
      );
      window.removeEventListener(
        "statusTrailChange",
        handleStatusTrailChange as EventListener
      );
    };
  }, [
    handleInstantAddChildNode,
    handleEditNode,
    handleDeleteNode,
    handleDuplicateNode,
    handleFocusMode,
    handleMoveNode,
    handleStatusTrail,
  ]);

  // Add keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Exit focus mode on ESC
      if (event.key === "Escape" && focusedNodeId) {
        handleFocusMode(focusedNodeId); // Toggle off focus mode
        return;
      }

      // Clear status trail on ESC
      if (event.key === "Escape" && activeStatusTrail) {
        handleStatusTrail(null);
        return;
      }

      // Don't trigger shortcuts when typing in inputs
      if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      if (event.key === "Delete" || event.key === "Backspace") {
        event.preventDefault();
        const selectedNodes = nodes.filter(node => node.selected);
        if (selectedNodes.length > 0) {
          handleNodesDelete(selectedNodes);
        }
        return;
      }

      // Undo on Ctrl+Z or Cmd+Z
      if (event.key === "z" && (event.ctrlKey || event.metaKey) && !event.shiftKey) {
        event.preventDefault();
        handleUndo();
        return;
      }

      // Center view on Space
      if (event.code === "Space" && !event.ctrlKey && !event.metaKey) {
        event.preventDefault();
        reactFlowInstance?.fitView({ padding: 0.2, duration: 800 });
      }

      // Add node on N
      if (event.key === "n" && !event.ctrlKey && !event.metaKey) {
        event.preventDefault();
        handleAddNode();
      }

      // Search on Cmd/Ctrl + K
      if (event.key === "k" && (event.ctrlKey || event.metaKey)) {
        event.preventDefault();
        toast.info("Search feature coming soon!");
      }

      // Import template on Ctrl + I
      if (event.key === "i" && event.ctrlKey && !event.metaKey) {
        event.preventDefault();
        // Trigger import dialog via event
        window.dispatchEvent(new CustomEvent("openImportDialog"));
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [
    focusedNodeId,
    handleFocusMode,
    activeStatusTrail,
    handleStatusTrail,
    reactFlowInstance,
    handleAddNode,
    handleUndo,
    nodes,
    handleNodesDelete,
  ]);

  // Update all edges when edge type changes
  useEffect(() => {
    setEdges((edges) =>
      edges.map((edge) => ({
        ...edge,
        type: edgeType,
      }))
    );
  }, [edgeType, setEdges]);

  // Listen for lock toggle events
  useEffect(() => {
    const handleToggleLock = (event: CustomEvent) => {
      setNodesLocked(event.detail.locked);
    };

    window.addEventListener(
      "toggleNodeLock",
      handleToggleLock as EventListener
    );
    return () => {
      window.removeEventListener(
        "toggleNodeLock",
        handleToggleLock as EventListener
      );
    };
  }, []);

  // Set initial layout direction from project data
  useEffect(() => {
    if (initialLayoutDirection) {
      setLayoutDirection(initialLayoutDirection);
    }
  }, [initialLayoutDirection, setLayoutDirection]);

  // Handle layout direction change
  const handleLayoutChange = useCallback(
    (direction: "TB" | "BT" | "LR" | "RL") => {
      if (!isTemplate && projectId) {
        // Save layout direction to backend
        updateProjectMutation.mutate(
          {
            id: projectId,
            layout_direction: direction,
            suppressToast: true, // Suppress the default "Project updated" toast
          } as any,
          {
            onError: (error: any) => {
              console.error("Failed to update layout direction:", error);
              toast.error("Failed to update layout direction");
            },
          }
        );
      }
    },
    [isTemplate, projectId, updateProjectMutation]
  );

  const handleAutoAlign = useCallback(async () => {
    try {
      // Apply auto layout with the current direction
      await applyAutoLayout({ direction: layoutDirection });
      toast.success("Nodes aligned");
    } catch (error) {
      console.error("Failed to apply auto layout:", error);
      toast.error("Failed to align nodes");
    }
  }, [layoutDirection, applyAutoLayout]);

  const cycleLayoutDirection = useCallback(async () => {
    const directions: ("TB" | "BT" | "LR" | "RL")[] = ["TB", "BT", "LR", "RL"];
    const currentIndex = directions.indexOf(layoutDirection);
    const nextIndex = (currentIndex + 1) % directions.length;
    const newDirection = directions[nextIndex];

    try {
      // Update the layout direction in the store
      setLayoutDirection(newDirection);

      // Apply the auto layout to actually reposition nodes
      applyAutoLayout({ direction: newDirection });

      // Save layout direction to backend
      handleLayoutChange(newDirection);

      // Update edge source/target handles based on direction
      const isVertical = newDirection === "TB" || newDirection === "BT";
      setEdges((edges) =>
        edges.map((edge) => ({
          ...edge,
          sourceHandle: isVertical ? undefined : undefined,
          targetHandle: isVertical ? undefined : undefined,
        }))
      );
    } catch (error) {
      console.error("Failed to apply auto layout:", error);
    }
  }, [
    layoutDirection,
    setLayoutDirection,
    handleLayoutChange,
    applyAutoLayout,
    setEdges,
  ]);

  // Track if we've initialized from API
  const [hasInitialized, setHasInitialized] = useState(false);

  // Initialize nodes and edges from API
  useEffect(() => {
    if (apiData && !hasInitialized) {
      const isHorizontal = layoutDirection === "LR" || layoutDirection === "RL";
      const sourcePos = isHorizontal
        ? layoutDirection === "LR"
          ? "right"
          : "left"
        : layoutDirection === "TB"
        ? "bottom"
        : "top";
      const targetPos = isHorizontal
        ? layoutDirection === "LR"
          ? "left"
          : "right"
        : layoutDirection === "TB"
        ? "top"
        : "bottom";

      const flowNodes: Node[] = apiData.nodes.map((node) => ({
        id: node.id,
        type: "custom",
        position: { x: node.x_pos || 0, y: node.y_pos || 0 },
        sourcePosition: sourcePos as any,
        targetPosition: targetPos as any,
        data: {
          ...node,
          label: node.title,
          projectId, // Add projectId to node data
        },
      }));

      setNodes(flowNodes);

      // Create edges from links
      const flowEdges: Edge[] = apiData.links.map((link) => ({
        id: `${link.source}-${link.target}`,
        source: link.source,
        target: link.target,
        type: edgeType,
        style: { stroke: "var(--muted-foreground)", strokeWidth: 2 },
      }));
      setEdges(flowEdges);
      setHasInitialized(true);
    }
  }, [apiData, hasInitialized, setNodes, setEdges, edgeType]);

  // Track if we've already focused on the target node
  const [hasTargetedNode, setHasTargetedNode] = useState(false);

  // Handle target node from URL hash
  useEffect(() => {
    if (
      targetNodeId &&
      nodes.length > 0 &&
      reactFlowInstance &&
      !hasTargetedNode
    ) {
      // Find the target node
      const targetNode = nodes.find((n) => n.id === targetNodeId);
      if (targetNode) {
        // Mark as targeted to prevent infinite loop
        setHasTargetedNode(true);

        // Focus on the node
        setTimeout(() => {
          reactFlowInstance.fitView({
            nodes: [targetNode],
            padding: 0.5,
            duration: 800,
          });

          // Select the node
          setSelectedNodeId(targetNodeId);

          // Open the drawer to show node details
          if (!isTemplate) {
            useMindMapStore.getState().setDrawerOpen(true);
          }
        }, 500); // Small delay to ensure everything is rendered
      }
    }
  }, [
    targetNodeId,
    nodes,
    reactFlowInstance,
    setSelectedNodeId,
    isTemplate,
    hasTargetedNode,
  ]);

  // Update nodes and edges when apiData changes (handle template imports)
  useEffect(() => {
    if (apiData && hasInitialized) {
      // Update nodes if there are new ones (e.g., after template import)
      setNodes((currentNodes) => {
        const currentNodeIds = new Set(currentNodes.map((n) => n.id));
        const apiNodeIds = new Set(apiData.nodes.map((n) => n.id));

        // Check if there are new nodes in the API data
        const hasNewNodes = apiData.nodes.some(
          (node) => !currentNodeIds.has(node.id)
        );
        const hasRemovedNodes = currentNodes.some(
          (node) => !apiNodeIds.has(node.id)
        );

        if (hasNewNodes || hasRemovedNodes) {
          const flowNodes: Node[] = apiData.nodes.map((node) => {
            // Try to preserve existing position if node already exists
            const existingNode = currentNodes.find((n) => n.id === node.id);
            return {
              id: node.id,
              type: "custom",
              position: existingNode?.position || {
                x: node.x_pos || 0,
                y: node.y_pos || 0,
              },
              data: {
                ...node,
                label: node.title,
                projectId, // Add projectId to node data
              },
            };
          });
          return flowNodes;
        }

        // Update node data and positions for existing nodes
        return currentNodes.map((currentNode) => {
          const apiNode = apiData.nodes.find((n) => n.id === currentNode.id);
          if (apiNode) {
            // Check if position has changed
            const positionChanged =
              currentNode.position.x !== apiNode.x_pos ||
              currentNode.position.y !== apiNode.y_pos;

            if (positionChanged) {
            }

            return {
              ...currentNode,
              position: {
                x: apiNode.x_pos,
                y: apiNode.y_pos,
              },
              data: {
                ...apiNode,
                label: apiNode.title,
                projectId, // Add projectId to node data
              },
            };
          }
          return currentNode;
        });
      });

      // Update edges
      const flowEdges: Edge[] = apiData.links.map((link) => ({
        id: `${link.source}-${link.target}`,
        source: link.source,
        target: link.target,
        type: edgeType,
        style: { stroke: "var(--muted-foreground)", strokeWidth: 2 },
      }));

      // Only update edges if they've actually changed
      setEdges((currentEdges) => {
        const currentEdgeIds = new Set(currentEdges.map((e) => e.id));
        const newEdgeIds = new Set(flowEdges.map((e) => e.id));

        // Check if edge sets are different
        if (
          currentEdgeIds.size !== newEdgeIds.size ||
          [...currentEdgeIds].some((id) => !newEdgeIds.has(id))
        ) {
          return flowEdges;
        }

        return currentEdges;
      });
    }
  }, [apiData, hasInitialized, setNodes, setEdges, edgeType]);

  useEffect(() => {
    if (!previewNodeId || !apiData?.nodes) return;
    const exists = apiData.nodes.some((apiNode) => apiNode.id === previewNodeId);
    if (!exists) {
      closePreview();
    }
  }, [apiData?.nodes, closePreview, previewNodeId]);

  if (isLoading) {
    return (
      <div className="h-full w-full flex items-center justify-center">
        <div className="text-center">
          <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading mind map...</p>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={reactFlowWrapper}
      className="h-full w-full relative"
      style={backgroundStyle}
    >
      {/* Streamlined Toolbar - Top Left */}
      {!isTemplate && (
        <div
          className={cn(
            "absolute top-4 left-4 z-10 rounded-lg p-1 shadow-lg flex items-center gap-1 backdrop-blur-sm",
            "bg-card/75 border border-border"
          )}
        >
          {/* Add Node */}
          <ControlButton
            onClick={() => handleAddNode()}
            icon={<Plus className="h-4 w-4" />}
            tooltip="Add Node"
          />

          <Separator />

          {/* Undo */}
          <ControlButton
            onClick={handleUndo}
            icon={<Undo2 className="h-4 w-4" />}
            tooltip="Undo (Ctrl+Z)"
            disabled={!canUndo}
          />

          <Separator />

          {/* Zoom Controls */}
          <ControlButton
            onClick={handleZoomIn}
            icon={<ZoomIn className="h-4 w-4" />}
            tooltip="Zoom In"
          />
          <ZoomDisplay zoom={currentZoom / 100} />
          <ControlButton
            onClick={handleZoomOut}
            icon={<ZoomOut className="h-4 w-4" />}
            tooltip="Zoom Out"
          />
          <ControlButton
            onClick={handleResetZoom}
            icon={<RotateCcw className="h-4 w-4" />}
            tooltip="Reset Zoom"
          />

          <Separator />

          {/* Fit View */}
          <ControlButton
            onClick={() =>
              reactFlowInstance?.fitView({ padding: 0.2, duration: 800 })
            }
            icon={<Maximize2 className="h-4 w-4" />}
            tooltip="Fit View"
          />

          <Separator />

          {/* Layout Direction */}
          <ControlButton
            onClick={cycleLayoutDirection}
            icon={getLayoutIcon(layoutDirection)}
            tooltip={`Layout: ${
              layoutDirection === "TB"
                ? "Top to Bottom"
                : layoutDirection === "BT"
                ? "Bottom to Top"
                : layoutDirection === "LR"
                ? "Left to Right"
                : "Right to Left"
            } (click to cycle)`}
          />

          {/* Auto Align */}
          <ControlButton
            onClick={handleAutoAlign}
            icon={<Network className="h-4 w-4" />}
            tooltip="Auto Align Nodes"
          />

          <Separator />

          {/* Edge Type */}
          <ControlButton
            onClick={cycleEdgeType}
            icon={getEdgeTypeIcon(edgeType)}
            tooltip={`Edge Type: ${
              edgeType.charAt(0).toUpperCase() + edgeType.slice(1)
            } (click to cycle)`}
          />

          <Separator />

          {/* Lock/Unlock */}
          <ControlButton
            onClick={toggleLock}
            icon={
              isLocked ? (
                <Lock className="h-4 w-4" />
              ) : (
                <Unlock className="h-4 w-4" />
              )
            }
            tooltip={isLocked ? "Unlock Nodes" : "Lock Nodes"}
            isActive={isLocked}
          />
        </div>
      )}
      <div className={`absolute inset-0 transition-all duration-300 ${focusedNodeId ? 'ring-4 ring-blue-500 ring-opacity-60 shadow-2xl shadow-blue-500/30 bg-blue-50/10 backdrop-blur-[0.5px]' : ''}`}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onInit={onInit}
          onPaneClick={handlePaneClick}
          onPaneContextMenu={handlePaneContextMenu}
          onNodeContextMenu={handleNodeContextMenu}
          onNodeDoubleClick={handleNodeDoubleClick}
          onNodeClick={handleNodeClick}
          onEdgeDoubleClick={handleEdgeDoubleClick}
          onDoubleClick={(event) => {
            // Check if we clicked on empty space (not on a node/edge)
            const target = event.target as HTMLElement;
            const isPane = target.classList.contains('react-flow__pane') || 
                          target.classList.contains('react-flow__container');
            
            if (isPane && !isTemplate && reactFlowInstance) {
              const flowPosition = reactFlowInstance.screenToFlowPosition({
                x: event.clientX,
                y: event.clientY,
              });
              handleAddNode(flowPosition);
            }
          }}
          onNodeDragStop={(_event, node) => {
            // Debounced update to prevent too many API calls
            if (!isTemplate) {
              debouncedUpdatePosition(node.id, node.position);
            }
          }}
          onNodeDrag={(_event, node) => {
            // Update local state immediately for smooth UX
            // The API update will happen after drag stops
          }}
          nodesDraggable={!isTemplate && !nodesLocked}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.2 }}
          attributionPosition="bottom-left"
          snapToGrid
          snapGrid={[20, 20]}
          deleteKeyCode={null}
          multiSelectionKeyCode={["Shift", "Meta", "Control"]}
          selectionOnDrag
          zoomOnDoubleClick={false}
          style={{ background: "transparent" }}
          proOptions={{ hideAttribution: true }}
        >
          <MiniMap
            className="bg-background/95 backdrop-blur border shadow-lg"
            zoomable={true}
            pannable={true}
            nodeStrokeWidth={3}
            nodeBorderRadius={2}
          />

          {isTemplate && (
            <Panel position="top-left" className="flex gap-2">
              <div className="px-3 py-2 bg-muted/95 backdrop-blur rounded-md text-sm text-muted-foreground">
                Template (Read-only)
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => reactFlowInstance?.fitView({ padding: 0.2 })}
                className="gap-2 bg-background/95 backdrop-blur"
              >
                Fit View
              </Button>
            </Panel>
          )}
        </ReactFlow>
      </div>

      {/* Focus Mode Indicator */}
      {focusedNodeId && (
        <div className="absolute top-4 right-4 z-50">
          <div className="bg-blue-500/90 text-white px-3 py-1.5 rounded-full text-sm font-medium shadow-lg backdrop-blur-sm flex items-center gap-2">
            <div className="w-2 h-2 bg-white rounded-full"></div>
            Focus Mode Active (ESC to exit)
          </div>
        </div>
      )}

      {contextMenu && (
        <NodeContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          nodeId={contextMenu.nodeId}
          onAddNode={() => handleAddNode(contextMenu.flowX && contextMenu.flowY ? { x: contextMenu.flowX, y: contextMenu.flowY } : undefined)}
          onEditNode={handleEditNode}
          onDeleteNode={handleDeleteNode}
          onDuplicateNode={handleDuplicateNode}
          onMoveNode={(nodeId) => setMoveNodeId(nodeId)}
          onFocusNode={handleFocusMode}
          onSuggestChildren={handleSuggestChildren}
          onClose={() => setContextMenu(null)}
        />
      )}

      {previewNodeId && (
        <NodePreviewFloat
          projectId={projectId}
          nodeId={previewNodeId}
          position={previewPosition}
          isTemplate={isTemplate}
          onClose={closePreview}
          onPositionChange={updatePreviewPosition}
        />
      )}

      <NodeDetailsDrawer projectId={projectId} isReadOnly={isTemplate} />

      <CommandPaletteDock 
        projectId={projectId} 
        isTemplate={isTemplate}
        timelineOpen={timelineOpen}
        setTimelineOpen={setTimelineOpen}
      />

      <TimelineDrawer
        open={timelineOpen}
        onOpenChange={setTimelineOpen}
        projectId={projectId}
      />

      {suggestChildrenNodeId && (
        <AISuggestChildrenDialog
          isOpen={!!suggestChildrenNodeId}
          onClose={() => setSuggestChildrenNodeId(null)}
          projectId={projectId}
          parentNodeId={suggestChildrenNodeId}
          parentNodeTitle={
            nodes.find((n) => n.id === suggestChildrenNodeId)?.data.title || ""
          }
          onNodesCreated={(nodeIds) => {
            // Apply auto layout after creating nodes
            setTimeout(() => {
              applyAutoLayout({ direction: layoutDirection });
            }, 100);
          }}
        />
      )}

      <MoveNodeModal
        isOpen={!!moveNodeId}
        onClose={() => setMoveNodeId(null)}
        nodeToMove={nodes.find((n) => n.id === moveNodeId) || null}
        nodes={nodes}
        onMove={handleMoveNode}
      />

      {/* Bulk Delete Confirmation Dialog */}
      <AlertDialog open={showBulkDeleteDialog} onOpenChange={setShowBulkDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {bulkDeleteNodes.length} nodes?</AlertDialogTitle>
            <AlertDialogDescription>
              This action will permanently delete {bulkDeleteNodes.length} nodes and cannot be undone.
              All connections to these nodes will also be removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              setShowBulkDeleteDialog(false);
              setBulkDeleteNodes([]);
            }}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkDeleteConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete Permanently
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
