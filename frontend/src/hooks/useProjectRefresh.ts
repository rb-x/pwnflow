import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { projectKeys } from "./api/useProjects";
import { nodeKeys } from "./api/useNodes";
import { env } from "@/config/env";

export function useProjectRefresh(projectId: string) {
  const ws = useRef<WebSocket | null>(null);
  const queryClient = useQueryClient();
  const reconnectTimeout = useRef<NodeJS.Timeout>();
  const reconnectAttempts = useRef(0);
  const pingIntervalRef = useRef<NodeJS.Timeout>();
  const maxReconnectAttempts = 5;

  // Get token from localStorage directly
  const token = localStorage.getItem("penflow_token");

  useEffect(() => {
    if (!token || !projectId) return;

    let isCleanedUp = false;

    const connect = () => {
      // Don't connect if already cleaned up
      if (isCleanedUp) return;
      // Determine WebSocket URL based on current location
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const host = window.location.host;

      // Use dynamic WebSocket URL based on environment
      const isDev = import.meta.env.DEV;
      const wsUrl = isDev
        ? `ws://localhost:8000/ws/projects/${projectId}` // Development
        : `${protocol}//${host}/ws/projects/${projectId}`; // Production

      // console.log("[useProjectRefresh] Creating WebSocket with URL:", wsUrl);
      ws.current = new WebSocket(wsUrl);

      ws.current.onopen = () => {
        // console.log("WebSocket opened, sending auth...");
        // Send authentication as first message
        ws.current!.send(JSON.stringify({ token }));
        reconnectAttempts.current = 0;
      };

      ws.current.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          // Only log important messages, not pings/pongs

          // Handle different event types
          switch (data.type) {
            case "connected":
              // console.log("WebSocket connection confirmed");
              break;

            case "pong":
              // Ignore pong responses
              break;

            case "nodes_changed":
              // Generic refresh - just invalidate
              queryClient.invalidateQueries({
                queryKey: nodeKeys.list(projectId),
              });
              break;

            case "node_updated":
              // Optimistic update with node data
              if (data.data?.node) {
                // Update the cache directly with the new node data
                queryClient.setQueryData(
                  nodeKeys.list(projectId),
                  (oldData: any) => {
                    if (!oldData) return oldData;

                    return {
                      ...oldData,
                      nodes: oldData.nodes.map((node: any) =>
                        node.id === data.data.node.id ? data.data.node : node
                      ),
                    };
                  }
                );
              }
              break;

            case "project_changed":
              // Invalidate project query
              queryClient.invalidateQueries({
                queryKey: projectKeys.detail(projectId),
              });
              break;

            case "contexts_changed":
              // Invalidate context queries
              queryClient.invalidateQueries({
                queryKey: ["contexts", projectId],
              });
              break;

            case "import_completed":
              // Refresh nodes after import
              queryClient.invalidateQueries({
                queryKey: nodeKeys.list(projectId),
              });
              break;
          }
        } catch (error) {
          console.error("Error parsing WebSocket message:", error);
        }
      };

      ws.current.onclose = (event) => {

        // Attempt to reconnect with exponential backoff
        if (reconnectAttempts.current < maxReconnectAttempts) {
          const delay = Math.min(
            1000 * Math.pow(2, reconnectAttempts.current),
            30000
          );
          reconnectAttempts.current++;
          reconnectTimeout.current = setTimeout(connect, delay);
        }
      };

      ws.current.onerror = (error) => {
        console.error("WebSocket error:", error);
      };

      // Send ping every 30 seconds to keep connection alive
      const pingInterval = setInterval(() => {
        if (ws.current?.readyState === WebSocket.OPEN) {
          ws.current.send("ping");
        }
      }, 30000);

      // Store ping interval for cleanup
      pingIntervalRef.current = pingInterval;
    };

    // Initial connection with a small delay to avoid StrictMode race condition
    const connectTimeout = setTimeout(() => {
      if (!isCleanedUp) {
        connect();
      }
    }, 100);

    // Cleanup on unmount or dependencies change
    return () => {
      isCleanedUp = true;
      clearTimeout(connectTimeout);
      clearTimeout(reconnectTimeout.current);
      if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current);
      }
      if (ws.current && ws.current.readyState !== WebSocket.CLOSED) {
        ws.current.close(1000, "Component unmounting");
        ws.current = null;
      }
    };
  }, [projectId, token, queryClient]);
}
