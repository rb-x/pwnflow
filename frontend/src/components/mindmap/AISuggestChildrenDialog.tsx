import { useState, useEffect, useRef, useCallback } from "react";
import {
  Loader2,
  Sparkles,
  Plus,
  X,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { authService } from "@/services/auth/authService";
import { env } from "@/config/env";
import { useCreateNode, useLinkNodes, useAddTag, useGenerateNodesWithAI } from "@/hooks/api/useNodes";
import { nodesApi } from "@/services/api/nodes";
import { cn } from "@/lib/utils";
import { TipTapEditor } from "@/components/TipTapEditor";

interface CommandSuggestion {
  title: string;
  command: string;
  description: string;
}

interface Suggestion {
  title: string;
  description: string;
  suggested_commands: (string | CommandSuggestion)[];
  node_type: string;
  suggested_tags?: string[];
}

interface AISuggestChildrenDialogProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  parentNodeId: string;
  parentNodeTitle: string;
  onNodesCreated?: (nodeIds: string[]) => void;
}

export function AISuggestChildrenDialog({
  isOpen,
  onClose,
  projectId,
  parentNodeId,
  parentNodeTitle,
  onNodesCreated,
}: AISuggestChildrenDialogProps) {

  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedSuggestions, setSelectedSuggestions] = useState<Set<number>>(
    new Set()
  );
  const [isCreating, setIsCreating] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Set<number>>(
    new Set([0])
  );
  const hasFetchedRef = useRef(false);
  const lastParentIdRef = useRef<string | null>(null);

  const createNodeMutation = useCreateNode();
  const linkNodesMutation = useLinkNodes();
  const addTagMutation = useAddTag();
  const generateNodesWithAI = useGenerateNodesWithAI();

  const handleClose = () => {
    // Clear suggestions when closing to ensure fresh data next time
    setSuggestions([]);
    setSelectedSuggestions(new Set());
    setExpandedSections(new Set());
    hasFetchedRef.current = false;
    lastParentIdRef.current = null;
    onClose();
  };

  const fetchSuggestions = useCallback(async () => {
    setIsLoading(true);
    setSuggestions([]);
    setSelectedSuggestions(new Set());

    try {
      const token = authService.getToken();
      const apiUrl =
        env.API_BASE_URL;

      const response = await fetch(
        `${apiUrl}/projects/${projectId}/ai/suggest-children/${parentNodeId}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error("Failed to fetch suggestions");
      }

      const data = await response.json();
      setSuggestions(data.suggestions || []);
    } catch (error) {
      console.error("Error fetching suggestions:", error);
      toast.error("Failed to get AI suggestions");
    } finally {
      setIsLoading(false);
    }
  }, [projectId, parentNodeId]);

  useEffect(() => {
    if (!isOpen) {
      hasFetchedRef.current = false;
      lastParentIdRef.current = null;
      return;
    }

    if (parentNodeId && lastParentIdRef.current !== parentNodeId) {
      hasFetchedRef.current = false;
      lastParentIdRef.current = parentNodeId;
    }

    if (isOpen && parentNodeId && !hasFetchedRef.current) {
      hasFetchedRef.current = true;
      void fetchSuggestions();
    }
  }, [isOpen, parentNodeId, fetchSuggestions]);

  const toggleSuggestion = (index: number) => {
    const newSelected = new Set(selectedSuggestions);
    if (newSelected.has(index)) {
      newSelected.delete(index);
    } else {
      newSelected.add(index);
    }
    setSelectedSuggestions(newSelected);
  };

  const toggleExpanded = (index: number) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    setExpandedSections(newExpanded);
  };

  const createSelectedNodes = async () => {
    if (selectedSuggestions.size === 0) {
      toast.error("Please select at least one suggestion");
      return;
    }

    setIsCreating(true);


    try {
      // Build a prompt from selected suggestions to generate nodes via AI
      const selectedSuggestionsData = Array.from(selectedSuggestions).map(
        (index) => suggestions[index]
      );

      // Create a structured prompt for the AI generation endpoint
      const prompt = `Generate the following child nodes for the parent node:
${selectedSuggestionsData
  .map((s) => `- ${s.title}: ${s.description.substring(0, 200)}...`)
  .join("\n")}`;

      console.log("Calling AI generation endpoint with prompt:", prompt);
      console.log("Parent node ID:", parentNodeId);

      // Use the AI generation endpoint which will create Celery tasks
      try {
        console.log("About to call generateNodesWithAI.mutateAsync");
        const result = await generateNodesWithAI.mutateAsync({
          projectId,
          prompt,
          parentNodeId,
          options: {
            max_nodes: selectedSuggestionsData.length,
            node_types: ["concept", "tool", "technique", "vulnerability"],
            auto_connect: true,
          },
        });

        console.log("AI generation result:", result);

        // The AI service will handle creating nodes and relationships
        if (result.nodes && result.nodes.length > 0) {
          toast.success(`Created ${result.nodes.length} nodes with AI`);
          onClose();
          return;
        }
      } catch (aiError: any) {
        console.error("AI generation failed, falling back to manual:", aiError);
        console.error("Error details:", {
          message: aiError?.message,
          response: aiError?.response?.data,
          status: aiError?.response?.status
        });
        toast.error(`AI generation failed: ${aiError?.message || 'Unknown error'}`);
        // Continue with fallback
      }

      // Fallback to manual creation if AI generation didn't work
      console.log("Falling back to manual node creation");
      const createdNodeIds: string[] = [];
      for (const index of selectedSuggestions) {
        const suggestion = suggestions[index];

        // Create the node
        const createdNode = await createNodeMutation.mutateAsync({
          projectId,
          data: {
            title: suggestion.title,
            description: suggestion.description,
            status: "NOT_STARTED",
            findings: null,
            x_pos: 0, // Will be positioned by auto-layout
            y_pos: 0,
          },
        });

        createdNodeIds.push(createdNode.id);

        // Link to parent
        await linkNodesMutation.mutateAsync({
          projectId,
          sourceId: parentNodeId,
          targetId: createdNode.id,
        });

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

      toast.success(`Created ${createdNodeIds.length} child nodes`);

      if (onNodesCreated) {
        onNodesCreated(createdNodeIds);
      }

      handleClose();
    } catch (error) {
      console.error("Error creating nodes:", error);
      toast.error("Failed to create some nodes");
    } finally {
      setIsCreating(false);
    }
  };

  const nodeTypeColors: Record<string, string> = {
    tool: "bg-chart-1/10 text-chart-1",
    technique: "bg-chart-2/10 text-chart-2",
    concept: "bg-chart-3/10 text-chart-3",
    vulnerability: "bg-destructive/10 text-destructive",
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="min-w-[60rem] max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            AI Suggested Child Nodes
          </DialogTitle>
          <DialogDescription>
            Suggestions for expanding "{parentNodeTitle}"
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto pr-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : suggestions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No suggestions available
            </div>
          ) : (
            <div className="space-y-3">
              {suggestions.map((suggestion, index) => {
                const isExpanded = expandedSections.has(index);
                const isSelected = selectedSuggestions.has(index);

                return (
                  <div
                    key={index}
                    className={cn(
                      "rounded-lg border transition-all",
                      isSelected
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-muted-foreground"
                    )}
                  >
                    {/* Header - Always visible */}
                    <div
                      className="p-4 cursor-pointer"
                      onClick={() => toggleSuggestion(index)}
                    >
                      <div className="flex items-start gap-3">
                        <div className="mt-1">
                          <div
                            className={cn(
                              "w-5 h-5 rounded border-2 flex items-center justify-center",
                              isSelected
                                ? "border-primary bg-primary"
                                : "border-muted-foreground"
                            )}
                          >
                            {isSelected && (
                              <Plus className="h-3 w-3 text-primary-foreground rotate-45" />
                            )}
                          </div>
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <h4 className="font-medium">
                                {suggestion.title}
                              </h4>
                              <Badge
                                variant="secondary"
                                className={cn(
                                  "text-xs",
                                  nodeTypeColors[suggestion.node_type] || ""
                                )}
                              >
                                {suggestion.node_type}
                              </Badge>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleExpanded(index);
                              }}
                            >
                              {isExpanded ? (
                                <ChevronDown className="h-4 w-4" />
                              ) : (
                                <ChevronRight className="h-4 w-4" />
                              )}
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Collapsible Content */}
                    {isExpanded && (
                      <div className="px-4 pb-4 border-t border-border/50">
                        <div className="pt-3 space-y-3">
                          {/* Description */}
                          <div className="text-sm">
                            <TipTapEditor
                              initialContent={suggestion.description}
                              readOnly={true}
                              placeholder=""
                            />
                          </div>

                          {/* Commands */}
                          {suggestion.suggested_commands.length > 0 && (
                            <div className="space-y-2">
                              <h5 className="text-sm font-medium text-foreground">
                                Commands
                              </h5>
                              <div className="space-y-2">
                                {suggestion.suggested_commands.map(
                                  (cmd, cmdIndex) => (
                                    <div key={cmdIndex} className="space-y-1">
                                      {typeof cmd === "string" ? (
                                        <code className="text-xs bg-muted px-2 py-1 rounded block">
                                          {cmd}
                                        </code>
                                      ) : (
                                        <div className="bg-muted/50 p-3 rounded text-xs space-y-2">
                                          <div className="font-medium text-foreground">
                                            {cmd.title}
                                          </div>
                                          <code className="bg-muted px-2 py-1 rounded block">
                                            {cmd.command}
                                          </code>
                                          {cmd.description && (
                                            <p className="text-muted-foreground">
                                              {cmd.description}
                                            </p>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  )
                                )}
                              </div>
                            </div>
                          )}

                          {/* Tags */}
                          {suggestion.suggested_tags &&
                            suggestion.suggested_tags.length > 0 && (
                              <div className="space-y-2">
                                <h5 className="text-sm font-medium text-foreground">
                                  Tags
                                </h5>
                                <div className="flex items-center gap-2 flex-wrap">
                                  {suggestion.suggested_tags.map(
                                    (tag, tagIndex) => (
                                      <Badge
                                        key={tagIndex}
                                        variant="outline"
                                        className="text-xs"
                                      >
                                        {tag}
                                      </Badge>
                                    )
                                  )}
                                </div>
                              </div>
                            )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between pt-4 border-t">
          <div className="text-sm text-muted-foreground">
            {selectedSuggestions.size} of {suggestions.length} selected
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={handleClose}
              disabled={isCreating}
            >
              Cancel
            </Button>
            <Button
              onClick={createSelectedNodes}
              disabled={isCreating || selectedSuggestions.size === 0}
            >
              {isCreating ? (
                <>
                  <Loader2 className="h-4 w-4  animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4 " />
                  Create Selected
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
