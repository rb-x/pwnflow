import { apiClient } from "./client";
import type { ScopeAsset, ScopeTag } from "@/types/scope";

export interface CreateAssetRequest {
  ip: string;
  port: number;
  protocol: "tcp" | "udp";
  hostnames?: string[];
  vhosts?: string[];
}

export interface UpdateAssetRequest {
  protocol?: "tcp" | "udp";
  hostnames?: string[];
  vhosts?: string[];
  status?: "not_tested" | "testing" | "clean" | "vulnerable" | "exploitable";
  discovered_via?: "nmap" | "ssl-cert" | "http-vhosts" | "manual";
  notes?: string;
  tags?: Array<{
    id: string;
    name: string;
    color: string;
    is_predefined: boolean;
  }>;
}

export interface CreateTagRequest {
  name: string;
  color: string;
}

export interface ImportNmapRequest {
  xml_content: string;
  open_ports_only?: boolean;
  default_status?: "not_tested" | "testing" | "clean";
}

export const scopeApi = {
  // Get all assets for a project
  getAssets: (projectId: string) =>
    apiClient.get<ScopeAsset[]>(`/projects/${projectId}/scope/assets`),

  // Create a new asset
  createAsset: (projectId: string, data: CreateAssetRequest) =>
    apiClient.post<ScopeAsset>(`/projects/${projectId}/scope/assets`, data),

  // Update an asset
  updateAsset: (projectId: string, assetId: string, data: UpdateAssetRequest) =>
    apiClient.put<ScopeAsset>(`/projects/${projectId}/scope/assets/${assetId}`, data),

  // Delete an asset
  deleteAsset: (projectId: string, assetId: string) =>
    apiClient.delete(`/projects/${projectId}/scope/assets/${assetId}`),

  // Add tag to asset
  addTag: (projectId: string, assetId: string, data: CreateTagRequest) =>
    apiClient.post<ScopeTag>(`/projects/${projectId}/scope/assets/${assetId}/tags`, data),

  // Remove tag from asset
  removeTag: (projectId: string, assetId: string, tagId: string) =>
    apiClient.delete(`/projects/${projectId}/scope/assets/${assetId}/tags/${tagId}`),

  // Import Nmap XML
  importNmap: (projectId: string, data: ImportNmapRequest) =>
    apiClient.post(`/projects/${projectId}/scope/import-nmap`, data),
};