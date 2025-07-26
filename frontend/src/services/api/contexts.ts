import { apiClient } from "./client";
import type {
  Context,
  ContextCreate,
  ContextUpdate,
  Variable,
  VariableCreate,
  VariableUpdate,
} from "@/types/api";

export const contextsApi = {
  // Context CRUD
  list: (projectId: string) =>
    apiClient.get<Context[]>(`/projects/${projectId}/contexts`),

  get: (projectId: string, contextId: string) =>
    apiClient.get<Context>(`/projects/${projectId}/contexts/${contextId}`),

  create: (projectId: string, data: ContextCreate) =>
    apiClient.post<Context>(`/projects/${projectId}/contexts`, data),

  update: (projectId: string, contextId: string, data: ContextUpdate) =>
    apiClient.put<Context>(
      `/projects/${projectId}/contexts/${contextId}`,
      data
    ),

  delete: (projectId: string, contextId: string) =>
    apiClient.delete(`/projects/${projectId}/contexts/${contextId}`),

  // Variable CRUD
  createVariable: (
    projectId: string,
    contextId: string,
    data: VariableCreate
  ) =>
    apiClient.post<Variable>(
      `/projects/${projectId}/contexts/${contextId}/variables`,
      data
    ),

  updateVariable: (
    projectId: string,
    contextId: string,
    variableId: string,
    data: VariableUpdate
  ) =>
    apiClient.put<Variable>(
      `/projects/${projectId}/contexts/${contextId}/variables/${variableId}`,
      data
    ),

  deleteVariable: (projectId: string, contextId: string, variableId: string) =>
    apiClient.delete(
      `/projects/${projectId}/contexts/${contextId}/variables/${variableId}`
    ),
};
