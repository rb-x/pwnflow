import { apiClient } from "./client";
import type { Node, NodeCreate, NodeUpdate, CommandCreate } from "@/types/api";

export interface NodePositionUpdate {
  id: string;
  x_pos: number;
  y_pos: number;
}

export interface BulkNodePositionUpdate {
  nodes: NodePositionUpdate[];
}

export const nodesApi = {
  // Get all nodes for a project
  list: (projectId: string) => apiClient.get(`/projects/${projectId}/nodes`),

  // Get a single node
  get: (projectId: string, nodeId: string) =>
    apiClient.get<Node>(`/projects/${projectId}/nodes/${nodeId}`),

  // Create a new node
  create: (projectId: string, data: NodeCreate) =>
    apiClient.post<Node>(`/projects/${projectId}/nodes`, data),

  // Update a node
  update: (projectId: string, nodeId: string, data: NodeUpdate) =>
    apiClient.put<Node>(`/projects/${projectId}/nodes/${nodeId}`, data),

  // Delete a node
  delete: (projectId: string, nodeId: string) =>
    apiClient.delete(`/projects/${projectId}/nodes/${nodeId}`),

  // Duplicate a node
  duplicate: (projectId: string, nodeId: string) =>
    apiClient.post<Node>(`/projects/${projectId}/nodes/${nodeId}/duplicate`),

  // Link nodes
  linkNodes: (projectId: string, sourceId: string, targetId: string) =>
    apiClient.post(`/projects/${projectId}/nodes/${sourceId}/link/${targetId}`),

  // Unlink nodes
  unlinkNodes: (projectId: string, sourceId: string, targetId: string) =>
    apiClient.delete(
      `/projects/${projectId}/nodes/${sourceId}/link/${targetId}`
    ),

  // Bulk update node positions
  bulkUpdatePositions: (projectId: string, data: BulkNodePositionUpdate) =>
    apiClient.put(`/projects/${projectId}/nodes/bulk/positions`, data),

  // Bulk delete nodes
  bulkDelete: (projectId: string, nodeIds: string[]) =>
    apiClient.post(`/projects/${projectId}/nodes/bulk-delete`, {
      node_ids: nodeIds,
    }),

  // Add command to node
  addCommand: (projectId: string, nodeId: string, data: CommandCreate) =>
    apiClient.post(`/projects/${projectId}/nodes/${nodeId}/commands`, data),
};
