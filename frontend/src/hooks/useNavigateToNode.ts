import { useCallback } from "react";
import { useReactFlow } from "@xyflow/react";
import { useMindMapStore } from "@/store/mindMapStore";

interface NavigateToNodeOptions {
  zoom?: number;
  duration?: number;
  onNotFound?: () => void;
}

/**
 * Provides a stable callback for focusing a node on the canvas and opening the details drawer.
 */
export function useNavigateToNode() {
  const setSelectedNodeId = useMindMapStore((state) => state.setSelectedNodeId);
  const setDrawerOpen = useMindMapStore((state) => state.setDrawerOpen);
  const { setCenter, getNode } = useReactFlow();

  return useCallback(
    (nodeId: string, options?: NavigateToNodeOptions) => {
      const reactFlowNode = getNode(nodeId);

      if (!reactFlowNode) {
        options?.onNotFound?.();
        return false;
      }

      const zoom = options?.zoom ?? 1.5;
      const duration = options?.duration ?? 800;

      setCenter(reactFlowNode.position.x, reactFlowNode.position.y, {
        zoom,
        duration,
      });
      setSelectedNodeId(nodeId);
      setDrawerOpen(true);
      return true;
    },
    [getNode, setCenter, setSelectedNodeId, setDrawerOpen]
  );
}
