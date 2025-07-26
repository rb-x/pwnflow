import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { commandsService } from "@/services/api/commands";
import type { Command, CommandCreate, CommandUpdate } from "@/types/api";
import { toast } from "sonner";

// Query keys
const commandKeys = {
  all: ["commands"] as const,
  byNode: (projectId: string, nodeId: string) =>
    [...commandKeys.all, "project", projectId, "node", nodeId] as const,
  detail: (projectId: string, nodeId: string, commandId: string) =>
    [...commandKeys.byNode(projectId, nodeId), commandId] as const,
};

// Get all commands for a node
export function useNodeCommands(projectId: string, nodeId: string) {
  return useQuery({
    queryKey: commandKeys.byNode(projectId, nodeId),
    queryFn: () => commandsService.getNodeCommands(projectId, nodeId),
    enabled: !!projectId && !!nodeId,
  });
}

// Get a specific command
export function useCommand(
  projectId: string,
  nodeId: string,
  commandId: string
) {
  return useQuery({
    queryKey: commandKeys.detail(projectId, nodeId, commandId),
    queryFn: () => commandsService.getCommand(projectId, nodeId, commandId),
    enabled: !!projectId && !!nodeId && !!commandId,
  });
}

// Create a command
export function useCreateCommand() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      projectId,
      nodeId,
      data,
    }: {
      projectId: string;
      nodeId: string;
      data: CommandCreate;
    }) => commandsService.createCommand(projectId, nodeId, data),
    onSuccess: (newCommand, { projectId, nodeId }) => {
      // Invalidate and refetch commands for the node
      queryClient.invalidateQueries({
        queryKey: commandKeys.byNode(projectId, nodeId),
      });
      // Also invalidate the node query to update the commands array
      queryClient.invalidateQueries({
        queryKey: ["nodes", "project", projectId],
      });
      toast.success("Command created successfully");
    },
    onError: (error) => {
      console.error("Failed to create command:", error);
      toast.error("Failed to create command");
    },
  });
}

// Update a command
export function useUpdateCommand() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      projectId,
      nodeId,
      commandId,
      data,
    }: {
      projectId: string;
      nodeId: string;
      commandId: string;
      data: CommandUpdate;
    }) => commandsService.updateCommand(projectId, nodeId, commandId, data),
    onSuccess: (updatedCommand, { projectId, nodeId, commandId }) => {
      // Update the specific command in cache
      queryClient.setQueryData(
        commandKeys.detail(projectId, nodeId, commandId),
        updatedCommand
      );
      // Invalidate list queries
      queryClient.invalidateQueries({
        queryKey: commandKeys.byNode(projectId, nodeId),
      });
      toast.success("Command updated successfully");
    },
    onError: (error) => {
      console.error("Failed to update command:", error);
      toast.error("Failed to update command");
    },
  });
}

// Delete a command
export function useDeleteCommand() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      projectId,
      nodeId,
      commandId,
    }: {
      projectId: string;
      nodeId: string;
      commandId: string;
    }) => commandsService.deleteCommand(projectId, nodeId, commandId),
    onSuccess: (_, { projectId, nodeId }) => {
      // Invalidate and refetch commands for the node
      queryClient.invalidateQueries({
        queryKey: commandKeys.byNode(projectId, nodeId),
      });
      // Also invalidate the node query to update the commands array
      queryClient.invalidateQueries({
        queryKey: ["nodes", "project", projectId],
      });
      toast.success("Command deleted successfully");
    },
    onError: (error) => {
      console.error("Failed to delete command:", error);
      toast.error("Failed to delete command");
    },
  });
}
