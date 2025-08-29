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
    apiClient.post<Finding>(`/projects/${projectId}/nodes/${nodeId}/finding`, data),

  // Get finding for a node
  getNodeFinding: (projectId: string, nodeId: string) =>
    apiClient.get<Finding>(`/projects/${projectId}/nodes/${nodeId}/finding`),

  // Get finding by ID
  getFinding: (projectId: string, findingId: string) =>
    apiClient.get<Finding>(`/projects/${projectId}/findings/${findingId}`),

  // Update finding
  updateFinding: (projectId: string, findingId: string, data: FindingUpdate) =>
    apiClient.put<Finding>(`/projects/${projectId}/findings/${findingId}`, data),

  // Delete finding
  deleteFinding: (projectId: string, findingId: string) =>
    apiClient.delete(`/projects/${projectId}/findings/${findingId}`),

  // Get project timeline
  getProjectTimeline: (projectId: string) =>
    apiClient.get<Array<any>>(`/projects/${projectId}/timeline`),
};