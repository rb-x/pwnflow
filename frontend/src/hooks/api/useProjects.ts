import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { projectsApi } from "@/services/api/projects";
import type { ProjectCreate, ProjectUpdate } from "@/types";
import { toast } from "sonner";

// Query keys factory
export const projectKeys = {
  all: ["projects"] as const,
  lists: () => [...projectKeys.all, "list"] as const,
  list: (filters?: string) => [...projectKeys.lists(), { filters }] as const,
  details: () => [...projectKeys.all, "detail"] as const,
  detail: (id: string) => [...projectKeys.details(), id] as const,
  nodes: (id: string) => [...projectKeys.detail(id), "nodes"] as const,
};

// Queries
export function useProjects() {
  return useQuery({
    queryKey: projectKeys.lists(),
    queryFn: () => projectsApi.getAll(),
  });
}

export function useProject(projectId: string) {
  return useQuery({
    queryKey: projectKeys.detail(projectId),
    queryFn: () => projectsApi.getById(projectId),
    enabled: !!projectId,
  });
}

// Mutations
export function useCreateProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (project: ProjectCreate) => projectsApi.create(project),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: projectKeys.lists() });
      toast.success("Project created successfully");
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || "Failed to create project");
    },
  });
}

export function useUpdateProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, ...data }: { id: string } & ProjectUpdate) =>
      projectsApi.update(id, data),
    onMutate: async ({ suppressToast }: any) => {
      // Store suppressToast flag in mutation context
      return { suppressToast };
    },
    onSuccess: (_, variables, context) => {
      queryClient.invalidateQueries({
        queryKey: projectKeys.detail(variables.id),
      });
      queryClient.invalidateQueries({ queryKey: projectKeys.lists() });

      // Only show toast if not suppressed
      if (!context?.suppressToast) {
        toast.success("Project updated");
      }
    },
    onError: (error: any) => {
      const errorMessage =
        error?.response?.data?.detail ||
        error?.message ||
        "Failed to update project";
      toast.error(
        typeof errorMessage === "string"
          ? errorMessage
          : "Failed to update project"
      );
    },
  });
}

export function useDeleteProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => projectsApi.delete(id),
    onSuccess: (_, projectId) => {
      queryClient.invalidateQueries({ queryKey: projectKeys.lists() });
      
      // Clean up chat localStorage for the deleted project
      try {
        const chatKey = `penflow-chat-${projectId}`;
        localStorage.removeItem(chatKey);
      } catch (e) {
        console.warn("Failed to clean up chat storage:", e);
      }
      
      toast.success("Project deleted");
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || "Failed to delete project");
    },
  });
}

export function useBulkDeleteProjects() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (projectIds: string[]) => projectsApi.bulkDelete(projectIds),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: projectKeys.lists() });
      
      // Clean up chat localStorage for all deleted projects
      result.deleted.forEach(projectId => {
        try {
          const chatKey = `penflow-chat-${projectId}`;
          localStorage.removeItem(chatKey);
        } catch (e) {
          console.warn("Failed to clean up chat storage:", e);
        }
      });
      
      if (result.failed.length > 0) {
        toast.warning(
          `Deleted ${result.total_deleted} projects. ${result.failed.length} failed.`
        );
      } else {
        toast.success(`Successfully deleted ${result.total_deleted} projects`);
      }
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || "Failed to delete projects");
    },
  });
}

export function useImportTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      projectId,
      templateId,
      offsetX,
      offsetY,
    }: {
      projectId: string;
      templateId: string;
      offsetX?: number;
      offsetY?: number;
    }) => projectsApi.importTemplate(projectId, templateId, offsetX, offsetY),
    onSuccess: (_, variables) => {
      // Invalidate the project nodes to refetch with the new imported nodes
      queryClient.invalidateQueries({
        queryKey: projectKeys.nodes(variables.projectId),
      });
      queryClient.invalidateQueries({
        queryKey: ["nodes", "list", variables.projectId],
      });
      toast.success("Template imported successfully");
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || "Failed to import template");
    },
  });
}
