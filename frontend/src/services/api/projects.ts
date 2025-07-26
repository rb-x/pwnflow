import { apiClient } from "./client";
import type {
  Project,
  ProjectCreate,
  ProjectUpdate,
  Node,
  NodeCreate,
  NodeUpdate,
} from "@/types";

export const projectsApi = {
  // Projects
  getAll: async (skip = 0, limit = 100): Promise<Project[]> => {
    const { data } = await apiClient.get("/projects/", {
      params: { skip, limit },
    });
    return data;
  },

  getById: async (id: string): Promise<Project> => {
    const { data } = await apiClient.get(`/projects/${id}`);
    return data;
  },

  create: async (project: ProjectCreate): Promise<Project> => {
    const { data } = await apiClient.post("/projects/", project);
    return data;
  },

  update: async (id: string, project: ProjectUpdate): Promise<Project> => {
    const { data } = await apiClient.put(`/projects/${id}`, project);
    return data;
  },

  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/projects/${id}`);
  },

  // Bulk operations
  bulkDelete: async (projectIds: string[]): Promise<{
    deleted: string[];
    failed: Array<{ id: string; reason: string }>;
    total_deleted: number;
  }> => {
    const { data } = await apiClient.post("/projects/bulk-delete", {
      project_ids: projectIds,
    });
    return data;
  },

  // Category Tags
  addCategoryTag: async (
    projectId: string,
    tagName: string
  ): Promise<Project> => {
    const { data } = await apiClient.post(
      `/projects/${projectId}/category-tags/${tagName}`
    );
    return data;
  },

  removeCategoryTag: async (
    projectId: string,
    tagName: string
  ): Promise<Project> => {
    const { data } = await apiClient.delete(
      `/projects/${projectId}/category-tags/${tagName}`
    );
    return data;
  },

  // Nodes
  createNode: async (projectId: string, node: NodeCreate): Promise<Node> => {
    const { data } = await apiClient.post(
      `/projects/${projectId}/nodes/`,
      node
    );
    return data;
  },

  getNode: async (projectId: string, nodeId: string): Promise<Node> => {
    const { data } = await apiClient.get(
      `/projects/${projectId}/nodes/${nodeId}`
    );
    return data;
  },

  updateNode: async (
    projectId: string,
    nodeId: string,
    node: NodeUpdate
  ): Promise<Node> => {
    const { data } = await apiClient.put(
      `/projects/${projectId}/nodes/${nodeId}`,
      node
    );
    return data;
  },

  deleteNode: async (projectId: string, nodeId: string): Promise<void> => {
    await apiClient.delete(`/projects/${projectId}/nodes/${nodeId}`);
  },

  // Node relationships
  linkNodes: async (
    projectId: string,
    sourceId: string,
    targetId: string
  ): Promise<void> => {
    await apiClient.post(
      `/projects/${projectId}/nodes/${sourceId}/link/${targetId}`
    );
  },

  unlinkNodes: async (
    projectId: string,
    sourceId: string,
    targetId: string
  ): Promise<void> => {
    await apiClient.delete(
      `/projects/${projectId}/nodes/${sourceId}/link/${targetId}`
    );
  },

  // Import template
  importTemplate: async (
    projectId: string,
    templateId: string,
    offsetX?: number,
    offsetY?: number
  ): Promise<void> => {
    await apiClient.post(`/projects/${projectId}/import-template`, {
      template_id: templateId,
      offset_x: offsetX,
      offset_y: offsetY,
    });
  },
};
