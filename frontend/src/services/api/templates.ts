import { apiClient } from "./client";
import type { Template, TemplateCreate, TemplateUpdate } from "@/types";

export const templatesApi = {
  getAll: async (): Promise<Template[]> => {
    const response = await apiClient.get<Template[]>("/templates");
    return response.data;
  },

  getById: async (id: string): Promise<Template> => {
    const response = await apiClient.get<Template>(`/templates/${id}`);
    return response.data;
  },

  create: async (template: TemplateCreate): Promise<Template> => {
    const response = await apiClient.post<Template>("/templates", template);
    return response.data;
  },

  update: async (id: string, template: TemplateUpdate): Promise<Template> => {
    const response = await apiClient.put<Template>(
      `/templates/${id}`,
      template
    );
    return response.data;
  },

  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/templates/${id}`);
  },

  // Bulk operations
  bulkDelete: async (templateIds: string[]): Promise<{
    deleted: string[];
    failed: Array<{ id: string; reason: string }>;
    total_deleted: number;
  }> => {
    const response = await apiClient.post("/templates/bulk-delete", {
      template_ids: templateIds,
    });
    return response.data;
  },

  cloneToProject: async (
    templateId: string,
    projectName: string,
    projectDescription?: string
  ): Promise<any> => {
    const response = await apiClient.post("/projects", {
      name: projectName,
      description: projectDescription,
      source_template_id: templateId,
    });
    return response.data;
  },

  getNodes: async (
    templateId: string
  ): Promise<{ nodes: any[]; links: any[] }> => {
    const response = await apiClient.get<{ nodes: any[]; links: any[] }>(
      `/templates/${templateId}/nodes`
    );
    return response.data;
  },
};
