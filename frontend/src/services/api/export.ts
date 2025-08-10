import { apiClient } from "./client";
import { env } from "@/config/env";

export interface ExportEncryption {
  method: "none" | "password" | "generated";
  password?: string;
}

export interface ExportOptions {
  include_variables?: boolean;
}

export interface ProjectExportRequest {
  encryption: ExportEncryption;
  options?: ExportOptions;
}

export interface TemplateExportRequest {
  encryption: ExportEncryption;
}

export interface ExportJobResponse {
  job_id: string;
  status: string;
  download_url?: string;
  generated_password?: string;
}

export type ImportPreviewResponse = {
  type?: string;
  name: string;
  description?: string;
  node_count: number;
  context_count: number;
  command_count: number;
  variable_count: number;
  tag_count: number;
  exported_at: string;
  format_version: string;
};

export const exportApi = {
  // Project export
  exportProject: async (projectId: string, request: ProjectExportRequest) => {
    const response = await apiClient.post<ExportJobResponse>(
      `/projects/${projectId}/export`,
      request
    );
    return response.data;
  },

  // Template export
  exportTemplate: async (
    templateId: string,
    request: TemplateExportRequest
  ) => {
    const response = await apiClient.post<ExportJobResponse>(
      `/templates/${templateId}/export`,
      request
    );
    return response.data;
  },

  // Download exported file
  getDownloadUrl: (jobId: string) => {
    const baseUrl =
      env.API_BASE_URL;
    return `${baseUrl}/exports/download/${jobId}`;
  },

  // Download file with authentication
  downloadFile: async (jobId: string, filename: string) => {
    const response = await apiClient.get(`/exports/download/${jobId}`, {
      responseType: "blob",
    });

    // Create blob URL and trigger download
    const blob = new Blob([response.data]);
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();

    // Cleanup
    setTimeout(() => {
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    }, 100);
  },

  // Preview project import
  previewProjectImport: async (file: File, password?: string) => {
    const formData = new FormData();
    formData.append("file", file);
    if (password) {
      formData.append("password", password);
    }

    const response = await apiClient.post<ImportPreviewResponse>(
      "/projects/import/preview",
      formData
    );
    return response.data;
  },

  // Import project
  importProject: async (
    file: File,
    password?: string,
    importMode: "new" | "merge" = "new",
    targetProjectId?: string
  ) => {
    const formData = new FormData();
    formData.append("file", file);
    if (password) {
      formData.append("password", password);
    }
    formData.append("import_mode", importMode);
    if (targetProjectId) {
      formData.append("target_project_id", targetProjectId);
    }

    const response = await apiClient.post<{
      success: boolean;
      project_id: string;
      message: string;
    }>("/projects/import", formData);
    return response.data;
  },

  // Preview template import
  previewTemplateImport: async (file: File, password?: string) => {
    const formData = new FormData();
    formData.append("file", file);
    if (password) {
      formData.append("password", password);
    }

    const response = await apiClient.post<ImportPreviewResponse>(
      "/templates/import/preview",
      formData
    );
    return response.data;
  },

  // Import template
  importTemplate: async (file: File, password?: string) => {
    const formData = new FormData();
    formData.append("file", file);
    if (password) {
      formData.append("password", password);
    }

    const response = await apiClient.post<{
      success: boolean;
      template_id: string;
      message: string;
    }>("/templates/import", formData);
    return response.data;
  },
};
