import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import {
  ChevronRight,
  CheckCircle2,
  XCircle,
  PlayCircle,
  CircleDashed,
  HelpCircle,
  CircleDot,
  Plus,
  Edit2,
  X,
  Check,
  Command as CommandIcon,
  Copy,
  Trash2,
  Eye,
  Pencil,
  AlertCircle,
  Trash,
  Variable,
  FileText,
  Bug,
  Terminal,
  Tag,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { TipTapEditor } from "@/components/TipTapEditor";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { Tabs as VercelTabs } from "@/components/ui/vercel-tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
  SheetClose,
} from "@/components/ui/sheet";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Command,
  CommandGroup,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { useMindMapStore } from "@/store/mindMapStore";
import {
  useNode,
  useUpdateNode,
  useAddTag,
  useRemoveTag,
} from "@/hooks/api/useNodes";
import { useProjectNodes } from "@/hooks/api/useNodes";
import {
  useNodeCommands,
  useCreateCommand,
  useUpdateCommand,
  useDeleteCommand,
} from "@/hooks/api/useCommands";
import { useProjectContexts } from "@/hooks/api/useContexts";
import {
  useNodeFinding,
  useCreateFinding,
  useUpdateFinding,
  useDeleteFinding,
} from "@/hooks/api/useFindings";
import { CommandDialog } from "./CommandDialog";
import { CommandDisplay } from "./CommandDisplay";
import { toast } from "sonner";
import { useDebouncedCallback } from "use-debounce";
import { cn } from "@/lib/utils";
import type { NodeData } from "@/types";
import type { Command as CommandType } from "@/types/api";
import { useReactFlow } from "@xyflow/react";

interface NodeDetailsDrawerProps {
  projectId: string;
  isReadOnly?: boolean;
}

export function NodeDetailsDrawer({
  projectId,
  isReadOnly = false,
}: NodeDetailsDrawerProps) {
  const { selectedNodeId, isDrawerOpen, setDrawerOpen } = useMindMapStore();
  const { data: projectData } = useProjectNodes(projectId, isReadOnly);

  // For templates, get node from already fetched data
  const node = useMemo(() => {
    if (!selectedNodeId || !projectData?.nodes) return null;
    return projectData.nodes.find((n) => n.id === selectedNodeId) || null;
  }, [selectedNodeId, projectData]);

  const updateNode = useUpdateNode();
  const addTag = useAddTag();
  const removeTag = useRemoveTag();
  const { setNodes } = useReactFlow();

  // Command hooks
  const { data: fetchedCommands = [] } = useNodeCommands(
    projectId,
    selectedNodeId || "",
    { enabled: !isReadOnly && !!selectedNodeId }
  );
  
  // For templates, use commands from node data; for projects, use fetched commands for real-time updates
  const commands = useMemo(() => {
    if (isReadOnly && node?.commands) {
      // For templates, always use node.commands
      return node.commands;
    }
    // For projects, always use fetched commands to ensure real-time updates
    return fetchedCommands;
  }, [isReadOnly, node?.commands, fetchedCommands]);
  
  const createCommand = useCreateCommand();
  const updateCommand = useUpdateCommand();
  const deleteCommand = useDeleteCommand();

  // Finding hooks
  const nodeFinding = useNodeFinding(projectId, selectedNodeId || "", {
    enabled: !!selectedNodeId,
  });
  const createFinding = useCreateFinding();
  const updateFinding = useUpdateFinding();
  const deleteFinding = useDeleteFinding();

  // Context hooks for variable resolution
  const contextsQuery = useProjectContexts(projectId);
  const contexts = isReadOnly ? [] : contextsQuery.data || [];
  const getActiveContextsForProject = useMindMapStore(
    (state) => state.getActiveContextsForProject
  );
  const activeContexts = getActiveContextsForProject(projectId);

  const [editingTitle, setEditingTitle] = useState(false);
  const [editingDescription, setEditingDescription] = useState(false);
  const [previewDescription, setPreviewDescription] = useState(true);
  const [localTitle, setLocalTitle] = useState("");
  const [localDescription, setLocalDescription] = useState("");
  const [localFindings, setLocalFindings] = useState("");
  const [findingContent, setFindingContent] = useState("");
  const [findingDate, setFindingDate] = useState<Date>(new Date());
  const [activeTab, setActiveTab] = useState("description");
  const [tagInput, setTagInput] = useState("");
  const [showTagSuggestions, setShowTagSuggestions] = useState(false);
  const [commandSearch, setCommandSearch] = useState("");
  const [deleteTagsDialogOpen, setDeleteTagsDialogOpen] = useState(false);
  const [moveDialogOpen, setMoveDialogOpen] = useState(false);
  const [expandedCommands, setExpandedCommands] = useState<Set<string>>(
    new Set()
  );

  // Command dialog state
  const [showCommandDialog, setShowCommandDialog] = useState(false);
  const [editingCommand, setEditingCommand] = useState<
    CommandType | undefined
  >();
  const [showSensitiveVariables, setShowSensitiveVariables] = useState<
    Record<string, boolean>
  >({});

  const titleInputRef = useRef<HTMLInputElement>(null);
  const descriptionTextareaRef = useRef<HTMLTextAreaElement>(null);
  const shouldMaintainFocusRef = useRef(false);
  const isEditingRef = useRef(false);
  const prevSelectedNodeIdRef = useRef<string | null>();

  // Reset editing states when the drawer is closed to discard unsaved changes
  useEffect(() => {
    if (!isDrawerOpen) {
      setEditingTitle(false);
      setEditingDescription(false);
      setPreviewDescription(true);
    }
  }, [isDrawerOpen]);

  // Get active variables from contexts
  const activeVariables = useMemo(() => {
    if (!contexts || !activeContexts.length) return new Map<string, any>();

    const variableMap = new Map();
    contexts
      .filter((ctx) => activeContexts.includes(ctx.id))
      .forEach((ctx) => {
        ctx.variables.forEach((v) => {
          variableMap.set(v.name, v);
        });
      });

    return variableMap;
  }, [contexts, activeContexts]);

  // Function to resolve variables in command text
  const resolveCommandVariables = (
    commandText: string,
    replaceWithValues: boolean = false
  ) => {
    try {
      if (!commandText) return [{ text: "" }];

      const variableRegex = /\{\{([^}]+)\}\}/g;
      const matches = [...commandText.matchAll(variableRegex)];
      const resolvedParts: Array<{
        text: string;
        isVariable?: boolean;
        variable?: any;
        found?: boolean;
      }> = [];

      let lastIndex = 0;

      matches.forEach((match) => {
        const [fullMatch, variableName] = match;
        const matchIndex = match.index!;

        // Add text before the variable
        if (matchIndex > lastIndex) {
          resolvedParts.push({
            text: commandText.slice(lastIndex, matchIndex),
          });
        }

        // Check if variable exists
        const variable = activeVariables.get(variableName.trim());

        if (replaceWithValues && variable) {
          // Replace with actual value for copying
          resolvedParts.push({ text: variable.value || "" });
        } else {
          // Keep as variable for display
          resolvedParts.push({
            text: fullMatch,
            isVariable: true,
            variable: variable || null,
            found: !!variable,
          });
        }

        lastIndex = matchIndex + fullMatch.length;
      });

      // Add remaining text
      if (lastIndex < commandText.length) {
        resolvedParts.push({ text: commandText.slice(lastIndex) });
      }

      return resolvedParts;
    } catch (error) {
      console.error("Error resolving command variables:", error);
      return [{ text: commandText || "" }];
    }
  };

  // Function to copy command with resolved variables
  const handleCopyCommand = (cmd: CommandType) => {
    try {
      if (isReadOnly) {
        // For templates, just copy the raw command
        navigator.clipboard.writeText(cmd.command);
        toast.success("Command copied");
      } else {
        const resolvedParts = resolveCommandVariables(cmd.command, true);
        const resolvedCommand = resolvedParts
          .map((part) => part.text || "")
          .join("");
        navigator.clipboard.writeText(resolvedCommand);
        toast.success("Command copied with resolved variables");
      }
    } catch (error) {
      console.error("Error copying command:", error);
      // Fallback to copying raw command
      navigator.clipboard.writeText(cmd.command || "");
      toast.success("Command copied");
    }
  };

  // Initialize local state when node changes
  useEffect(() => {
    const hasNodeChanged = selectedNodeId !== prevSelectedNodeIdRef.current;
    if (node) {
      // If the selected node has changed, reset the entire local state for the drawer
      if (hasNodeChanged) {
        setLocalTitle(node.title || "");
        setLocalDescription(node.description || "");
        setLocalFindings(node.findings || "");
        // Reset editing states when switching nodes
        setEditingTitle(false);
        // Always start in preview mode by default
        setEditingDescription(false);
        setPreviewDescription(true);
      } else {
        // Same node, only update if not currently editing to avoid overwriting user input
        if (!editingTitle) {
          setLocalTitle(node.title || "");
        }
        if (!editingDescription) {
          setLocalDescription(node.description || "");
        }
        setLocalFindings(node.findings || "");
      }
    }
    // Update the ref to the current node ID for the next render
    prevSelectedNodeIdRef.current = selectedNodeId;
  }, [node, selectedNodeId, editingTitle, editingDescription]); // Re-run when node object changes

  // Initialize finding state when finding data changes
  useEffect(() => {
    if (nodeFinding.data) {
      // Update local state
      setFindingContent(nodeFinding.data.content || "");
      const date = new Date(nodeFinding.data.date);
      setFindingDate(isNaN(date.getTime()) ? new Date() : date);
    } else {
      setFindingContent("");
      setFindingDate(new Date());
    }
  }, [nodeFinding.data]);

  // Focus input when editing starts
  useEffect(() => {
    if (editingTitle) {
      titleInputRef.current?.focus();
      titleInputRef.current?.select();
    }
  }, [editingTitle]);

  useEffect(() => {
    if (editingDescription) {
      descriptionTextareaRef.current?.focus();
      isEditingRef.current = true;
    } else {
      isEditingRef.current = false;
    }
  }, [editingDescription]);

  // Maintain focus during updates
  useEffect(() => {
    if (shouldMaintainFocusRef.current) {
      if (editingDescription && descriptionTextareaRef.current) {
        const textarea = descriptionTextareaRef.current;
        const selectionStart = textarea.selectionStart;
        const selectionEnd = textarea.selectionEnd;

        // Force focus back
        textarea.focus();

        // Restore cursor position
        textarea.setSelectionRange(selectionStart, selectionEnd);
      }
    }
  });

  // Debounced description update
  const debouncedUpdateDescription = useDebouncedCallback(
    async (description: string) => {
      if (!selectedNodeId) return;

      try {
        // Set flag to maintain focus
        shouldMaintainFocusRef.current = true;

        const updatedNode = await updateNode.mutateAsync({
          projectId,
          nodeId: selectedNodeId,
          data: { description },
        });

        // Update the node in ReactFlow immediately
        setNodes((nodes) =>
          nodes.map((n) => {
            if (n.id === selectedNodeId) {
              return {
                ...n,
                data: {
                  ...n.data,
                  ...updatedNode,
                },
              };
            }
            return n;
          })
        );
      } catch (error) {
        toast.error("Failed to update description");
      } finally {
        // Reset flag after a short delay
        setTimeout(() => {
          shouldMaintainFocusRef.current = false;
        }, 100);
      }
    },
    2000 // Increased to 2 seconds for better UX
  );

  // Debounced findings update
  const debouncedUpdateFindings = useDebouncedCallback(
    async (findings: string) => {
      if (!selectedNodeId) return;

      try {
        // Set flag to maintain focus
        shouldMaintainFocusRef.current = true;

        await updateNode.mutateAsync({
          projectId,
          nodeId: selectedNodeId,
          data: { findings },
        });
      } catch (error) {
        toast.error("Failed to update findings");
      } finally {
        // Reset flag after a short delay
        setTimeout(() => {
          shouldMaintainFocusRef.current = false;
        }, 100);
      }
    },
    2000 // Increased to 2 seconds for better UX
  );

  // Debounced finding entity update
  const debouncedUpdateFinding = useDebouncedCallback(
    async (content: string, date: Date) => {
      if (!selectedNodeId) return;
      
      // Don't save if content is empty
      if (!content.trim()) return;

      try {
        if (nodeFinding.data) {
          // Update existing finding
          await updateFinding.mutateAsync({
            projectId,
            nodeId: selectedNodeId,
            data: { content, date: date.toISOString() },
          });
        } else {
          // Create new finding
          await createFinding.mutateAsync({
            projectId,
            nodeId: selectedNodeId,
            data: { content, date: date.toISOString() },
          });
        }
      } catch (error) {
        toast.error("Failed to save finding");
        console.error("Finding save error:", error);
      }
    },
    1000
  );

  // Reset command dialog state when selected node changes
  useEffect(() => {
    setShowCommandDialog(false);
    setEditingCommand(undefined);
    setExpandedCommands(new Set());
  }, [selectedNodeId]);

  // Handle title save
  const handleTitleSave = async () => {
    if (!selectedNodeId) return;

    try {
      const updatedNode = await updateNode.mutateAsync({
        projectId,
        nodeId: selectedNodeId,
        data: { title: localTitle },
      });

      // Update the node in ReactFlow immediately
      setNodes((nodes) =>
        nodes.map((n) => {
          if (n.id === selectedNodeId) {
            return {
              ...n,
              data: {
                ...n.data,
                ...updatedNode,
              },
            };
          }
          return n;
        })
      );

      toast.success("Title updated");
      setEditingTitle(false);
    } catch (error) {
      toast.error("Failed to update title");
    }
  };

  // Handle status change
  const handleStatusChange = async (status: string) => {
    if (!selectedNodeId) return;

    try {
      const updatedNode = await updateNode.mutateAsync({
        projectId,
        nodeId: selectedNodeId,
        data: { status },
      });

      // Update the node in ReactFlow immediately
      setNodes((nodes) =>
        nodes.map((n) => {
          if (n.id === selectedNodeId) {
            return {
              ...n,
              data: {
                ...n.data,
                ...updatedNode,
              },
            };
          }
          return n;
        })
      );
    } catch (error) {
      toast.error("Failed to update status");
    }
  };

  // Handle description change
  const handleDescriptionChange = (value: string) => {
    setLocalDescription(value);
    debouncedUpdateDescription(value);
  };

  // Get all unique tags from the project for suggestions
  const allTags = useMemo(() => {
    if (!projectData?.nodes) return [];
    const tagSet = new Set<string>();
    projectData.nodes.forEach((node) => {
      if (node.tags) {
        node.tags.forEach((tag) => tagSet.add(tag));
      }
    });
    return Array.from(tagSet).sort();
  }, [projectData]);

  // Filter suggestions based on input
  const tagSuggestions = useMemo(() => {
    if (!tagInput.trim()) return [];
    const input = tagInput.toLowerCase();
    return allTags
      .filter(
        (tag) => tag.toLowerCase().includes(input) && !node?.tags?.includes(tag)
      )
      .slice(0, 5);
  }, [tagInput, allTags, node?.tags]);

  // Handle adding a tag
  const handleAddTag = async (tag: string) => {
    if (!selectedNodeId || !tag.trim()) return;

    const tagName = tag.trim();
    if (node?.tags?.includes(tagName)) {
      toast.error("Tag already exists");
      return;
    }

    try {
      await addTag.mutateAsync({
        projectId,
        nodeId: selectedNodeId,
        tagName,
      });
      setTagInput("");
      setShowTagSuggestions(false);
      // No need for toast here since the tag will appear immediately
    } catch (error) {
      toast.error("Failed to add tag");
    }
  };

  // Handle removing a tag
  const handleRemoveTag = async (tagName: string) => {
    if (!selectedNodeId) return;

    try {
      await removeTag.mutateAsync({
        projectId,
        nodeId: selectedNodeId,
        tagName,
      });
      // No need for toast here since the tag will disappear immediately
    } catch (error) {
      toast.error("Failed to remove tag");
    }
  };

  // Handle delete all tags
  const handleDeleteAllTags = async () => {
    if (!selectedNodeId || !node?.tags) return;

    try {
      // Remove all tags one by one
      await Promise.all(
        node.tags.map((tag) =>
          removeTag.mutateAsync({
            projectId,
            nodeId: selectedNodeId,
            tagName: tag,
          })
        )
      );
      setDeleteTagsDialogOpen(false);
    } catch (error) {
      toast.error("Failed to remove all tags");
    }
  };

  // Command handlers
  const handleCreateCommand = async (data: {
    title: string;
    command: string;
    description?: string;
  }) => {
    if (!selectedNodeId) return;

    try {
      await createCommand.mutateAsync({
        projectId,
        nodeId: selectedNodeId,
        data: {
          ...data,
          description: data.description || null,
        },
      });
      setShowCommandDialog(false);
      setEditingCommand(undefined); // Reset the editing command
    } catch (error) {
      // Error toast is handled by the hook
    }
  };

  const handleUpdateCommand = async (data: {
    title: string;
    command: string;
    description?: string;
  }) => {
    if (!selectedNodeId || !editingCommand) return;

    try {
      await updateCommand.mutateAsync({
        projectId,
        nodeId: selectedNodeId,
        commandId: editingCommand.id,
        data: {
          ...data,
          description: data.description || null,
        },
      });
      setShowCommandDialog(false);
      setEditingCommand(undefined);
    } catch (error) {
      // Error toast is handled by the hook
    }
  };

  const handleDeleteCommand = async (commandId: string) => {
    if (
      !selectedNodeId ||
      !confirm("Are you sure you want to delete this command?")
    )
      return;

    try {
      await deleteCommand.mutateAsync({
        projectId,
        nodeId: selectedNodeId,
        commandId,
      });
    } catch (error) {
      // Error toast is handled by the hook
    }
  };

  const handleEditCommand = (command: CommandType) => {
    setEditingCommand(command);
    setShowCommandDialog(true);
  };

  const handleAddCommand = () => {
    // Ensure state is completely reset before opening dialog
    setEditingCommand(undefined);
    // Use setTimeout to ensure state update has processed
    setTimeout(() => {
      setShowCommandDialog(true);
    }, 0);
  };

  // Toggle command expand/collapse
  const toggleCommandExpand = (commandId: string) => {
    setExpandedCommands((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(commandId)) {
        newSet.delete(commandId);
      } else {
        newSet.add(commandId);
      }
      return newSet;
    });
  };

  // Listen for context modal event
  useEffect(() => {
    const handleOpenContextModal = () => {
      const event = new CustomEvent("openContextModal");
      window.dispatchEvent(event);
    };

    const commandDialog = document.querySelector("[data-command-dialog]");
    if (commandDialog) {
      commandDialog.addEventListener(
        "openContextModal",
        handleOpenContextModal
      );
      return () => {
        commandDialog.removeEventListener(
          "openContextModal",
          handleOpenContextModal
        );
      };
    }
  }, [showCommandDialog]);

  // Keyboard shortcuts
  const handleKeyDown = (
    e: React.KeyboardEvent,
    action: "title" | "description" | "findings"
  ) => {
    if (e.key === "Enter" && !e.shiftKey && action === "title") {
      e.preventDefault();
      handleTitleSave();
    } else if (
      e.key === "Enter" &&
      (e.ctrlKey || e.metaKey) &&
      (action === "description" || action === "findings")
    ) {
      e.preventDefault();
      // Switch to preview mode
      if (action === "description") {
        setPreviewDescription(true);
        setEditingDescription(false);
      }
    } else if (e.key === "Escape") {
      if (action === "title") {
        setLocalTitle(node?.title || "");
        setEditingTitle(false);
      } else if (action === "description" && editingDescription) {
        // Exit edit mode and return to preview
        setEditingDescription(false);
        setPreviewDescription(true);
      } else if (action === "findings") {
        // No longer need to handle preview mode
      }
    }
  };

  if (!node) return null;

  return (
    <>
      <Sheet open={isDrawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent
          side="right"
          className={cn(
            "fixed z-50 gap-4",
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0",
            "data-[state=open]:zoom-in-95 data-[state=closed]:zoom-out-95",
            "data-[state=open]:animate-none data-[state=closed]:animate-none",
            "inset-auto left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2",
            "w-full max-w-[960px] sm:max-w-[90vw] h-[85vh]",
            "border border-border bg-background shadow-xl rounded-2xl",
            "overflow-hidden flex flex-col p-0",
            "transition-all duration-300",
            "[&>button]:hidden"
          )}
        >
          <SheetHeader className="flex flex-col space-y-2 text-center sm:text-left border-b border-border shrink-0">
            <div className="flex p-3 items-center justify-between gap-4">
              <SheetTitle className="font-semibold flex items-center text-foreground flex-1 text-base">
                {editingTitle ? (
                  <div className="flex items-center gap-2 flex-1">
                    <Input
                      ref={titleInputRef}
                      value={localTitle}
                      onChange={(e) => setLocalTitle(e.target.value)}
                      onKeyDown={(e) => handleKeyDown(e, "title")}
                      className="text-base font-semibold"
                    />
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8"
                      onClick={handleTitleSave}
                    >
                      <Check className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8"
                      onClick={() => {
                        setLocalTitle(node.title);
                        setEditingTitle(false);
                      }}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-1 group rounded-lg px-2 flex-1 min-w-0 cursor-pointer hover:bg-muted/50">
                    <div
                      className="py-1 rounded flex items-center gap-2 w-full"
                      onClick={() => !isReadOnly && setEditingTitle(true)}
                    >
                      <span className="truncate max-w-[420px] flex-1">
                        {node.title}
                      </span>
                      <Edit2 className="h-3.5 w-3.5 transition-opacity shrink-0 opacity-0 group-hover:opacity-100 text-muted-foreground" />
                    </div>
                  </div>
                )}
              </SheetTitle>

              {/* Status selector */}
              <Select
                value={node.status}
                onValueChange={handleStatusChange}
                disabled={isReadOnly}
              >
                <SelectTrigger
                  className="w-[160px] shrink-0 font-medium h-8 px-2"
                  disabled={isReadOnly}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="NOT_STARTED">
                    <div className="flex items-center gap-2">
                      <CircleDashed className="h-4 w-4 text-blue-400" />
                      Not Started
                    </div>
                  </SelectItem>
                  <SelectItem value="IN_PROGRESS">
                    <div className="flex items-center gap-2">
                      <PlayCircle className="h-4 w-4 text-yellow-500" />
                      In Progress
                    </div>
                  </SelectItem>
                  <SelectItem value="SUCCESS">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                      Success
                    </div>
                  </SelectItem>
                  <SelectItem value="FAILED">
                    <div className="flex items-center gap-2">
                      <XCircle className="h-4 w-4 text-red-500" />
                      Failed
                    </div>
                  </SelectItem>
                  <SelectItem value="NOT_APPLICABLE">
                    <div className="flex items-center gap-2">
                      <HelpCircle className="h-4 w-4 text-neutral-500" />
                      Not Applicable
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
              <div className="h-6 w-px bg-border/70 mx-2" />
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8"
                onClick={() => setDrawerOpen(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </SheetHeader>

          <Tabs
            value={activeTab}
            onValueChange={setActiveTab}
            className="flex-1 flex flex-col overflow-hidden"
          >
            <div className="border-b border-border px-3 py-2">
              <VercelTabs
                tabs={[
                  {
                    id: "description",
                    label: "Description",
                    icon: <FileText className="h-3.5 w-3.5" />,
                  },
                  {
                    id: "findings",
                    label: "Findings",
                    icon: <Bug className="h-3.5 w-3.5" />,
                  },
                  {
                    id: "commands",
                    label: `Commands${
                      commands && commands.length > 0
                        ? ` (${commands.length})`
                        : ""
                    }`,
                    icon: <Terminal className="h-3.5 w-3.5" />,
                  },
                  {
                    id: "tags",
                    label: `Tags${
                      node.tags?.length > 0 ? ` (${node.tags.length})` : ""
                    }`,
                    icon: <Tag className="h-3.5 w-3.5" />,
                  },
                ]}
                activeTab={activeTab}
                onTabChange={setActiveTab}
              />
            </div>

            <div className="flex-1 overflow-y-auto p-3 pb-12">
              <TabsContent
                value="description"
                className="outline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring/70 mt-0 data-[state=active]:flex data-[state=active]:flex-col h-full"
              >
                <div className="space-y-2">
                  <TipTapEditor
                    initialContent={localDescription}
                    onChange={handleDescriptionChange}
                    placeholder="Add a description..."
                    readOnly={isReadOnly}
                  />
                  {!isReadOnly && (
                    <p className="text-xs text-muted-foreground">
                      Use the lock/unlock button in the toolbar to toggle edit mode • Changes are saved automatically
                    </p>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="findings" className="mt-0 space-y-4">
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="finding-date" className="text-sm font-medium">
                      Date:
                    </Label>
                    <Input
                      id="finding-date"
                      type="datetime-local"
                      value={findingDate && !isNaN(findingDate.getTime()) ? findingDate.toISOString().slice(0, 16) : new Date().toISOString().slice(0, 16)}
                      onChange={(e) => {
                        const date = new Date(e.target.value);
                        if (!isNaN(date.getTime())) {
                          setFindingDate(date);
                          debouncedUpdateFinding(findingContent, date);
                        }
                      }}
                      className="w-48"
                      disabled={isReadOnly}
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        const now = new Date();
                        setFindingDate(now);
                        debouncedUpdateFinding(findingContent, now);
                      }}
                      disabled={isReadOnly}
                    >
                      Now
                    </Button>
                    {nodeFinding.data && !isReadOnly && (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={async () => {
                                if (!selectedNodeId) return;
                                try {
                                  await deleteFinding.mutateAsync({
                                    projectId,
                                    nodeId: selectedNodeId,
                                  });
                                  // Clear local state
                                  setFindingContent("");
                                  setFindingDate(new Date());
                                } catch (error) {
                                  console.error("Delete finding error:", error);
                                }
                              }}
                              className="hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Delete Finding</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                  </div>
                  <TipTapEditor
                    initialContent={findingContent}
                    onChange={(value) => {
                      setFindingContent(value);
                      debouncedUpdateFinding(value, findingDate);
                    }}
                    placeholder="Add findings..."
                    readOnly={isReadOnly}
                  />
                </div>
              </TabsContent>

              <TabsContent value="commands" className="mt-0 space-y-4">
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Input
                      placeholder="Search commands..."
                      value={commandSearch}
                      onChange={(e) => setCommandSearch(e.target.value)}
                      className="flex-1"
                    />
                    {!isReadOnly && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-2"
                        onClick={handleAddCommand}
                      >
                        <Plus className="h-3 w-3" />
                        Add Command
                      </Button>
                    )}
                    {!isReadOnly && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          // Open variable/context management modal
                          const event = new CustomEvent("openContextModal");
                          window.dispatchEvent(event);
                        }}
                        className="gap-2 whitespace-nowrap"
                      >
                        <Variable className="h-3 w-3" />
                        Variables
                      </Button>
                    )}
                  </div>

                  {/* Variable status legend */}
                  {!isReadOnly &&
                    commands &&
                    commands.length > 0 &&
                    commands.some((cmd) => cmd.command.includes("{{")) && (
                      <div className="text-xs text-muted-foreground space-y-1 p-2 bg-muted/30 rounded">
                        <div className="flex items-center gap-2">
                          <span className="px-1 py-0.5 rounded bg-chart-1/10 text-chart-1">
                            {"{{variable}}"}
                          </span>
                          <span>Variable found in active contexts</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-destructive underline decoration-wavy">
                            {"{{missing}}"}
                          </span>
                          <AlertCircle className="h-3 w-3 text-destructive" />
                          <span>
                            Variable not found - enable the context containing
                            this variable
                          </span>
                        </div>
                        <div className="text-muted-foreground mt-1">
                          Click copy to get the command with actual variable
                          values
                        </div>
                      </div>
                    )}

                  <div className="space-y-2">
                    {commands && commands.length > 0 ? (
                      commands
                        .filter(
                          (cmd) =>
                            cmd.title
                              .toLowerCase()
                              .includes(commandSearch.toLowerCase()) ||
                            (cmd.description &&
                              cmd.description
                                .toLowerCase()
                                .includes(commandSearch.toLowerCase())) ||
                            cmd.command
                              .toLowerCase()
                              .includes(commandSearch.toLowerCase())
                        )
                        .map((cmd) => {
                          const isExpanded = expandedCommands.has(cmd.id);
                          const commandParts = isReadOnly
                            ? [{ text: cmd.command }]
                            : resolveCommandVariables(cmd.command);
                          const hasLongCommand = cmd.command.length > 150;

                          return (
                            <div
                              key={cmd.id}
                              className="rounded-md border p-4 space-y-2"
                            >
                              <div className="flex justify-between items-start">
                                <h4 className="font-medium truncate">
                                  {cmd.title}
                                </h4>
                                <div className="flex items-center gap-1 shrink-0">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleCopyCommand(cmd)}
                                    className="h-8 w-8"
                                  >
                                    <Copy className="h-4 w-4" />
                                  </Button>
                                  {!isReadOnly && (
                                    <>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => handleEditCommand(cmd)}
                                        className="h-8 w-8"
                                      >
                                        <Edit2 className="h-4 w-4" />
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() =>
                                          handleDeleteCommand(cmd.id)
                                        }
                                        className="h-8 w-8 text-destructive hover:text-destructive"
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    </>
                                  )}
                                </div>
                              </div>

                              {cmd.description && (
                                <p className="text-sm text-muted-foreground line-clamp-2">
                                  {cmd.description}
                                </p>
                              )}

                              <div className="rounded-md border">
                                <div className="p-4 font-mono text-sm">
                                  <div
                                    className={cn(
                                      "whitespace-pre-wrap break-words relative",
                                      !isExpanded
                                        ? "max-h-[150px]"
                                        : "max-h-[500px]",
                                      "overflow-auto scrollbar-thin"
                                    )}
                                  >
                                    <CommandDisplay
                                      commandParts={commandParts}
                                      showSensitiveVariables={
                                        showSensitiveVariables
                                      }
                                      onToggleSensitive={(varName) => {
                                        setShowSensitiveVariables((prev) => ({
                                          ...prev,
                                          [varName]: !prev[varName],
                                        }));
                                      }}
                                      isReadOnly={isReadOnly}
                                    />
                                  </div>
                                  {hasLongCommand && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() =>
                                        toggleCommandExpand(cmd.id)
                                      }
                                      className="w-full mt-2 hover:bg-muted/50 h-6"
                                    >
                                      <span className="text-xs text-muted-foreground">
                                        {isExpanded ? "Show less" : "Show more"}
                                      </span>
                                    </Button>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })
                    ) : (
                      <div className="text-center py-8 text-muted-foreground">
                        <CommandIcon className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">No commands added yet</p>
                      </div>
                    )}
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="tags" className="mt-0 space-y-4">
                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-4 mb-4">
                    {!isReadOnly && (
                      <div className="flex-1 relative">
                        <Input
                          placeholder="Search existing or create new tag..."
                          value={tagInput}
                          onChange={(e) => {
                            setTagInput(e.target.value);
                            if (e.target.value.trim()) {
                              setShowTagSuggestions(true);
                            } else {
                              setShowTagSuggestions(false);
                            }
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && tagInput.trim()) {
                              handleAddTag(tagInput);
                              setTagInput("");
                              setShowTagSuggestions(false);
                            }
                          }}
                          className="w-full"
                        />
                        {showTagSuggestions && (
                          <div className="absolute mt-1 w-full bg-popover border rounded-md shadow-md z-50">
                            <Command>
                              <CommandList>
                                <CommandGroup>
                                  {tagInput.trim() &&
                                    !tagSuggestions.some(
                                      (tag) =>
                                        tag.toLowerCase() ===
                                        tagInput.trim().toLowerCase()
                                    ) && (
                                      <CommandItem
                                        onSelect={() => {
                                          handleAddTag(tagInput);
                                          setTagInput("");
                                          setShowTagSuggestions(false);
                                        }}
                                        className="text-muted-foreground"
                                      >
                                        <Plus className=" h-4 w-4" />
                                        Create "{tagInput}"
                                      </CommandItem>
                                    )}

                                  {tagSuggestions.map((tag) => (
                                    <CommandItem
                                      key={tag}
                                      onSelect={() => {
                                        handleAddTag(tag);
                                        setTagInput("");
                                        setShowTagSuggestions(false);
                                      }}
                                    >
                                      <Check
                                        className={cn(
                                          " h-4 w-4",
                                          node?.tags?.includes(tag)
                                            ? "opacity-100"
                                            : "opacity-0"
                                        )}
                                      />
                                      {tag}
                                    </CommandItem>
                                  ))}

                                  {tagSuggestions.length === 0 &&
                                    !tagInput.trim() && (
                                      <CommandItem
                                        className="text-muted-foreground"
                                        onSelect={() => {}}
                                      >
                                        Type to search or create tags...
                                      </CommandItem>
                                    )}
                                </CommandGroup>
                              </CommandList>
                            </Command>
                          </div>
                        )}
                      </div>
                    )}
                    {node?.tags && node.tags.length > 0 && !isReadOnly && (
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => setDeleteTagsDialogOpen(true)}
                        className="gap-2 shrink-0"
                      >
                        <Trash className="h-4 w-4" />
                        Delete All
                      </Button>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {node?.tags?.map((tag) => (
                      <Badge
                        key={tag}
                        variant="secondary"
                        className="cursor-pointer group flex items-center gap-1 max-w-full"
                      >
                        <span className="truncate">{tag}</span>
                        {!isReadOnly && (
                          <Button
                            variant="ghost"
                            className="h-4 w-4 p-0 group-hover:opacity-100 transition-opacity shrink-0"
                            onClick={() => handleRemoveTag(tag)}
                          >
                            <X className="h-3 w-3 text-muted-foreground" />
                          </Button>
                        )}
                      </Badge>
                    ))}
                  </div>

                  <AlertDialog
                    open={deleteTagsDialogOpen}
                    onOpenChange={setDeleteTagsDialogOpen}
                  >
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete all tags?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This action cannot be undone. This will permanently
                          delete all tags from this node.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={handleDeleteAllTags}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          Delete All
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </TabsContent>
            </div>
          </Tabs>

          {/* Close button outside the sheet */}
          <Button
            size="icon"
            variant="ghost"
            className="inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 absolute -left-3 top-1/2 -translate-y-1/2 h-6 w-6 rounded-full bg-background border border-border shadow-md hover:bg-accent hover:text-accent-foreground"
            onClick={() => setDrawerOpen(false)}
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        </SheetContent>
      </Sheet>

      {/* Command Dialog */}
      {selectedNodeId && (
        <CommandDialog
          key={editingCommand?.id || 'new-command'}
          isOpen={showCommandDialog}
          onClose={() => {
            console.log("CommandDialog onClose called, resetting state");
            // Reset all dialog-related state
            setShowCommandDialog(false);
            setEditingCommand(undefined);
            // Also reset any expanded commands
            setExpandedCommands(new Set());
          }}
          projectId={projectId}
          nodeId={selectedNodeId}
          command={editingCommand}
          onSave={editingCommand ? handleUpdateCommand : handleCreateCommand}
          isSaving={createCommand.isPending || updateCommand.isPending}
        />
      )}
    </>
  );
}
