import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import api from "@/services/api";
import { templatesApi } from "@/services/api/templates";
import { nodesApi, type BulkNodePositionUpdate } from "@/services/api/nodes";
import type { Node as NodeType, NodeCreate, NodeUpdate } from "@/types/api";
import { toast } from "sonner";

// Query keys
export const nodeKeys = {
  all: ["nodes"] as const,
  lists: () => [...nodeKeys.all, "list"] as const,
  list: (projectId: string) => [...nodeKeys.lists(), projectId] as const,
  templateList: (templateId: string) =>
    [...nodeKeys.lists(), "template", templateId] as const,
  details: () => [...nodeKeys.all, "detail"] as const,
  detail: (nodeId: string) => [...nodeKeys.details(), nodeId] as const,
};

interface NodeLink {
  source: string;
  target: string;
}

interface NodesWithLinks {
  nodes: NodeType[];
  links: NodeLink[];
}

// Get nodes for a project
export function useProjectNodes(
  projectId: string,
  isTemplate: boolean = false
) {
  return useQuery({
    queryKey: isTemplate
      ? nodeKeys.templateList(projectId)
      : nodeKeys.list(projectId),
    queryFn: async () => {
      if (isTemplate) {
        return await templatesApi.getNodes(projectId);
      } else {
        const response = await api.get<NodesWithLinks>(
          `/projects/${projectId}/nodes`
        );
        return response.data;
      }
    },
    enabled: !!projectId,
  });
}

// Get single node
export function useNode(projectId: string, nodeId: string) {
  return useQuery({
    queryKey: nodeKeys.detail(nodeId),
    queryFn: async () => {
      const response = await api.get<NodeType>(
        `/projects/${projectId}/nodes/${nodeId}`
      );
      return response.data;
    },
    enabled: !!nodeId && !!projectId,
  });
}

// Create node
export function useCreateNode() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      projectId,
      data,
    }: {
      projectId: string;
      data: NodeCreate;
    }) => {
      const response = await api.post<NodeType>(
        `/projects/${projectId}/nodes`,
        data
      );
      return response.data;
    },
    onSuccess: (createdNode, { projectId }) => {
      // Update the cache to include the new node
      queryClient.setQueryData<NodesWithLinks>(
        nodeKeys.list(projectId),
        (old) => {
          if (!old) return { nodes: [createdNode], links: [] };
          return {
            ...old,
            nodes: [...old.nodes, createdNode],
          };
        }
      );
    },
  });
}

// Update node
export function useUpdateNode() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      projectId,
      nodeId,
      data,
    }: {
      projectId: string;
      nodeId: string;
      data: NodeUpdate;
    }) => {
      const response = await api.put<NodeType>(
        `/projects/${projectId}/nodes/${nodeId}`,
        data
      );
      return response.data;
    },
    onSuccess: (updatedNode, { projectId, nodeId }) => {
      // Update the cache directly without invalidating to prevent refetching
      queryClient.setQueryData(nodeKeys.detail(nodeId), updatedNode);

      // Update the node in the project nodes list
      queryClient.setQueryData<NodesWithLinks>(
        nodeKeys.list(projectId),
        (old) => {
          if (!old) return old;

          const updatedNodes = old.nodes.map((node) =>
            node.id === nodeId ? { ...node, ...updatedNode } : node
          );

          return {
            ...old,
            nodes: updatedNodes,
          };
        }
      );
    },
  });
}

// Delete node
export function useDeleteNode() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      nodeId,
      projectId,
    }: {
      nodeId: string;
      projectId: string;
    }) => {
      await api.delete(`/projects/${projectId}/nodes/${nodeId}`);
      return { nodeId, projectId };
    },
    onSuccess: ({ projectId }) => {
      queryClient.invalidateQueries({ queryKey: nodeKeys.list(projectId) });
    },
  });
}

// Bulk delete nodes
export function useBulkDeleteNodes() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      nodeIds,
      projectId,
    }: {
      nodeIds: string[];
      projectId: string;
    }) => {
      await api.post(`/projects/${projectId}/nodes/bulk-delete`, {
        node_ids: nodeIds,
      });
      return { nodeIds, projectId };
    },
    onSuccess: ({ projectId }) => {
      queryClient.invalidateQueries({ queryKey: nodeKeys.list(projectId) });
    },
    onError: (error) => {
      console.error("Failed to bulk delete nodes:", error);
    },
  });
}

// Link nodes
export function useLinkNodes() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      projectId,
      sourceId,
      targetId,
    }: {
      projectId: string;
      sourceId: string;
      targetId: string;
    }) => {
      await api.post(
        `/projects/${projectId}/nodes/${sourceId}/link/${targetId}`
      );
      return { sourceId, targetId };
    },
    onSuccess: (data, { projectId }) => {
      // Update the cache to include the new link
      queryClient.setQueryData<NodesWithLinks>(
        nodeKeys.list(projectId),
        (old) => {
          if (!old) return { nodes: [], links: [] };

          // Check if link already exists
          const linkExists = old.links.some(
            (link) =>
              link.source === data.sourceId && link.target === data.targetId
          );

          if (!linkExists) {
            return {
              ...old,
              links: [
                ...old.links,
                { source: data.sourceId, target: data.targetId },
              ],
            };
          }

          return old;
        }
      );
    },
  });
}

// Unlink nodes
export function useUnlinkNodes() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      projectId,
      sourceId,
      targetId,
    }: {
      projectId: string;
      sourceId: string;
      targetId: string;
    }) => {
      await api.delete(
        `/projects/${projectId}/nodes/${sourceId}/link/${targetId}`
      );
      return { projectId, sourceId, targetId };
    },
    onSuccess: ({ projectId }) => {
      queryClient.invalidateQueries({ queryKey: nodeKeys.list(projectId) });
    },
    onError: (error) => {
      console.error("Failed to unlink nodes:", error);
    },
  });
}

// Add tag to node
export function useAddTag() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      projectId,
      nodeId,
      tagName,
    }: {
      projectId: string;
      nodeId: string;
      tagName: string;
    }) => {
      const response = await api.post<NodeType>(
        `/projects/${projectId}/nodes/${nodeId}/tags/${tagName}`
      );
      return response.data;
    },
    onSuccess: (updatedNode, { projectId, nodeId }) => {
      // Update the node in the cache with the response data
      queryClient.setQueryData(nodeKeys.detail(nodeId), updatedNode);

      // Update the node in the project nodes list
      queryClient.setQueryData<NodesWithLinks>(
        nodeKeys.list(projectId),
        (old) => {
          if (!old) return { nodes: [], links: [] };

          const updatedNodes = old.nodes.map((node) =>
            node.id === nodeId ? updatedNode : node
          );

          return {
            ...old,
            nodes: updatedNodes,
          };
        }
      );
    },
    onError: (error) => {
      console.error("Failed to add tag:", error);
    },
  });
}

// Remove tag from node
export function useRemoveTag() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      projectId,
      nodeId,
      tagName,
    }: {
      projectId: string;
      nodeId: string;
      tagName: string;
    }) => {
      const response = await api.delete<NodeType>(
        `/projects/${projectId}/nodes/${nodeId}/tags/${tagName}`
      );
      return response.data;
    },
    onSuccess: (updatedNode, { projectId, nodeId }) => {
      // Update the node in the cache with the response data
      queryClient.setQueryData(nodeKeys.detail(nodeId), updatedNode);

      // Update the node in the project nodes list
      queryClient.setQueryData<NodesWithLinks>(
        nodeKeys.list(projectId),
        (old) => {
          if (!old) return { nodes: [], links: [] };

          const updatedNodes = old.nodes.map((node) =>
            node.id === nodeId ? updatedNode : node
          );

          return {
            ...old,
            nodes: updatedNodes,
          };
        }
      );
    },
    onError: (error) => {
      console.error("Failed to remove tag:", error);
    },
  });
}

// Update node position
export function useUpdateNodePosition() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      projectId,
      nodeId,
      position,
    }: {
      projectId: string;
      nodeId: string;
      position: { x: number; y: number };
    }) => {
      const response = await api.put<NodeType>(
        `/projects/${projectId}/nodes/${nodeId}`,
        {
          x_pos: position.x,
          y_pos: position.y,
        }
      );
      return response;
    },
    onSuccess: (response, { projectId }) => {
      // Update cache without refetching
      queryClient.setQueryData<NodesWithLinks>(
        nodeKeys.list(projectId),
        (old) => {
          if (!old) return { nodes: [], links: [] };

          const updatedNodes = old.nodes.map((node) =>
            node.id === response.data.id
              ? {
                  ...node,
                  x_pos: response.data.x_pos,
                  y_pos: response.data.y_pos,
                }
              : node
          );

          return {
            ...old,
            nodes: updatedNodes,
          };
        }
      );
    },
    onError: (error) => {
      console.error("Failed to update node position:", error);
      // Refetch to ensure UI is in sync
      queryClient.invalidateQueries({ queryKey: nodeKeys.list(projectId) });
    },
  });
}

// Bulk update node positions
export function useBulkUpdateNodePositions() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      projectId,
      data,
    }: {
      projectId: string;
      data: BulkNodePositionUpdate;
    }) => {
      const response = await nodesApi.bulkUpdatePositions(projectId, data);
      return response.data;
    },
    onSuccess: (_, { projectId, data }) => {
      // Invalidate the project nodes query to refetch with new positions
      queryClient.invalidateQueries({ queryKey: nodeKeys.list(projectId) });

      // Only show toast if nodes were actually synced
      if (data.nodes.length > 0) {
        toast.success(`Synced ${data.nodes.length} node positions`);
      }
    },
    onError: (error: any) => {
      console.error("Failed to bulk update node positions:", error);
      toast.error("Failed to sync node positions");
    },
  });
}
