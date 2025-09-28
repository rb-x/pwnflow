import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { webhooksApi } from "@/services/api/webhooks";
import type { WebhookCreate, WebhookUpdate } from "@/types";
import { toast } from "sonner";

const webhookKeys = {
  list: (projectId: string) => ["webhooks", projectId] as const,
};

export function useProjectWebhooks(projectId: string) {
  return useQuery({
    queryKey: webhookKeys.list(projectId),
    queryFn: () => webhooksApi.list(projectId),
    enabled: !!projectId,
  });
}

export function useCreateWebhook(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: WebhookCreate) => webhooksApi.create(projectId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: webhookKeys.list(projectId) });
      toast.success("Route created");
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || "Failed to create route");
    },
  });
}

export function useUpdateWebhook(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: WebhookUpdate }) =>
      webhooksApi.update(projectId, id, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: webhookKeys.list(projectId) });
      toast.success("Route updated");
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || "Failed to update route");
    },
  });
}

export function useDeleteWebhook(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (webhookId: string) => webhooksApi.remove(projectId, webhookId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: webhookKeys.list(projectId) });
      toast.success("Route deleted");
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || "Failed to delete route");
    },
  });
}
