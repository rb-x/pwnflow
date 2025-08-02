import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { templatesApi } from "@/services/api/templates";
import type { TemplateCreate, TemplateUpdate } from "@/types";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

// Query keys factory
export const templateKeys = {
  all: ["templates"] as const,
  lists: () => [...templateKeys.all, "list"] as const,
  list: (filters?: string) => [...templateKeys.lists(), { filters }] as const,
  details: () => [...templateKeys.all, "detail"] as const,
  detail: (id: string) => [...templateKeys.details(), id] as const,
};

// Queries
export function useTemplates() {
  return useQuery({
    queryKey: templateKeys.lists(),
    queryFn: () => templatesApi.getAll(),
  });
}

export function useTemplate(templateId: string) {
  return useQuery({
    queryKey: templateKeys.detail(templateId),
    queryFn: () => templatesApi.getById(templateId),
    enabled: !!templateId,
  });
}

// Mutations
export function useCreateTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (template: TemplateCreate) => templatesApi.create(template),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: templateKeys.lists() });
      toast.success("Template created successfully");
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || "Failed to create template");
    },
  });
}

export function useUpdateTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, ...data }: { id: string } & TemplateUpdate) =>
      templatesApi.update(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: templateKeys.detail(variables.id),
      });
      queryClient.invalidateQueries({ queryKey: templateKeys.lists() });
      toast.success("Template updated");
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || "Failed to update template");
    },
  });
}

export function useDeleteTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => templatesApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: templateKeys.lists() });
      toast.success("Template deleted");
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || "Failed to delete template");
    },
  });
}

export function useBulkDeleteTemplates() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (templateIds: string[]) => templatesApi.bulkDelete(templateIds),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: templateKeys.lists() });
      
      if (result.failed.length > 0) {
        toast.warning(
          `Deleted ${result.total_deleted} templates. ${result.failed.length} failed.`
        );
      } else {
        toast.success(`Successfully deleted ${result.total_deleted} templates`);
      }
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || "Failed to delete templates");
    },
  });
}

export function useCreateProjectFromTemplate() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      templateId,
      name,
      description,
    }: {
      templateId: string;
      name: string;
      description?: string;
    }) => templatesApi.cloneToProject(templateId, name, description),
    onSuccess: (project) => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      // Also invalidate node queries to ensure fresh data for the new project
      queryClient.invalidateQueries({ queryKey: ["nodes", "project", project.id] });
      queryClient.invalidateQueries({ queryKey: ["commands"] });
      toast.success("Project created from template");
      navigate(`/projects/${project.id}`);
    },
    onError: (error: any) => {
      toast.error(
        error.response?.data?.detail || "Failed to create project from template"
      );
    },
  });
}
