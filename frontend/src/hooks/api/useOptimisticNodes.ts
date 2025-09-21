import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEditingStore } from "@/store/editingStore";
import api from "@/services/api";
import { nodeKeys } from "@/hooks/api/useNodes";
import type { NodeData } from "@/types";
import type { NodeUpdate } from "@/types/api";
import { toast } from "sonner";
import { useReactFlow } from "@xyflow/react";

interface NodesWithLinks {
  nodes: NodeData[];
  links: any[];
}

interface OptimisticNodeUpdateParams {
  projectId: string;
  nodeId: string;
  data: NodeUpdate;
  field?: string; // Specify which field is being updated for editing store integration
}

// Enhanced mutation hook with optimistic updates and editing store integration
export function useOptimisticNodeUpdate() {
  const queryClient = useQueryClient();
  const editingStore = useEditingStore();
  const { setNodes } = useReactFlow();

  return useMutation({
    mutationFn: async ({ projectId, nodeId, data }: OptimisticNodeUpdateParams) => {
      const response = await api.put(
        `/projects/${projectId}/nodes/${nodeId}`,
        data
      );
      return response.data;
    },

    onMutate: async ({ projectId, nodeId, data, field }) => {
      // Cancel any outgoing refetches (so they don't overwrite our optimistic update)
      await queryClient.cancelQueries({ queryKey: nodeKeys.detail(nodeId) });
      await queryClient.cancelQueries({ queryKey: nodeKeys.list(projectId) });

      // Snapshot the previous value
      const previousNode = queryClient.getQueryData(nodeKeys.detail(nodeId));
      const previousNodes = queryClient.getQueryData<NodesWithLinks>(nodeKeys.list(projectId));

      // Optimistically update individual node cache
      queryClient.setQueryData(nodeKeys.detail(nodeId), (old: any) => {
        if (!old) return old;
        return { ...old, ...data };
      });

      // Optimistically update nodes list cache
      queryClient.setQueryData<NodesWithLinks>(nodeKeys.list(projectId), (old) => {
        if (!old) return old;

        const updatedNodes = old.nodes.map((node) =>
          node.id === nodeId ? { ...node, ...data } : node
        );

        return {
          ...old,
          nodes: updatedNodes,
        };
      });

      // Optimistically update ReactFlow nodes if visual changes
      if (data.title || data.status) {
        setNodes((nodes) =>
          nodes.map((node) => {
            if (node.id === nodeId) {
              return {
                ...node,
                data: {
                  ...node.data,
                  ...data,
                },
              };
            }
            return node;
          })
        );
      }

      // If this update is coming from the editing store, mark as optimistic
      if (field) {
        editingStore._addOptimisticUpdate(nodeId, field, (data as any)[field] || '');
      }

      // Return a context object with the previous values
      return { previousNode, previousNodes };
    },

    onError: (err, { projectId, nodeId, field }, context) => {
      console.error('Node update failed:', err);

      // Revert the optimistic updates on error
      if (context?.previousNode) {
        queryClient.setQueryData(nodeKeys.detail(nodeId), context.previousNode);
      }
      if (context?.previousNodes) {
        queryClient.setQueryData(nodeKeys.list(projectId), context.previousNodes);
      }

      // Remove optimistic update from editing store
      if (field) {
        editingStore._removeOptimisticUpdate(nodeId, field);
      }

      // Show error toast
      toast.error("Failed to update node");
    },

    onSuccess: (updatedNode, { projectId, nodeId, field }) => {
      // Update caches with server response (this ensures we have the latest server state)
      queryClient.setQueryData(nodeKeys.detail(nodeId), updatedNode);

      queryClient.setQueryData<NodesWithLinks>(nodeKeys.list(projectId), (old) => {
        if (!old) return old;

        const updatedNodes = old.nodes.map((node) =>
          node.id === nodeId ? { ...node, ...updatedNode } : node
        );

        return {
          ...old,
          nodes: updatedNodes,
        };
      });

      // Update ReactFlow with server response
      setNodes((nodes) =>
        nodes.map((node) => {
          if (node.id === nodeId) {
            return {
              ...node,
              data: {
                ...node.data,
                ...updatedNode,
              },
            };
          }
          return node;
        })
      );

      // Remove optimistic update from editing store (success)
      if (field) {
        editingStore._removeOptimisticUpdate(nodeId, field);
      }
    },

    onSettled: (data, error, { projectId }) => {
      // Always invalidate queries after mutation settles to ensure data consistency
      // This refetch happens in the background and doesn't affect the UI during editing
      queryClient.invalidateQueries({ queryKey: nodeKeys.list(projectId) });
    },
  });
}

// Specialized hook for title updates with editing store integration
export function useOptimisticTitleUpdate() {
  const optimisticUpdate = useOptimisticNodeUpdate();
  const editingStore = useEditingStore();

  return useMutation({
    mutationFn: async ({ projectId, nodeId, title }: { projectId: string; nodeId: string; title: string }) => {
      return optimisticUpdate.mutateAsync({
        projectId,
        nodeId,
        data: { title },
        field: 'title',
      });
    },
    onSuccess: (_, { nodeId }) => {
      // Clear the editing state for title after successful update
      editingStore.cancelEdit(nodeId, 'title');
      toast.success("Title updated");
    },
    onError: () => {
      toast.error("Failed to update title");
    },
  });
}

// Specialized hook for description updates with editing store integration
export function useOptimisticDescriptionUpdate() {
  const optimisticUpdate = useOptimisticNodeUpdate();
  const editingStore = useEditingStore();

  return useMutation({
    mutationFn: async ({ projectId, nodeId, description }: { projectId: string; nodeId: string; description: string }) => {
      return optimisticUpdate.mutateAsync({
        projectId,
        nodeId,
        data: { description },
        field: 'description',
      });
    },
    onSuccess: (_, { nodeId }) => {
      // Note: We don't clear editing state here for descriptions since they're auto-saved
      // The editing store will handle cleanup when user stops editing
    },
    onError: () => {
      toast.error("Failed to update description");
    },
  });
}

// Specialized hook for status updates
export function useOptimisticStatusUpdate() {
  const optimisticUpdate = useOptimisticNodeUpdate();

  return useMutation({
    mutationFn: async ({ projectId, nodeId, status }: { projectId: string; nodeId: string; status: string }) => {
      return optimisticUpdate.mutateAsync({
        projectId,
        nodeId,
        data: { status },
      });
    },
    onSuccess: () => {
      // Status updates don't need toast since they're immediate
    },
    onError: () => {
      toast.error("Failed to update status");
    },
  });
}

// Enhanced editing store commit function that integrates with optimistic updates
export function useEditingStoreCommit() {
  const optimisticTitleUpdate = useOptimisticTitleUpdate();
  const optimisticDescriptionUpdate = useOptimisticDescriptionUpdate();

  return {
    commitTitleEdit: async (projectId: string, nodeId: string, title: string) => {
      try {
        await optimisticTitleUpdate.mutateAsync({ projectId, nodeId, title });
        return true;
      } catch (error) {
        return false;
      }
    },

    commitDescriptionEdit: async (projectId: string, nodeId: string, description: string) => {
      try {
        await optimisticDescriptionUpdate.mutateAsync({ projectId, nodeId, description });
        return true;
      } catch (error) {
        return false;
      }
    },
  };
}

// Hook to integrate editing store with API mutations
export function useEditingStoreIntegration(projectId: string) {
  const { commitTitleEdit, commitDescriptionEdit } = useEditingStoreCommit();
  const editingStore = useEditingStore();

  // Override the editing store's commit function to use our optimistic updates
  const enhancedCommitEdit = async (nodeId: string, field: string): Promise<boolean> => {
    const editingValue = editingStore.getEditingValue(nodeId, field);
    if (!editingValue) return false;

    switch (field) {
      case 'title':
        return await commitTitleEdit(projectId, nodeId, editingValue);
      case 'description':
        return await commitDescriptionEdit(projectId, nodeId, editingValue);
      default:
        console.warn(`No commit handler for field: ${field}`);
        return false;
    }
  };

  return {
    ...editingStore,
    commitEdit: enhancedCommitEdit,
  };
}