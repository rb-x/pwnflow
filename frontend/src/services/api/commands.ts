import { apiClient } from "./client";
import type { Command, CommandCreate, CommandUpdate } from "@/types/api";

export const commandsService = {
  /**
   * Get all commands for a node
   */
  async getNodeCommands(projectId: string, nodeId: string): Promise<Command[]> {
    const response = await apiClient.get<Command[]>(
      `/projects/${projectId}/nodes/${nodeId}/commands`
    );
    return response.data;
  },

  /**
   * Get a specific command by ID
   */
  async getCommand(
    projectId: string,
    nodeId: string,
    commandId: string
  ): Promise<Command> {
    const response = await apiClient.get<Command>(
      `/projects/${projectId}/nodes/${nodeId}/commands/${commandId}`
    );
    return response.data;
  },

  /**
   * Create a new command for a node
   */
  async createCommand(
    projectId: string,
    nodeId: string,
    data: CommandCreate
  ): Promise<Command> {
    const response = await apiClient.post<Command>(
      `/projects/${projectId}/nodes/${nodeId}/commands`,
      data
    );
    return response.data;
  },

  /**
   * Update a command
   */
  async updateCommand(
    projectId: string,
    nodeId: string,
    commandId: string,
    data: CommandUpdate
  ): Promise<Command> {
    const response = await apiClient.put<Command>(
      `/projects/${projectId}/nodes/${nodeId}/commands/${commandId}`,
      data
    );
    return response.data;
  },

  /**
   * Delete a command
   */
  async deleteCommand(
    projectId: string,
    nodeId: string,
    commandId: string
  ): Promise<void> {
    await apiClient.delete(
      `/projects/${projectId}/nodes/${nodeId}/commands/${commandId}`
    );
  },

  async executeCommand(
    projectId: string,
    nodeId: string,
    commandId: string
  ): Promise<void> {
    await apiClient.post(
      `/projects/${projectId}/nodes/${nodeId}/commands/${commandId}/trigger`
    );
  },
};
