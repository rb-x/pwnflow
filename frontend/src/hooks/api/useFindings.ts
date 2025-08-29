import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as FindingsAPI from '@/services/api/findings';
import { nodeKeys } from '@/hooks/api/useNodes';
import { toast } from 'sonner';

// Get finding for a specific node
export const useNodeFinding = (projectId: string, nodeId: string, options?: { enabled?: boolean }) => {
  return useQuery({
    queryKey: ['finding', projectId, nodeId],
    queryFn: () => FindingsAPI.findingsApi.getNodeFinding(projectId, nodeId),
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
      // Invalidate nodes query to update the UI
      queryClient.invalidateQueries({ queryKey: nodeKeys.list(projectId) });
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
    mutationFn: ({ projectId, findingId, data }: { projectId: string; findingId: string; data: FindingsAPI.FindingUpdate }) =>
      FindingsAPI.findingsApi.updateFinding(projectId, findingId, data),
    onSuccess: (finding, { projectId }) => {
      // Update the finding query
      queryClient.setQueryData(['finding', projectId, finding.node_id], finding);
      // Invalidate nodes query to update the UI
      queryClient.invalidateQueries({ queryKey: nodeKeys.list(projectId) });
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
    mutationFn: ({ projectId, findingId, nodeId }: { projectId: string; findingId: string; nodeId: string }) =>
      FindingsAPI.findingsApi.deleteFinding(projectId, findingId),
    onSuccess: (_, { projectId, nodeId }) => {
      // Remove the finding from cache
      queryClient.setQueryData(['finding', projectId, nodeId], null);
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