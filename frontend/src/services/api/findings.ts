import { apiClient } from "./client";

export interface FindingCreate {
  content: string;
  date?: string; // ISO date string
}

export interface FindingUpdate {
  content?: string;
  date?: string; // ISO date string
}

export interface Finding {
  id: string;
  content: string;
  date: string;
  node_id: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export const findingsApi = {
  // Create a finding for a node
  createFinding: (projectId: string, nodeId: string, data: FindingCreate) =>
    apiClient.post<Finding>(`/projects/${projectId}/nodes/${nodeId}/finding`, data).then(res => res.data),

  // Get finding for a node
  getNodeFinding: (projectId: string, nodeId: string) =>
    apiClient.get<Finding>(`/projects/${projectId}/nodes/${nodeId}/finding`).then(res => res.data),

  // Update finding for a node
  updateNodeFinding: (projectId: string, nodeId: string, data: FindingUpdate) =>
    apiClient.put<Finding>(`/projects/${projectId}/nodes/${nodeId}/finding`, data).then(res => res.data),

  // Delete finding for a node
  deleteNodeFinding: (projectId: string, nodeId: string) =>
    apiClient.delete(`/projects/${projectId}/nodes/${nodeId}/finding`).then(res => res.data),

  // Get project timeline
  getProjectTimeline: (projectId: string) =>
    apiClient.get<Array<any>>(`/projects/${projectId}/timeline`).then(res => res.data),
};