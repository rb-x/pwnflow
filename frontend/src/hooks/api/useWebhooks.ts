import {
  type QueryClient,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { webhooksApi } from "@/services/api/webhooks";
import type { WebhookScopedCreate, WebhookUpdate } from "@/types";
import { toast } from "sonner";

const webhookKeys = {
  list: (scope?: "global" | "project", projectId?: string) =>
    ["webhooks", scope ?? "all", projectId ?? "all"] as const,
};

export function useWebhooks(scope?: "global" | "project", projectId?: string) {
  return useQuery({
    queryKey: webhookKeys.list(scope, projectId),
    queryFn: () => webhooksApi.listAll({ scope, projectId }),
  });
}

function invalidateAllWebhooks(queryClient: QueryClient) {
  queryClient.invalidateQueries({ queryKey: ["webhooks"] });
}

export function useCreateScopedWebhook() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: WebhookScopedCreate) => webhooksApi.createScoped(payload),
    onSuccess: () => {
      invalidateAllWebhooks(queryClient);
      toast.success("Route created");
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || "Failed to create route");
    },
  });
}

export function useUpdateScopedWebhook() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: WebhookUpdate }) =>
      webhooksApi.updateScoped(id, data),
    onSuccess: () => {
      invalidateAllWebhooks(queryClient);
      toast.success("Route updated");
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || "Failed to update route");
    },
  });
}

export function useDeleteScopedWebhook() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => webhooksApi.removeScoped(id),
    onSuccess: () => {
      invalidateAllWebhooks(queryClient);
      toast.success("Route deleted");
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || "Failed to delete route");
    },
  });
}
