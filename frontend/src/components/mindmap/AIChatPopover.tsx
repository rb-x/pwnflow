import React, { useState, useEffect, useRef } from "react";
import {
  Send,
  Loader2,
  Sparkles,
  AlertCircle,
  ArrowUp,
  Trash2,
  FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { authService } from "@/services/auth/authService";
import { cn } from "@/lib/utils";
import { useMindMapStore } from "@/store/mindMapStore";
import ReactMarkdown from "react-markdown";
import {
  useCreateNode,
  useLinkNodes,
  useAddTag,
  nodeKeys,
  useProjectNodes,
} from "@/hooks/api/useNodes";
import { nodesApi } from "@/services/api/nodes";
import { toast } from "sonner";
import { CheckCircle2, Plus } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useAutoLayout } from "@/hooks/useAutoLayout";

interface CommandSuggestion {
  title: string;
  command: string;
  description: string;
}

interface NodeSuggestion {
  title: string;
  description: string;
  suggested_commands?: (string | CommandSuggestion)[];
  node_type?: string;
  parent_title?: string | null;
  suggested_tags?: string[];
}

interface Message {
  id: string;
  type: "user" | "assistant" | "system";
  content: string;
  timestamp: Date;
  suggestions?: NodeSuggestion[];
}

interface AIChatPopoverProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  children: React.ReactNode;
}

// Helper to get localStorage key for a project
const getChatStorageKey = (projectId: string) => `penflow-chat-${projectId}`;

// Helper to save messages to localStorage
const saveChatToStorage = (projectId: string, messages: Message[]) => {
  try {
    // Only save last 50 messages to avoid storage limits
    const messagesToSave = messages.slice(-50);
    localStorage.setItem(
      getChatStorageKey(projectId),
      JSON.stringify(messagesToSave)
    );
  } catch (e) {
    console.warn("Failed to save chat to localStorage:", e);
  }
};

// Helper to load messages from localStorage
const loadChatFromStorage = (projectId: string): Message[] => {
  try {
    const stored = localStorage.getItem(getChatStorageKey(projectId));
    if (stored) {
      const messages = JSON.parse(stored);
      // Convert timestamp strings back to Date objects
      return messages.map((msg: any) => ({
        ...msg,
        timestamp: new Date(msg.timestamp),
      }));
    }
  } catch (e) {
    console.warn("Failed to load chat from localStorage:", e);
  }
  return [];
};

export const AIChatPopover: React.FC<AIChatPopoverProps> = ({
  open,
  onOpenChange,
  projectId,
  children,
}) => {
  const [messages, setMessages] = useState<Message[]>(() =>
    loadChatFromStorage(projectId)
  );
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [chatMode, setChatMode] = useState<"chat" | "generate">("chat");

  const token = authService.getToken();
  const selectedNodeId = useMindMapStore((state) => state.selectedNodeId);
  const [isCreating, setIsCreating] = useState(false);

  const createNodeMutation = useCreateNode();
  const linkNodesMutation = useLinkNodes();
  const addTagMutation = useAddTag();
  const queryClient = useQueryClient();
  const { applyAutoLayout } = useAutoLayout(projectId);
  const layoutDirection = useMindMapStore((state) => state.layoutDirection);

  // Get nodes from the API
  const { data: nodesData } = useProjectNodes(projectId, false);
  const nodes = nodesData?.nodes || [];

  // Save messages to localStorage whenever they change
  useEffect(() => {
    if (messages.length > 0) {
      saveChatToStorage(projectId, messages);
    }
  }, [messages, projectId]);

  // Load initial message only if no saved messages
  useEffect(() => {
    if (
      open &&
      messages.length === 0 &&
      !loadChatFromStorage(projectId).length
    ) {
      const hasNodes = nodes && nodes.length > 0;
      const initialMessage = hasNodes
        ? 'Hey there! I\'m your cybersecurity assistant. I can analyze your mindmap, suggest improvements, and create comprehensive nodes.\n\n⚡ Quick tips:\n• I can create nodes directly - just say "create a node about X"\n• Right-click any node → \'AI Suggest Children\' for contextual suggestions\n• I\'ll generate detailed descriptions, commands, and tags\n\n⚠️ Important: I don\'t have memory between messages. Be specific in each request!\nInstead of "create another one", say "create a node about SQL injection"\n\nWhat security topic should we explore?'
        : "Hey there! I'm your cybersecurity assistant. Ready to build your security mindmap!\n\n🚀 You can:\n• Ask me to \"create nodes about web security\" (or any topic)\n• Create a node manually with + button, then right-click → 'AI Suggest Children'\n• I'll generate comprehensive nodes with:\n  - Detailed markdown descriptions\n  - Practical commands\n  - Relevant tags\n\n⚠️ Important: I don't have memory between messages. Be specific!\n\nWhat are you planning to assess?";

      addMessage({
        id: Date.now().toString(),
        type: "system",
        content: initialMessage,
        timestamp: new Date(),
      });
    }
  }, [open, nodes, projectId]);

  const addMessage = (message: Message) => {
    setMessages((prev) => [...prev, message]);
    // Scroll to bottom
    setTimeout(() => {
      if (scrollAreaRef.current) {
        const scrollContainer = scrollAreaRef.current.querySelector(
          "[data-radix-scroll-area-viewport]"
        );
        if (scrollContainer) {
          scrollContainer.scrollTop = scrollContainer.scrollHeight;
        }
      }
    }, 100);
  };

  const createNodesFromSuggestions = async (suggestions: NodeSuggestion[]) => {
    if (!suggestions || suggestions.length === 0) return;

    setIsCreating(true);
    const createdNodeIds: string[] = [];
    const nodeMap = new Map<string, string>(); // Map of title -> id for newly created nodes

    try {
      // First pass: Create all nodes
      for (const suggestion of suggestions) {
        const createdNode = await createNodeMutation.mutateAsync({
          projectId,
          data: {
            title: suggestion.title,
            description: suggestion.description || "",
            status: "NOT_STARTED",
            findings: null,
            x_pos: Math.random() * 600,
            y_pos: Math.random() * 400,
          },
        });

        createdNodeIds.push(createdNode.id);
        nodeMap.set(suggestion.title.toLowerCase(), createdNode.id);

        // Add commands if any
        if (
          suggestion.suggested_commands &&
          suggestion.suggested_commands.length > 0
        ) {
          for (const command of suggestion.suggested_commands) {
            try {
              // Handle both old string format and new object format
              let commandData;
              if (typeof command === "string") {
                // Old format - just a command string
                const commandTitle = command.split(" ")[0] || "Command";
                commandData = {
                  title:
                    commandTitle.charAt(0).toUpperCase() +
                    commandTitle.slice(1),
                  command: command,
                  description: null,
                };
              } else {
                // New format - command object with title, command, and description
                commandData = {
                  title: command.title,
                  command: command.command,
                  description: command.description,
                };
              }

              await nodesApi.addCommand(projectId, createdNode.id, commandData);
            } catch (error) {
              console.error("Failed to add command:", error);
            }
          }
        }

        // Add tags if any
        if (suggestion.suggested_tags && suggestion.suggested_tags.length > 0) {
          for (const tag of suggestion.suggested_tags) {
            try {
              await addTagMutation.mutateAsync({
                projectId,
                nodeId: createdNode.id,
                tagName: tag,
              });
            } catch (error) {
              console.error("Failed to add tag:", error);
            }
          }
        }
      }

      // Second pass: Create links
      for (let i = 0; i < suggestions.length; i++) {
        const suggestion = suggestions[i];
        const nodeId = createdNodeIds[i];

        if (suggestion.parent_title) {
          let parentNodeId: string | null = null;

          // First check if parent is in the newly created nodes
          parentNodeId =
            nodeMap.get(suggestion.parent_title.toLowerCase()) || null;

          // If not found, check existing nodes
          if (!parentNodeId && nodes && nodes.length > 0) {
            const parentNode = nodes.find(
              (n) =>
                n.title.toLowerCase() === suggestion.parent_title?.toLowerCase()
            );
            if (parentNode) {
              parentNodeId = parentNode.id;
            }
          }

          // Create the link if parent was found
          if (parentNodeId) {
            try {
              await linkNodesMutation.mutateAsync({
                projectId,
                sourceId: parentNodeId,
                targetId: nodeId,
              });
            } catch (error) {
              console.error(
                `Failed to link ${suggestion.title} to ${suggestion.parent_title}:`,
                error
              );
            }
          } else {
            console.warn(
              `Parent node "${suggestion.parent_title}" not found for "${suggestion.title}"`
            );
          }
        }
      }

      toast.success(`Created ${createdNodeIds.length} nodes from suggestions!`);

      // Invalidate the nodes query to refresh the graph
      await queryClient.invalidateQueries({
        queryKey: nodeKeys.list(projectId),
      });

      // Apply auto-layout after a short delay to ensure nodes are rendered
      setTimeout(() => {
        applyAutoLayout({
          direction: layoutDirection,
          animate: true,
        });
      }, 500);

      // Clear suggestions from the message
      setMessages((prev) =>
        prev.map((msg) =>
          msg.suggestions ? { ...msg, suggestions: undefined } : msg
        )
      );
    } catch (error) {
      console.error("Error creating nodes:", error);
      toast.error("Failed to create some nodes");
    } finally {
      setIsCreating(false);
    }
  };

  const exportChat = () => {
    const chatContent = messages
      .map((msg) => {
        const role =
          msg.type === "user"
            ? "You"
            : msg.type === "assistant"
            ? "AI"
            : "System";
        const time =
          msg.timestamp instanceof Date
            ? msg.timestamp.toLocaleString()
            : new Date(msg.timestamp).toLocaleString();
        return `[${time}] ${role}: ${msg.content}`;
      })
      .join("\n\n---\n\n");

    const blob = new Blob([chatContent], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `penflow-chat-${projectId}-${
      new Date().toISOString().split("T")[0]
    }.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast.success("Chat exported successfully!");
  };

  const clearChat = () => {
    setMessages([]);
    localStorage.removeItem(getChatStorageKey(projectId));
    toast.success("Chat cleared!");

    // Add welcome message again
    const hasNodes = nodes && nodes.length > 0;
    const initialMessage = hasNodes
      ? 'Chat cleared! Remember: I don\'t have memory of previous messages. Be specific with each request!\n\nExample: "Create a node about XSS vulnerabilities" instead of "create another one"\n\nWhat would you like to explore?'
      : "Chat cleared! Ready to start fresh.\n\n⚠️ Remember: Each message is independent - be specific!\n\nWhat security topic should we map out?";

    addMessage({
      id: Date.now().toString(),
      type: "system",
      content: initialMessage,
      timestamp: new Date(),
    });
  };

  const handleSend = async () => {
    if (!input.trim() || !projectId || isLoading) return;

    // Handle commands
    if (input.trim() === "/clear") {
      clearChat();
      setInput("");
      return;
    }

    if (input.trim() === "/export") {
      exportChat();
      setInput("");
      return;
    }

    if (!token) {
      setError("You must be logged in to use the AI assistant");
      return;
    }

    const userMessage: Message = {
      id: Date.now().toString(),
      type: "user",
      content: input,
      timestamp: new Date(),
    };

    addMessage(userMessage);
    const promptText = input;
    setInput("");
    setIsLoading(true);
    setError(null);

    const apiUrl =
      import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api/v1";

    try {
      const response = await fetch(`${apiUrl}/projects/${projectId}/ai/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          message: promptText,
          node_id: selectedNodeId,
          mode: selectedNodeId ? "node_context" : "general",
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = `HTTP error! status: ${response.status}`;
        try {
          const errorJson = JSON.parse(errorText);
          errorMessage = errorJson.detail || errorMessage;
        } catch (e) {
          // If not JSON, use the status message
        }
        throw new Error(errorMessage);
      }

      const data = await response.json();

      setIsLoading(false);

      // Check if response has suggestions
      const suggestions = data.suggestions;

      addMessage({
        id: Date.now().toString(),
        type: "assistant",
        content: data.message,
        timestamp: new Date(),
        suggestions: suggestions,
      });
    } catch (error: any) {
      setError(error.message || "Failed to chat");
      setIsLoading(false);
      addMessage({
        id: Date.now().toString(),
        type: "system",
        content: `Error: ${error.message || "Failed to chat"}`,
        timestamp: new Date(),
      });
    }
  };

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent
        className="w-[600px] h-[600px] mb-23 p-0 flex flex-col bg-background/95 backdrop-blur-sm shadow-xl"
        side="left"
        sideOffset={-220}
      >
        <ScrollArea
          ref={scrollAreaRef}
          className="flex-1 overflow-y-auto overflow-x-hidden"
        >
          <div className="space-y-3 px-4 py-3 max-w-full">
            {messages.map((message) => (
              <div
                key={message.id}
                className={cn(
                  "flex",
                  message.type === "user" ? "justify-end" : "justify-start"
                )}
              >
                <div
                  className={cn(
                    "max-w-[85%] rounded-lg px-3 py-2 text-sm",
                    message.type === "user" &&
                      "bg-primary text-primary-foreground",
                    message.type === "assistant" &&
                      "bg-muted border border-border shadow-sm text-foreground",
                    message.type === "system" &&
                      "bg-muted text-muted-foreground text-xs border shadow-sm border-border"
                  )}
                  style={{
                    wordBreak: "break-word",
                    overflowWrap: "break-word",
                  }}
                >
                  {message.type === "assistant" ? (
                    <div className="prose prose-sm max-w-none [&>*]:break-words prose-p:text-foreground prose-headings:text-foreground prose-strong:text-foreground prose-code:text-foreground prose-li:text-foreground">
                      <ReactMarkdown
                        components={{
                          code: ({ className, children, ...props }) => {
                            const isInline = !className;
                            return isInline ? (
                              <code
                                className="bg-muted px-1 py-0.5 rounded text-xs break-all"
                                {...props}
                              >
                                {children}
                              </code>
                            ) : (
                              <pre className="bg-muted p-2 rounded overflow-x-auto max-w-full">
                                <code
                                  className="text-xs block whitespace-pre-wrap"
                                  {...props}
                                >
                                  {children}
                                </code>
                              </pre>
                            );
                          },
                          h3: ({ children }) => (
                            <h3 className="font-semibold text-sm mt-2 mb-1 break-words">
                              {children}
                            </h3>
                          ),
                          ul: ({ children }) => (
                            <ul className="list-disc space-y-1 pl-4 ml-2">
                              {children}
                            </ul>
                          ),
                          ol: ({ children }) => (
                            <ol className="list-decimal space-y-1 pl-4 ml-2">
                              {children}
                            </ol>
                          ),
                          li: ({ children }) => (
                            <li className="text-sm break-words">{children}</li>
                          ),
                          p: ({ children }) => (
                            <p className="mb-2 break-words">{children}</p>
                          ),
                        }}
                      >
                        {message.content}
                      </ReactMarkdown>
                    </div>
                  ) : (
                    <p className="whitespace-pre-wrap break-words">
                      {message.content}
                    </p>
                  )}
                  <p className="text-xs opacity-50 mt-1">
                    {message.timestamp instanceof Date
                      ? message.timestamp.toLocaleTimeString()
                      : new Date(message.timestamp).toLocaleTimeString()}
                  </p>

                  {/* Show create nodes button if suggestions exist */}
                  {message.suggestions && message.suggestions.length > 0 && (
                    <div className="mt-3 p-3 bg-muted/20 rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <Sparkles className="h-4 w-4 text-muted-foreground" />
                        <p className="text-sm font-medium text-foreground">
                          {message.suggestions.length} node
                          {message.suggestions.length > 1 ? "s" : ""} ready to
                          create
                        </p>
                      </div>
                      <div className="space-y-2 mb-3 max-h-40 overflow-y-auto">
                        {message.suggestions.map((s, idx) => (
                          <div
                            key={idx}
                            className="p-2 bg-background/50 rounded text-xs"
                          >
                            <div className="flex items-start gap-2">
                              <Plus className="h-3 w-3 mt-0.5 text-muted-foreground shrink-0" />
                              <div className="flex-1 min-w-0">
                                <div className="font-medium break-words text-foreground">
                                  {s.title}
                                </div>
                                {s.parent_title && (
                                  <div className="text-muted-foreground text-xs mt-0.5">
                                    Links to: {s.parent_title}
                                  </div>
                                )}
                                {s.suggested_commands &&
                                  s.suggested_commands.length > 0 && (
                                    <div className="text-muted-foreground text-xs mt-0.5">
                                      {s.suggested_commands.length} command
                                      {s.suggested_commands.length > 1
                                        ? "s"
                                        : ""}
                                    </div>
                                  )}
                                {s.suggested_tags &&
                                  s.suggested_tags.length > 0 && (
                                    <div className="flex gap-1 mt-1 flex-wrap">
                                      {s.suggested_tags.map((tag, idx) => (
                                        <span
                                          key={idx}
                                          className="text-xs px-1.5 py-0.5 bg-muted rounded-md text-muted-foreground"
                                        >
                                          {tag}
                                        </span>
                                      ))}
                                    </div>
                                  )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                      <Button
                        size="sm"
                        onClick={() =>
                          createNodesFromSuggestions(message.suggestions!)
                        }
                        disabled={isCreating}
                        className="w-full h-8"
                      >
                        {isCreating ? (
                          <>
                            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                            Creating {message.suggestions.length} nodes...
                          </>
                        ) : (
                          <>
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            Create All Nodes
                          </>
                        )}
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {error && (
              <Alert variant="destructive" className="text-xs">
                <AlertCircle className="h-3 w-3" />
                <AlertDescription className="text-xs">{error}</AlertDescription>
              </Alert>
            )}
          </div>
        </ScrollArea>

        <div className="p-4">
          {/* Quick Actions */}
          <div className="flex items-center gap-2 mb-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setInput("/clear");
                handleSend();
              }}
              disabled={isLoading}
              className="h-7 px-2 text-xs text-muted-foreground bg-accent/50 hover:text-foreground"
            >
              <Trash2 className="h-3 w-3 mr-1" />
              /clear
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setInput("/export");
                handleSend();
              }}
              disabled={isLoading}
              className="h-7 px-3 text-xs text-muted-foreground bg-accent/50 hover:text-foreground"
            >
              <FileText className="h-3 w-3 mr-1" />
              /export
            </Button>
            <div className="flex-1" />
          </div>

          <form
            onSubmit={(e: React.FormEvent) => {
              e.preventDefault();
              handleSend();
            }}
            className="relative pb-3"
          >
            <div className="relative">
              <Input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={
                  isLoading ? "Generating response..." : "Ask anything..."
                }
                disabled={isLoading}
                className={cn(
                  "w-full h-12 pr-12 text-sm rounded-full shadow-xl bg-background/80 backdrop-blur-sm focus:bg-background transition-all duration-300 border",
                  isLoading && "animate-pulse bg-background/40"
                )}
              />
              {isLoading && (
                <div className="absolute left-42 top-1/2 -translate-y-1/2">
                  <div className="w-1 h-5 bg-primary animate-pulse rounded-full" />
                </div>
              )}
              <Button
                type="submit"
                disabled={!input.trim() || isLoading}
                className="absolute right-3 top-1/2 -translate-y-1/2 h-6 w-5 p-0 rounded-full bg-primary text-primary-foreground hover:bg-primary"
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ArrowUp className="h-2 w-2" />
                )}
              </Button>
            </div>
          </form>
        </div>
      </PopoverContent>
    </Popover>
  );
};
