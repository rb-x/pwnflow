import { useCallback } from "react";
import { useReactFlow, type Node, type Edge, Position } from "@xyflow/react";
import dagre from "@dagrejs/dagre";
import { useBulkUpdateNodePositions } from "@/hooks/api/useNodes";
import type { NodePositionUpdate } from "@/services/api/nodes";

export type LayoutDirection = "TB" | "BT" | "LR" | "RL";

export type LayoutOptions = {
  direction?: LayoutDirection;
  spacing?: [number, number]; // [nodeSpacing, rankSpacing]
  animate?: boolean;
};

const defaultOptions: Required<LayoutOptions> = {
  direction: "TB",
  spacing: [100, 150],
  animate: true,
};

export function useAutoLayout(projectId?: string) {
  const { getNodes, getEdges, setNodes, setEdges, fitView } = useReactFlow();
  const bulkUpdatePositions = useBulkUpdateNodePositions();

  const getLayoutedElements = useCallback(
    (nodes: Node[], edges: Edge[], options: LayoutOptions = {}) => {
      const { direction, spacing } = { ...defaultOptions, ...options };

      const dagreGraph = new dagre.graphlib.Graph();
      dagreGraph.setDefaultEdgeLabel(() => ({}));
      dagreGraph.setGraph({
        rankdir: direction,
        nodesep: spacing[0],
        ranksep: spacing[1],
      });

      // Add nodes to dagre graph
      nodes.forEach((node) => {
        dagreGraph.setNode(node.id, {
          width: node.measured?.width ?? 200,
          height: node.measured?.height ?? 100,
        });
      });

      // Add edges to dagre graph
      edges.forEach((edge) => {
        dagreGraph.setEdge(edge.source, edge.target);
      });

      // Calculate the layout
      dagre.layout(dagreGraph);

      // Apply the calculated positions to nodes
      const layoutedNodes = nodes.map((node) => {
        const nodeWithPosition = dagreGraph.node(node.id);
        const newNode = {
          ...node,
          position: {
            x: nodeWithPosition.x - (node.measured?.width ?? 200) / 2,
            y: nodeWithPosition.y - (node.measured?.height ?? 100) / 2,
          },
        };

        // Update source and target positions based on direction
        newNode.sourcePosition = getSourcePosition(direction);
        newNode.targetPosition = getTargetPosition(direction);

        return newNode;
      });

      return { nodes: layoutedNodes, edges };
    },
    []
  );

  const applyAutoLayout = useCallback(
    (options: LayoutOptions = {}, syncToBackend: boolean = true) => {
      try {
        const nodes = getNodes();
        const edges = getEdges();
        const { animate } = { ...defaultOptions, ...options };

        const { nodes: layoutedNodes, edges: layoutedEdges } =
          getLayoutedElements(nodes, edges, options);

        setNodes(layoutedNodes);
        setEdges(layoutedEdges);

        // Sync positions to backend if projectId is provided
        if (syncToBackend && projectId) {
          // Only send positions that actually changed
          const nodeUpdates: NodePositionUpdate[] = layoutedNodes
            .filter((layoutedNode) => {
              const originalNode = nodes.find((n) => n.id === layoutedNode.id);
              if (!originalNode) return false;

              // Check if position changed significantly (more than 0.1 pixels)
              const positionChanged =
                Math.abs(originalNode.position.x - layoutedNode.position.x) >
                  0.1 ||
                Math.abs(originalNode.position.y - layoutedNode.position.y) >
                  0.1;

              return positionChanged;
            })
            .map((node) => ({
              id: node.id,
              x_pos: node.position.x,
              y_pos: node.position.y,
            }));

          // Only sync if there are actual changes
          if (nodeUpdates.length > 0) {
            bulkUpdatePositions.mutate({
              projectId,
              data: { nodes: nodeUpdates },
            });
          }
        }

        // Fit view after layout with animation
        setTimeout(() => {
          fitView({ padding: 0.2, duration: animate ? 800 : 0 });
        }, 100);
      } catch (error) {
        console.error("Error applying auto layout:", error);
        throw error;
      }
    },
    [
      getNodes,
      getEdges,
      setNodes,
      setEdges,
      getLayoutedElements,
      fitView,
      projectId,
      bulkUpdatePositions,
    ]
  );

  return { applyAutoLayout, getLayoutedElements };
}

function getSourcePosition(direction: LayoutDirection): Position {
  switch (direction) {
    case "TB":
      return Position.Bottom;
    case "BT":
      return Position.Top;
    case "LR":
      return Position.Right;
    case "RL":
      return Position.Left;
    default:
      return Position.Bottom;
  }
}

function getTargetPosition(direction: LayoutDirection): Position {
  switch (direction) {
    case "TB":
      return Position.Top;
    case "BT":
      return Position.Bottom;
    case "LR":
      return Position.Left;
    case "RL":
      return Position.Right;
    default:
      return Position.Top;
  }
}
