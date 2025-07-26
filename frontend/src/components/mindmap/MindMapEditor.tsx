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
import { useTheme } from "@/components/theme-provider";
import { CustomNode } from "./CustomNode";
import { NodeContextMenu } from "./NodeContextMenu";
import { NodeDetailsDrawer } from "./NodeDetailsDrawer";
import { CommandPaletteDock } from "./CommandPaletteDock";
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
} from "@/hooks/api/useNodes";
import { useUpdateProject } from "@/hooks/api/useProjects";
import { useMindMapStore } from "@/store/mindMapStore";
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
}: {
  onClick: () => void;
  icon: React.ReactNode;
  tooltip: string;
  isActive?: boolean;
}) {
  return (
    <MemoizedTooltip content={tooltip}>
      <Button
        variant="ghost"
        size="sm"
        onClick={onClick}
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

  // Toolbar state
  const [isLocked, setIsLocked] = useState(false);

  // Store
  const {
    selectedNodeId,
    setSelectedNodeId,
    setLayoutDirection,
    layoutDirection,
  } = useMindMapStore();
  const queryClient = useQueryClient();

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
        linkNodesMutation.mutate(
          {
            projectId,
            sourceId: params.source,
            targetId: params.target,
          },
          {
            onSuccess: () => {
              toast.success("Nodes connected");
            },
            onError: (error) => {
              console.error("Failed to connect nodes:", error);
              toast.error("Failed to connect nodes");
              // Revert the edge addition on error
              setEdges((eds) =>
                eds.filter((e) => e.id !== `${params.source}-${params.target}`)
              );
            },
          }
        );
      }
    },
    [setEdges, projectId, linkNodesMutation]
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
        // Toggle off focus mode
        setFocusedNodeId(null);
        // Reset all nodes opacity with transition
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
            className: "", // Clear any focus classes
            style: {
              ...edge.style,
              opacity: 1,
              transition: "opacity 0.3s ease-in-out",
            },
          }))
        );
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

        // Get only direct children (first degree), not recursive
        const focusedNode = nodes.find((n) => n.id === nodeId);
        if (focusedNode?.data.children) {
          focusedNode.data.children.forEach((childId: string) => {
            relatedNodeIds.add(childId);
          });
        }

        // Get all ancestors recursively
        getAncestors(nodeId);

        // Update node opacity with smooth transition
        setNodes((nds) =>
          nds.map((node) => ({
            ...node,
            style: {
              ...node.style,
              opacity: relatedNodeIds.has(node.id) ? 1 : 0.2,
              filter: relatedNodeIds.has(node.id) ? "none" : "blur(2px)",
              transition: "all 0.3s ease-in-out",
            },
          }))
        );

        // Update edge opacity and highlight all edges between related nodes
        setEdges((eds) =>
          eds.map((edge) => {
            const isBetweenRelated =
              relatedNodeIds.has(edge.source) &&
              relatedNodeIds.has(edge.target);

            return {
              ...edge,
              className: isBetweenRelated ? "focused-edge" : "",
              style: {
                ...edge.style,
                opacity: isBetweenRelated ? 1 : 0.1,
                transition: "opacity 0.3s ease-in-out",
              },
            };
          })
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
    [focusedNodeId, nodes, setNodes, setEdges, reactFlowInstance]
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
        toast.success("Node created");
        setContextMenu(null);
      } catch (error) {
        toast.error("Failed to create node");
      }
    },
    [projectId, createNodeMutation, reactFlowInstance, setNodes]
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

        toast.success("Connection removed");
      } catch (error) {
        // Restore the edge if the API call fails
        setEdges((eds) => [...eds, edge]);
        toast.error("Failed to remove connection");
      }
    },
    [projectId, setEdges, unlinkNodesMutation]
  );

  const handleInstantAddChildNode = useCallback(
    async (parentNodeId: string) => {
      const parentNode = reactFlowInstance?.getNode(parentNodeId);
      if (!parentNode) return;

      // Calculate position for the child node based on layout direction
      const isHorizontal = layoutDirection === "LR" || layoutDirection === "RL";
      const childPosition = {
        x: isHorizontal
          ? layoutDirection === "LR"
            ? parentNode.position.x + 250
            : parentNode.position.x - 250
          : parentNode.position.x,
        y: isHorizontal
          ? parentNode.position.y
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
    ]
  );

  const handleEditNode = useCallback(
    (nodeId: string) => {
      // Open the drawer for editing
      setSelectedNodeId(nodeId);
      useMindMapStore.getState().setDrawerOpen(true);
      setContextMenu(null);
    },
    [setSelectedNodeId]
  );

  const handleDeleteNode = useCallback(
    async (nodeId: string) => {
      try {
        await deleteNodeMutation.mutateAsync({ nodeId, projectId });
        setNodes((nds) => nds.filter((node) => node.id !== nodeId));
        setEdges((eds) =>
          eds.filter((edge) => edge.source !== nodeId && edge.target !== nodeId)
        );
        toast.success("Node deleted");
      } catch (error) {
        toast.error("Failed to delete node");
      }
      setContextMenu(null);
    },
    [setNodes, setEdges, deleteNodeMutation, projectId]
  );

  const handleNodesDelete = useCallback(
    async (nodesToDelete: Node[]) => {
      if (nodesToDelete.length === 0) return;

      try {
        if (nodesToDelete.length === 1) {
          // Single node deletion
          await deleteNodeMutation.mutateAsync({
            nodeId: nodesToDelete[0].id,
            projectId,
          });
          toast.success("Node deleted");
        } else {
          // Bulk deletion using the new bulk delete endpoint
          const nodeIds = nodesToDelete.map((node) => node.id);
          await bulkDeleteNodesMutation.mutateAsync({ nodeIds, projectId });
          toast.success(`${nodesToDelete.length} nodes deleted`);
        }

        // Update local state
        setNodes((nds) =>
          nds.filter((node) => !nodesToDelete.find((n) => n.id === node.id))
        );
        setEdges((eds) => {
          const deletedIds = nodesToDelete.map((n) => n.id);
          return eds.filter(
            (edge) =>
              !deletedIds.includes(edge.source) &&
              !deletedIds.includes(edge.target)
          );
        });

        // Clear selection if selected node was deleted
        if (
          selectedNodeId &&
          nodesToDelete.find((n) => n.id === selectedNodeId)
        ) {
          setSelectedNodeId(null);
        }
      } catch (error) {
        toast.error("Failed to delete node(s)");
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
    ]
  );

  const handleDuplicateNode = useCallback(
    async (nodeId: string) => {
      const node = reactFlowInstance?.getNode(nodeId);
      if (!node) return;

      try {
        // Create a duplicate node with offset position
        const createdNode = await createNodeMutation.mutateAsync({
          projectId,
          data: {
            title: `${node.data.title} (Copy)`,
            description: node.data.description || "",
            status: node.data.status || "NOT_STARTED",
            findings: node.data.findings || null,
            x_pos: node.position.x + 50,
            y_pos: node.position.y + 50,
          },
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
          id: createdNode.id,
          type: "custom",
          position: { x: node.position.x + 50, y: node.position.y + 50 },
          sourcePosition: sourcePos as any,
          targetPosition: targetPos as any,
          data: {
            ...createdNode,
            label: createdNode.title,
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
      createNodeMutation,
      setNodes,
      setSelectedNodeId,
    ]
  );

  const handleSuggestChildren = useCallback((nodeId: string) => {
    setSuggestChildrenNodeId(nodeId);
    setContextMenu(null);
  }, []);

  const handleNodeDoubleClick = useCallback(
    (event: React.MouseEvent, node: Node) => {
      // Disable editing in templates
      if (!isTemplate) {
        handleEditNode(node.id);
      }
    },
    [handleEditNode, isTemplate]
  );

  const handleNodeClick = useCallback(
    (event: React.MouseEvent, node: Node) => {
      // Update URL hash to include node ID
      window.location.hash = node.id;

      // Open drawer for both projects and templates (read-only for templates)
      setSelectedNodeId(node.id);
      useMindMapStore.getState().setDrawerOpen(true);
    },
    [setSelectedNodeId]
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
      <div className="absolute inset-0">
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
          onNodesDelete={handleNodesDelete}
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
          deleteKeyCode={["Delete", "Backspace"]}
          multiSelectionKeyCode={["Shift", "Meta", "Control"]}
          selectionOnDrag
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

      {contextMenu && (
        <NodeContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          nodeId={contextMenu.nodeId}
          onAddNode={handleAddNode}
          onEditNode={handleEditNode}
          onDeleteNode={handleDeleteNode}
          onDuplicateNode={handleDuplicateNode}
          onMoveNode={(nodeId) => setMoveNodeId(nodeId)}
          onSuggestChildren={handleSuggestChildren}
          onClose={() => setContextMenu(null)}
        />
      )}

      <NodeDetailsDrawer projectId={projectId} isReadOnly={isTemplate} />

      <CommandPaletteDock projectId={projectId} isTemplate={isTemplate} />

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
    </div>
  );
}
