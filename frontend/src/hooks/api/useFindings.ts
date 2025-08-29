import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as FindingsAPI from '@/services/api/findings';
import { nodeKeys } from '@/hooks/api/useNodes';
import { toast } from 'sonner';

// Import the NodesWithLinks interface from useNodes
interface NodesWithLinks {
  nodes: any[];
  links: any[];
}

// Get finding for a specific node
export const useNodeFinding = (projectId: string, nodeId: string, options?: { enabled?: boolean }) => {
  return useQuery({
    queryKey: ['finding', projectId, nodeId],
    queryFn: async () => {
      try {
        return await FindingsAPI.findingsApi.getNodeFinding(projectId, nodeId);
      } catch (error: any) {
        // If finding doesn't exist (404), return null instead of throwing
        if (error.response?.status === 404) {
          return null;
        }
        throw error;
      }
    },
    enabled: !!projectId && !!nodeId && (options?.enabled !== false),
  });
};

// Create finding mutation
export const useCreateFinding = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ projectId, nodeId, data }: { projectId: string; nodeId: string; data: FindingsAPI.FindingCreate }) =>
      FindingsAPI.findingsApi.createFinding(projectId, nodeId, data),
    onSuccess: (finding, { projectId, nodeId }) => {
      // Update the finding query
      queryClient.setQueryData(['finding', projectId, nodeId], finding);
      // Also invalidate the query to refetch from server
      queryClient.invalidateQueries({ queryKey: ['finding', projectId, nodeId] });
      
      // Update the node data directly in the cache to include the finding
      queryClient.setQueryData<NodesWithLinks>(nodeKeys.list(projectId), (oldData) => {
        if (!oldData) return oldData;
        
        const updatedNodes = oldData.nodes.map((node: any) => 
          node.id === nodeId ? { ...node, finding } : node
        );
        
        return { ...oldData, nodes: updatedNodes };
      });
      
      // Force refetch nodes query to update the UI with finding data
      queryClient.refetchQueries({ queryKey: nodeKeys.list(projectId) });
      // Invalidate timeline
      queryClient.invalidateQueries({ queryKey: ['timeline', projectId] });
      toast.success('Finding created successfully');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to create finding');
    },
  });
};

// Update finding mutation
export const useUpdateFinding = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ projectId, nodeId, data }: { projectId: string; nodeId: string; data: FindingsAPI.FindingUpdate }) =>
      FindingsAPI.findingsApi.updateNodeFinding(projectId, nodeId, data),
    onSuccess: (finding, { projectId, nodeId }) => {
      // Update the finding query
      queryClient.setQueryData(['finding', projectId, nodeId], finding);
      
      // Update the node data directly in the cache to include the updated finding
      queryClient.setQueryData<NodesWithLinks>(nodeKeys.list(projectId), (oldData) => {
        if (!oldData) return oldData;
        
        const updatedNodes = oldData.nodes.map((node: any) => 
          node.id === nodeId ? { ...node, finding } : node
        );
        
        return { ...oldData, nodes: updatedNodes };
      });
      
      // Force refetch nodes query to update the UI with finding data
      queryClient.refetchQueries({ queryKey: nodeKeys.list(projectId) });
      // Invalidate timeline
      queryClient.invalidateQueries({ queryKey: ['timeline', projectId] });
      toast.success('Finding updated successfully');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to update finding');
    },
  });
};

// Delete finding mutation
export const useDeleteFinding = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ projectId, nodeId }: { projectId: string; nodeId: string }) =>
      FindingsAPI.findingsApi.deleteNodeFinding(projectId, nodeId),
    onSuccess: (_, { projectId, nodeId }) => {
      // Remove the finding from cache
      queryClient.setQueryData(['finding', projectId, nodeId], null);
      
      // Update the node data directly in the cache to remove the finding
      queryClient.setQueryData<NodesWithLinks>(nodeKeys.list(projectId), (oldData) => {
        if (!oldData) return oldData;
        
        const updatedNodes = oldData.nodes.map((node: any) => 
          node.id === nodeId ? { ...node, finding: null } : node
        );
        
        return { ...oldData, nodes: updatedNodes };
      });
      
      // Invalidate nodes query to update the UI
      queryClient.invalidateQueries({ queryKey: nodeKeys.list(projectId) });
      // Invalidate timeline
      queryClient.invalidateQueries({ queryKey: ['timeline', projectId] });
      toast.success('Finding deleted successfully');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to delete finding');
    },
  });
};

// Get project timeline
export const useProjectTimeline = (projectId: string) => {
  return useQuery({
    queryKey: ['timeline', projectId],
    queryFn: () => FindingsAPI.findingsApi.getProjectTimeline(projectId),
    enabled: !!projectId,
  });
};