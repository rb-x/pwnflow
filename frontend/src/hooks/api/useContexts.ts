import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { contextsApi } from "@/services/api/contexts";
import type {
  Context,
  ContextCreate,
  ContextUpdate,
  Variable,
  VariableCreate,
  VariableUpdate,
} from "@/types/api";
import { toast } from "sonner";

// Query keys
const contextKeys = {
  all: ["contexts"] as const,
  lists: () => [...contextKeys.all, "list"] as const,
  list: (projectId: string) => [...contextKeys.lists(), projectId] as const,
  details: () => [...contextKeys.all, "detail"] as const,
  detail: (contextId: string) => [...contextKeys.details(), contextId] as const,
};

// Get contexts for a project
export function useProjectContexts(projectId: string) {
  return useQuery({
    queryKey: contextKeys.list(projectId),
    queryFn: async () => {
      const response = await contextsApi.list(projectId);
      return response.data;
    },
    enabled: !!projectId,
  });
}

// Get single context
export function useContext(projectId: string, contextId: string) {
  return useQuery({
    queryKey: contextKeys.detail(contextId),
    queryFn: async () => {
      const response = await contextsApi.get(projectId, contextId);
      return response.data;
    },
    enabled: !!contextId && !!projectId,
  });
}

// Create context
export function useCreateContext() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      projectId,
      data,
    }: {
      projectId: string;
      data: ContextCreate;
    }) => {
      const response = await contextsApi.create(projectId, data);
      return response.data;
    },
    onSuccess: (_, { projectId }) => {
      queryClient.invalidateQueries({ queryKey: contextKeys.list(projectId) });
      toast.success("Context created");
    },
    onError: (error: any) => {
      console.error("Failed to create context:", error);
      toast.error("Failed to create context");
    },
  });
}

// Update context
export function useUpdateContext() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      projectId,
      contextId,
      data,
    }: {
      projectId: string;
      contextId: string;
      data: ContextUpdate;
    }) => {
      const response = await contextsApi.update(projectId, contextId, data);
      return response.data;
    },
    onSuccess: (_, { projectId, contextId }) => {
      queryClient.invalidateQueries({ queryKey: contextKeys.list(projectId) });
      queryClient.invalidateQueries({
        queryKey: contextKeys.detail(contextId),
      });
      toast.success("Context updated");
    },
    onError: (error: any) => {
      console.error("Failed to update context:", error);
      toast.error("Failed to update context");
    },
  });
}

// Delete context
export function useDeleteContext() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      projectId,
      contextId,
    }: {
      projectId: string;
      contextId: string;
    }) => {
      await contextsApi.delete(projectId, contextId);
      return { projectId, contextId };
    },
    onSuccess: ({ projectId }) => {
      queryClient.invalidateQueries({ queryKey: contextKeys.list(projectId) });
      toast.success("Context deleted");
    },
    onError: (error: any) => {
      console.error("Failed to delete context:", error);
      toast.error("Failed to delete context");
    },
  });
}

// Create variable
export function useCreateVariable() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      projectId,
      contextId,
      data,
    }: {
      projectId: string;
      contextId: string;
      data: VariableCreate;
    }) => {
      const response = await contextsApi.createVariable(
        projectId,
        contextId,
        data
      );
      return response.data;
    },
    onSuccess: (_, { projectId, contextId }) => {
      queryClient.invalidateQueries({ queryKey: contextKeys.list(projectId) });
      queryClient.invalidateQueries({
        queryKey: contextKeys.detail(contextId),
      });
      toast.success("Variable created");
    },
    onError: (error: any) => {
      console.error("Failed to create variable:", error);
      toast.error("Failed to create variable");
    },
  });
}

// Update variable
export function useUpdateVariable() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      projectId,
      contextId,
      variableId,
      data,
    }: {
      projectId: string;
      contextId: string;
      variableId: string;
      data: VariableUpdate;
    }) => {
      const response = await contextsApi.updateVariable(
        projectId,
        contextId,
        variableId,
        data
      );
      return response.data;
    },
    onSuccess: (_, { projectId, contextId }) => {
      queryClient.invalidateQueries({ queryKey: contextKeys.list(projectId) });
      queryClient.invalidateQueries({
        queryKey: contextKeys.detail(contextId),
      });
      toast.success("Variable updated");
    },
    onError: (error: any) => {
      console.error("Failed to update variable:", error);
      toast.error("Failed to update variable");
    },
  });
}

// Delete variable
export function useDeleteVariable() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      projectId,
      contextId,
      variableId,
    }: {
      projectId: string;
      contextId: string;
      variableId: string;
    }) => {
      await contextsApi.deleteVariable(projectId, contextId, variableId);
      return { projectId, contextId, variableId };
    },
    onSuccess: ({ projectId, contextId }) => {
      queryClient.invalidateQueries({ queryKey: contextKeys.list(projectId) });
      queryClient.invalidateQueries({
        queryKey: contextKeys.detail(contextId),
      });
      toast.success("Variable deleted");
    },
    onError: (error: any) => {
      console.error("Failed to delete variable:", error);
      toast.error("Failed to delete variable");
    },
  });
}
