import { apiClient } from "./client";
import type {
  Webhook,
  WebhookCreate,
  WebhookScopedCreate,
  WebhookUpdate,
} from "@/types";

export const webhooksApi = {
  async list(projectId: string): Promise<Webhook[]> {
    const response = await apiClient.get(`/projects/${projectId}/webhooks`);
    return response.data;
  },

  async listAll(params?: { scope?: "global" | "project"; projectId?: string }): Promise<Webhook[]> {
    const searchParams = new URLSearchParams();
    if (params?.scope) {
      searchParams.set("scope", params.scope);
    }
    if (params?.projectId) {
      searchParams.set("project_id", params.projectId);
    }

    const query = searchParams.toString();
    const response = await apiClient.get(`/webhooks${query ? `?${query}` : ""}`);
    return response.data;
  },

  async createScoped(data: WebhookScopedCreate): Promise<Webhook> {
    const response = await apiClient.post("/webhooks", data);
    return response.data;
  },

  async updateScoped(webhookId: string, data: WebhookUpdate): Promise<Webhook> {
    const response = await apiClient.put(`/webhooks/${webhookId}`, data);
    return response.data;
  },

  async removeScoped(webhookId: string): Promise<void> {
    await apiClient.delete(`/webhooks/${webhookId}`);
  },

  async create(projectId: string, data: WebhookCreate): Promise<Webhook> {
    return webhooksApi.createScoped({
      ...data,
      scope: "project",
      project_id: projectId,
    });
  },

  async update(
    projectId: string,
    webhookId: string,
    data: WebhookUpdate
  ): Promise<Webhook> {
    return webhooksApi.updateScoped(webhookId, data);
  },

  async remove(projectId: string, webhookId: string): Promise<void> {
    await webhooksApi.removeScoped(webhookId);
  },
};
