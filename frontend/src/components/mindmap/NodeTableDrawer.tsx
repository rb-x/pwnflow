import { useMemo, useState, useCallback, useEffect } from "react";
import {
  Search,
  X,
  Filter,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  CheckCircle2,
  XCircle,
  PlayCircle,
  CircleDashed,
  HelpCircle,
  ExternalLink,
  Trash2,
  Tag,
  ListIcon,
  Terminal,
  Package,
  Copy,
  Check,
  CircleDot,
  CircleCheck,
  Workflow,
  FileDown,
  MoreVertical,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useProjectNodes, useDeleteNode } from "@/hooks/api/useNodes";
import { useProjectContexts, useProjectOrTemplateContexts } from "@/hooks/api/useContexts";
import { useNodeTableStore } from "@/store/nodeTableStore";
import { useMindMapStore } from "@/store/mindMapStore";
import { useReactFlow } from "@xyflow/react";
import { cn } from "@/lib/utils";
import type { Node as NodeType, Context, Variable } from "@/types/api";
import { toast } from "sonner";
import { ContextModal } from "./ContextModal";
import {
  formatCommand,
  copyCommand,
  hasVariables,
} from "@/utils/commandFormatter";
import {
  parseBackendTimestamp,
  formatBackendTimestamp,
} from "@/utils/dateUtils";
import {
  exportNodesToCSV,
  exportCommandsToCSV,
  exportVariablesToCSV,
} from "@/utils/csvExport";

interface NodeTableDrawerProps {
  projectId: string;
  isReadOnly?: boolean;
  projectName?: string;
}

const statusConfig = {
  SUCCESS: {
    icon: <CheckCircle2 className="h-4 w-4" />,
    label: "Success",
    color: "text-emerald-500",
    bg: "bg-emerald-500/10",
  },
  FAILED: {
    icon: <XCircle className="h-4 w-4" />,
    label: "Failed",
    color: "text-destructive",
    bg: "bg-destructive/10",
  },
  IN_PROGRESS: {
    icon: <PlayCircle className="h-4 w-4" />,
    label: "In Progress",
    color: "text-yellow-500",
    bg: "bg-yellow-500/10",
  },
  NOT_STARTED: {
    icon: <CircleDashed className="h-4 w-4" />,
    label: "Not Started",
    color: "text-chart-1",
    bg: "bg-chart-1/10",
  },
  NOT_APPLICABLE: {
    icon: <HelpCircle className="h-4 w-4" />,
    label: "Not Applicable",
    color: "text-neutral-500",
    bg: "bg-neutral-500/10",
  },
};

export function NodeTableDrawer({
  projectId,
  isReadOnly = false,
  projectName = "Project",
}: NodeTableDrawerProps) {
  const [showContextModal, setShowContextModal] = useState(false);
  const {
    isOpen,
    setOpen,
    searchTerm,
    setSearchTerm,
    statusFilter,
    setStatusFilter,
    selectedTags,
    toggleTag,
    sortBy,
    sortDirection,
    setSorting,
    reset,
  } = useNodeTableStore();

  const { setSelectedNodeId, setDrawerOpen } = useMindMapStore();
  const { setCenter, getNode } = useReactFlow();
  const deleteNode = useDeleteNode();

  const { data: projectData, isLoading } = useProjectNodes(
    projectId,
    isReadOnly
  );
  const nodes = projectData?.nodes || [];
  // Use the new hook that handles both projects and templates
  const { data: contexts, isLoading: isLoadingContexts } = 
    useProjectOrTemplateContexts(projectId, isReadOnly);

  // Pagination state
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [viewMode, setViewMode] = useState<"nodes" | "commands" | "variables">(
    "nodes"
  );
  const [copiedCommandId, setCopiedCommandId] = useState<string | null>(null);
  const [commandFilter, setCommandFilter] = useState<
    "all" | "has_variables" | "missing_variables" | "no_variables"
  >("all");
  const [variableFilter, setVariableFilter] = useState<
    "all" | "sensitive" | "not_sensitive"
  >("all");

  // Reset view-specific filters when changing views
  useEffect(() => {
    setCommandFilter("all");
    setVariableFilter("all");
  }, [viewMode]);

  // Get all unique tags from nodes
  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    nodes.forEach((node) => {
      node.tags?.forEach((tag) => tagSet.add(tag));
    });
    return Array.from(tagSet).sort();
  }, [nodes]);

  // Get all commands from all nodes (not just filtered)
  const allCommands = useMemo(() => {
    // For commands view, we want to show ALL commands, not just from filtered nodes
    return nodes.flatMap((node) => {
      // Commands are included in the node data from the API
      return (node.commands || []).map((cmd) => ({
        ...cmd,
        nodeId: node.id,
        nodeTitle: node.title,
        nodeTags: node.tags || [],
        nodeStatus: node.status,
      }));
    });
  }, [nodes]);

  // Get all variables from contexts
  const allVariables = useMemo(() => {
    if (!contexts) return [];

    return contexts.flatMap((context) =>
      (context.variables || []).map((variable) => ({
        ...variable,
        contextId: context.id,
        contextName: context.name,
        contextDescription: context.description,
      }))
    );
  }, [contexts]);

  // Filter and sort nodes
  const filteredAndSortedNodes = useMemo(() => {
    let filtered = nodes;

    // Search filter
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (node) =>
          node.title.toLowerCase().includes(searchLower) ||
          node.description?.toLowerCase().includes(searchLower) ||
          node.tags?.some((tag) => tag.toLowerCase().includes(searchLower))
      );
    }

    // Status filter
    if (statusFilter !== "all") {
      filtered = filtered.filter((node) => node.status === statusFilter);
    }

    // Tag filter
    if (selectedTags.length > 0) {
      filtered = filtered.filter((node) =>
        selectedTags.every((tag) => node.tags?.includes(tag))
      );
    }

    // Sort
    if (sortBy) {
      filtered = [...filtered].sort((a, b) => {
        let aVal: any;
        let bVal: any;

        switch (sortBy) {
          case "title":
            aVal = a.title;
            bVal = b.title;
            break;
          case "status":
            aVal = a.status;
            bVal = b.status;
            break;
          case "created":
            aVal = parseBackendTimestamp(a.created_at);
            bVal = parseBackendTimestamp(b.created_at);
            break;
          case "updated":
            aVal = parseBackendTimestamp(a.updated_at);
            bVal = parseBackendTimestamp(b.updated_at);
            break;
          default:
            return 0;
        }

        if (sortDirection === "asc") {
          return aVal > bVal ? 1 : -1;
        } else {
          return aVal < bVal ? 1 : -1;
        }
      });
    }

    return filtered;
  }, [nodes, searchTerm, statusFilter, selectedTags, sortBy, sortDirection]);

  // Filter commands
  const filteredCommands = useMemo(() => {
    let commands = allCommands;

    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      commands = commands.filter(
        (cmd: any) =>
          cmd.title?.toLowerCase().includes(searchLower) ||
          cmd.command?.toLowerCase().includes(searchLower) ||
          cmd.description?.toLowerCase().includes(searchLower) ||
          cmd.nodeTitle?.toLowerCase().includes(searchLower)
      );
    }

    // Apply tag filter to commands based on their node's tags
    if (selectedTags.length > 0) {
      commands = commands.filter((cmd: any) =>
        selectedTags.every((tag) => cmd.nodeTags?.includes(tag))
      );
    }

    // Apply command-specific filters
    if (commandFilter === "has_variables") {
      commands = commands.filter(
        (cmd: any) => cmd.command && hasVariables(cmd.command)
      );
    } else if (commandFilter === "missing_variables") {
      commands = commands.filter((cmd: any) => {
        if (!cmd.command || !hasVariables(cmd.command)) return false;
        const formatted = formatCommand(cmd.command, contexts || []);
        return formatted.missingVariables.length > 0;
      });
    } else if (commandFilter === "no_variables") {
      commands = commands.filter(
        (cmd: any) => !cmd.command || !hasVariables(cmd.command)
      );
    }

    return commands;
  }, [allCommands, searchTerm, selectedTags, commandFilter, contexts]);

  // Filter variables
  const filteredVariables = useMemo(() => {
    let variables = allVariables;

    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      variables = variables.filter(
        (variable: any) =>
          variable.name?.toLowerCase().includes(searchLower) ||
          variable.value?.toLowerCase().includes(searchLower) ||
          variable.contextName?.toLowerCase().includes(searchLower) ||
          variable.contextDescription?.toLowerCase().includes(searchLower)
      );
    }

    // Apply variable-specific filters
    if (variableFilter === "sensitive") {
      variables = variables.filter((variable: any) => variable.sensitive);
    } else if (variableFilter === "not_sensitive") {
      variables = variables.filter((variable: any) => !variable.sensitive);
    }

    return variables;
  }, [allVariables, searchTerm, variableFilter]);

  // Calculate pagination based on view mode
  const totalPages = useMemo(() => {
    return Math.ceil(
      viewMode === "nodes"
        ? filteredAndSortedNodes.length / pageSize
        : viewMode === "commands"
        ? filteredCommands.length / pageSize
        : filteredVariables.length / pageSize
    );
  }, [
    viewMode,
    filteredAndSortedNodes.length,
    filteredCommands.length,
    filteredVariables.length,
    pageSize,
  ]);

  const paginatedNodes = useMemo(() => {
    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    return filteredAndSortedNodes.slice(start, end);
  }, [filteredAndSortedNodes, page, pageSize]);

  const paginatedCommands = useMemo(() => {
    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    return filteredCommands.slice(start, end);
  }, [filteredCommands, page, pageSize]);

  const paginatedVariables = useMemo(() => {
    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    return filteredVariables.slice(start, end);
  }, [filteredVariables, page, pageSize]);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [
    searchTerm,
    statusFilter,
    selectedTags,
    sortBy,
    viewMode,
    commandFilter,
    variableFilter,
  ]);

  // Handle node click - focus and open details
  const handleNodeClick = useCallback(
    (nodeId: string) => {
      const reactFlowNode = getNode(nodeId);
      if (reactFlowNode) {
        setCenter(reactFlowNode.position.x, reactFlowNode.position.y, {
          zoom: 1.5,
          duration: 800,
        });
        setSelectedNodeId(nodeId);
        setDrawerOpen(true);
        setOpen(false); // Close the table drawer
      }
    },
    [getNode, setCenter, setSelectedNodeId, setDrawerOpen, setOpen]
  );

  // Handle node deletion
  const handleDeleteNode = useCallback(
    async (nodeId: string) => {
      if (
        confirm(
          "Are you sure you want to delete this node? This action cannot be undone."
        )
      ) {
        try {
          await deleteNode.mutateAsync({ projectId, nodeId });
          toast.success("Node deleted successfully");
        } catch (error) {
          toast.error("Failed to delete node");
        }
      }
    },
    [projectId, deleteNode]
  );

  // Handle command copy with variable resolution
  const handleCopyCommand = useCallback(
    (command: string, commandId: string) => {
      // Use the command formatter to resolve variables
      copyCommand(command, contexts || []);
      setCopiedCommandId(commandId);

      // Check if command has variables and provide detailed feedback
      if (hasVariables(command)) {
        const formatted = formatCommand(command, contexts || []);
        const totalResolved = formatted.replacements.length;
        const sensitiveCount = formatted.sensitiveVariables.length;
        const missingCount = formatted.missingVariables.length;

        if (missingCount > 0) {
          toast.warning(
            `Command copied, but ${missingCount} variable${
              missingCount > 1 ? "s" : ""
            } could not be resolved`
          );
        } else if (sensitiveCount > 0 && totalResolved > sensitiveCount) {
          toast.success(
            `Command copied with ${totalResolved} variables resolved (${sensitiveCount} sensitive)`
          );
        } else if (sensitiveCount > 0) {
          toast.success(
            `Command copied with ${sensitiveCount} sensitive variable${
              sensitiveCount > 1 ? "s" : ""
            } resolved`
          );
        } else if (totalResolved > 0) {
          toast.success(
            `Command copied with ${totalResolved} variables resolved`
          );
        }
      } else {
        toast.success("Command copied to clipboard");
      }

      setTimeout(() => setCopiedCommandId(null), 2000);
    },
    [contexts]
  );

  // Handle CSV export
  const handleExportCSV = useCallback(() => {
    if (viewMode === "nodes") {
      exportNodesToCSV(filteredAndSortedNodes, projectName);
      toast.success("Nodes exported to CSV");
    } else if (viewMode === "commands") {
      exportCommandsToCSV(filteredCommands, projectName);
      toast.success("Commands exported to CSV");
    } else if (viewMode === "variables") {
      exportVariablesToCSV(filteredVariables, contexts || [], projectName);
      toast.success("Variables exported to CSV");
    }
  }, [
    viewMode,
    filteredAndSortedNodes,
    filteredCommands,
    filteredVariables,
    contexts,
    projectName,
  ]);

  // Sort column component
  const SortableHeader = ({
    column,
    children,
  }: {
    column: "title" | "status" | "created" | "updated";
    children: React.ReactNode;
  }) => (
    <Button
      variant="ghost"
      size="sm"
      className="h-8 px-2 hover:bg-transparent"
      onClick={() => setSorting(column)}
    >
      {children}
      {sortBy === column ? (
        sortDirection === "asc" ? (
          <ArrowUp className="ml-1 h-3 w-3" />
        ) : (
          <ArrowDown className="ml-1 h-3 w-3" />
        )
      ) : (
        <ArrowUpDown className="ml-1 h-3 w-3 opacity-50" />
      )}
    </Button>
  );

  return (
    <>
      <Sheet open={isOpen} onOpenChange={setOpen}>
        <SheetContent
          side="left"
          className={cn(
            "w-full md:w-[60%] min-w-0 md:min-w-[1100px] md:max-w-[1200px] p-0",
            "border-none bg-background/90 backdrop-blur",
            "data-[state=open]:shadow-2xl",
            "overflow-hidden flex flex-col"
          )}
        >
          <SheetHeader className="border-b border-border/60 bg-card/70 px-6 py-5">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/15 text-primary">
                <Workflow className="h-4 w-4" />
              </div>
              <div className="text-left">
                <SheetTitle className="text-base font-semibold text-foreground">
                  Session Nodes
                </SheetTitle>
                <SheetDescription className="text-xs text-muted-foreground/80">
                  Manage nodes, commands, and variables in one place
                </SheetDescription>
              </div>
            </div>
          </SheetHeader>

          {/* Filters Bar */}
          <div className="border-b border-border/60 bg-card/40 px-6 py-5 space-y-4">
            {/* View mode selector - filter buttons with counts */}
            <div className="flex items-center gap-2 overflow-x-auto pb-2">
              <button
                onClick={() => setViewMode("nodes")}
                className={`inline-flex cursor-pointer items-center justify-center font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 h-8 rounded-lg px-3 text-xs gap-2 whitespace-nowrap ${
                  viewMode === "nodes"
                    ? "bg-primary text-primary-foreground shadow hover:bg-primary/90"
                    : "border border-border/60 bg-background/80 shadow-sm hover:bg-muted/40 hover:text-foreground"
                }`}
              >
                <ListIcon className="h-4 w-4" />
                All Nodes
                <div
                  className={`inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-transparent ml-1 ${
                    viewMode === "nodes"
                      ? "bg-primary-foreground/20 text-primary-foreground hover:bg-secondary/80"
                      : "bg-secondary/40 text-secondary-foreground hover:bg-secondary/70"
                  }`}
                >
                  {filteredAndSortedNodes.length}
                </div>
              </button>

              <button
                onClick={() => setViewMode("commands")}
                className={`inline-flex cursor-pointer items-center justify-center font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 h-8 rounded-md px-3 text-xs gap-2 whitespace-nowrap ${
                  viewMode === "commands"
                    ? "bg-primary text-primary-foreground shadow hover:bg-primary/90"
                    : "border border-input bg-background shadow-sm hover:bg-muted hover:text-accent-foreground"
                }`}
              >
                <Terminal className="h-4 w-4" />
                Commands
                <div
                  className={`inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-transparent ml-1 ${
                    viewMode === "commands"
                      ? "bg-primary-foreground/20 text-primary-foreground hover:bg-secondary/80"
                      : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                  }`}
                >
                  {filteredCommands?.length || 0}
                </div>
              </button>

              <button
                onClick={() => setViewMode("variables" as any)}
                className={`inline-flex cursor-pointer items-center justify-center font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 h-8 rounded-md px-3 text-xs gap-2 whitespace-nowrap ${
                  viewMode === "variables"
                    ? "bg-primary text-primary-foreground shadow hover:bg-primary/90"
                    : "border border-input bg-background shadow-sm hover:bg-muted hover:text-accent-foreground"
                }`}
              >
                <Package className="h-4 w-4" />
                Variables
                <div
                  className={`inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-transparent ml-1 ${
                    viewMode === "variables"
                      ? "bg-primary-foreground/20 text-primary-foreground hover:bg-secondary/80"
                      : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                  }`}
                >
                  {filteredVariables?.length || 0}
                </div>
              </button>
            </div>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={
                    viewMode === "nodes"
                      ? "Search nodes..."
                      : viewMode === "commands"
                      ? "Search commands..."
                      : "Search variables..."
                  }
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>

              {viewMode === "nodes" ? (
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    {Object.entries(statusConfig).map(([value, config]) => (
                      <SelectItem key={value} value={value}>
                        <div className="flex items-center gap-2">
                          <span className={config.color}>{config.icon}</span>
                          {config.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : viewMode === "commands" ? (
                <Select
                  value={commandFilter}
                  onValueChange={setCommandFilter as any}
                >
                  <SelectTrigger className="w-[180px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Commands</SelectItem>
                    <SelectItem value="has_variables">
                      With Variables ✓
                    </SelectItem>
                    <SelectItem value="missing_variables">
                      Unresolved Variables ⚠️
                    </SelectItem>
                    <SelectItem value="no_variables">Plain Commands</SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                <Select
                  value={variableFilter}
                  onValueChange={setVariableFilter as any}
                >
                  <SelectTrigger className="w-[180px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Variables</SelectItem>
                    <SelectItem value="sensitive">Sensitive 🔒</SelectItem>
                    <SelectItem value="not_sensitive">Non-Sensitive</SelectItem>
                  </SelectContent>
                </Select>
              )}

              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="icon" className="relative">
                    <Filter className="h-4 w-4" />
                    {selectedTags.length > 0 && (
                      <Badge
                        variant="secondary"
                        className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center text-xs"
                      >
                        {selectedTags.length}
                      </Badge>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80" align="end">
              <div className="space-y-4">
                <div>
                  <h4 className="font-medium text-sm mb-2">
                    Filter by Tags
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        {allTags.length > 0 ? (
                          allTags.map((tag) => (
                            <Badge
                              key={tag}
                              variant={
                                selectedTags.includes(tag)
                                  ? "default"
                                  : "outline"
                              }
                              className="cursor-pointer"
                              onClick={() => toggleTag(tag)}
                            >
                              <Tag className="h-3 w-3 mr-1" />
                              {tag}
                            </Badge>
                          ))
                        ) : (
                          <p className="text-sm text-muted-foreground">
                            No tags found
                          </p>
                        )}
                      </div>
                    </div>

                    {selectedTags.length > 0 && (
                      <div className="pt-2 border-t">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            useNodeTableStore.getState().setSelectedTags([])
                          }
                          className="w-full"
                        >
                          Clear tag filters
                        </Button>
                      </div>
                    )}
                  </div>
                </PopoverContent>
              </Popover>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={handleExportCSV}>
                    <FileDown className=" h-4 w-4" />
                    Export{" "}
                    {viewMode === "nodes"
                      ? "Nodes"
                      : viewMode === "commands"
                      ? "Commands"
                      : "Variables"}{" "}
                    to CSV
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              {(searchTerm ||
                (viewMode === "nodes" && statusFilter !== "all") ||
                (viewMode === "commands" && commandFilter !== "all") ||
                (viewMode === "variables" && variableFilter !== "all") ||
                selectedTags.length > 0) && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={reset}
                  title="Clear all filters"
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>

            {/* Active Filters */}
            {selectedTags.length > 0 && (
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm text-muted-foreground">
                  Active filters:
                </span>
                {selectedTags.map((tag) => (
                  <Badge key={tag} variant="secondary" className="gap-1">
                    <Tag className="h-3 w-3" />
                    {tag}
                    <button
                      onClick={() => toggleTag(tag)}
                      className="ml-1 hover:bg-primary/20 rounded"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* Table */}
          <div className="flex-1 overflow-auto px-6 py-6">
            {viewMode === "nodes" ? (
              <div className="overflow-hidden rounded-2xl border border-border/60 bg-card/70 shadow-sm backdrop-blur-sm">
                <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[300px]">
                      <SortableHeader column="title">Title</SortableHeader>
                    </TableHead>
                    <TableHead className="w-[120px]">
                      <SortableHeader column="status">Status</SortableHeader>
                    </TableHead>
                    <TableHead>Tags</TableHead>
                    <TableHead className="w-[140px]">
                      <SortableHeader column="updated">
                        Last Updated
                      </SortableHeader>
                    </TableHead>
                    <TableHead className="w-[100px] text-right">
                      Actions
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8">
                        Loading nodes...
                      </TableCell>
                    </TableRow>
                  ) : filteredAndSortedNodes.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={5}
                        className="text-center py-8 text-muted-foreground"
                      >
                        No nodes found
                      </TableCell>
                    </TableRow>
                  ) : (
                    paginatedNodes.map((node) => {
                      const status =
                        statusConfig[
                          node.status as keyof typeof statusConfig
                        ] || statusConfig.NOT_STARTED;
                      return (
                        <TableRow
                          key={node.id}
                          className="cursor-pointer"
                          onClick={() => handleNodeClick(node.id)}
                        >
                          <TableCell className="font-medium">
                            <div className="space-y-1">
                              <div>{node.title}</div>
                              {node.description && (
                                <div className="text-xs text-muted-foreground line-clamp-1">
                                  {node.description}
                                </div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={cn("gap-1", status.bg, status.color)}
                            >
                              {status.icon}
                              {status.label}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {node.tags?.slice(0, 3).map((tag) => (
                                <Badge
                                  key={tag}
                                  variant="secondary"
                                  className="text-xs"
                                >
                                  {tag}
                                </Badge>
                              ))}
                              {node.tags && node.tags.length > 3 && (
                                <Badge variant="outline" className="text-xs">
                                  +{node.tags.length - 3}
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className="cursor-help">
                                    {formatBackendTimestamp(node.updated_at)}
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <div className="text-xs space-y-1">
                                    {node.updated_at && (
                                      <div>
                                        Updated:{" "}
                                        {parseBackendTimestamp(
                                          node.updated_at
                                        ).toLocaleString()}
                                      </div>
                                    )}
                                    {node.created_at && (
                                      <div>
                                        Created:{" "}
                                        {parseBackendTimestamp(
                                          node.created_at
                                        ).toLocaleString()}
                                      </div>
                                    )}
                                    {!node.updated_at && !node.created_at && (
                                      <div>
                                        No timestamp information available
                                      </div>
                                    )}
                                  </div>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </TableCell>
                          <TableCell>
                            <div className="flex justify-end gap-1">
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleNodeClick(node.id);
                                }}
                              >
                                <ExternalLink className="h-4 w-4" />
                              </Button>
                              {!isReadOnly && (
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-8 w-8 text-destructive"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteNode(node.id);
                                  }}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
                </Table>
              </div>
            ) : viewMode === "commands" ? (
              <div className="overflow-hidden rounded-2xl border border-border/60 bg-card/70 shadow-sm backdrop-blur-sm">
                <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[300px]">Command</TableHead>
                    <TableHead className="w-[200px]">Node</TableHead>
                    <TableHead>Tags</TableHead>
                    <TableHead className="w-[100px] text-right">
                      Actions
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-8">
                        Loading commands...
                      </TableCell>
                    </TableRow>
                  ) : filteredCommands.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={4}
                        className="text-center py-8 text-muted-foreground"
                      >
                        No commands found
                      </TableCell>
                    </TableRow>
                  ) : (
                    paginatedCommands.map((command: any) => (
                      <TableRow key={`${command.nodeId}-${command.id}`}>
                        <TableCell>
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <Terminal className="h-4 w-4 text-muted-foreground shrink-0" />
                              <div className="font-medium">
                                {command.title || "Untitled Command"}
                              </div>
                            </div>
                            {command.command && (
                              <>
                                <div
                                  className="text-xs text-muted-foreground font-mono line-clamp-2"
                                  dangerouslySetInnerHTML={{
                                    __html: formatCommand(
                                      command.command,
                                      contexts || []
                                    ).formattedText,
                                  }}
                                />
                                {hasVariables(command.command) && (
                                  <div className="flex items-center gap-2 mt-1">
                                    {(() => {
                                      const formatted = formatCommand(
                                        command.command,
                                        contexts || []
                                      );
                                      const badges = [];

                                      // Show missing variables badge (only truly missing ones)
                                      if (
                                        formatted.missingVariables.length > 0
                                      ) {
                                        badges.push(
                                          <Badge
                                            key="missing"
                                            variant="destructive"
                                            className="text-xs"
                                          >
                                            Missing{" "}
                                            {formatted.missingVariables.length}{" "}
                                            variable
                                            {formatted.missingVariables.length >
                                            1
                                              ? "s"
                                              : ""}
                                          </Badge>
                                        );
                                      }

                                      // Show sensitive variables badge
                                      if (
                                        formatted.sensitiveVariables.length > 0
                                      ) {
                                        badges.push(
                                          <Badge
                                            key="sensitive"
                                            variant="secondary"
                                            className="text-xs bg-chart-2/10 text-chart-2"
                                          >
                                            {
                                              formatted.sensitiveVariables
                                                .length
                                            }{" "}
                                            sensitive
                                          </Badge>
                                        );
                                      }

                                      // Show resolved variables badge
                                      if (formatted.replacements.length > 0) {
                                        badges.push(
                                          <Badge
                                            key="resolved"
                                            variant="secondary"
                                            className="text-xs"
                                          >
                                            {formatted.replacements.length}{" "}
                                            resolved
                                          </Badge>
                                        );
                                      }

                                      return badges.length > 0 ? badges : null;
                                    })()}
                                  </div>
                                )}
                              </>
                            )}
                            {command.description && (
                              <div className="text-xs text-muted-foreground line-clamp-1">
                                {command.description}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <div className="font-medium">
                              {command.nodeTitle}
                            </div>
                            {command.nodeStatus && (
                              <Badge
                                variant="outline"
                                className={cn(
                                  "gap-1 text-xs",
                                  statusConfig[
                                    command.nodeStatus as keyof typeof statusConfig
                                  ]?.bg || "",
                                  statusConfig[
                                    command.nodeStatus as keyof typeof statusConfig
                                  ]?.color || ""
                                )}
                              >
                                {
                                  statusConfig[
                                    command.nodeStatus as keyof typeof statusConfig
                                  ]?.icon
                                }
                                {
                                  statusConfig[
                                    command.nodeStatus as keyof typeof statusConfig
                                  ]?.label
                                }
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {command.nodeTags
                              ?.slice(0, 3)
                              .map((tag: string) => (
                                <Badge
                                  key={tag}
                                  variant="secondary"
                                  className="text-xs"
                                >
                                  {tag}
                                </Badge>
                              ))}
                            {command.nodeTags &&
                              command.nodeTags.length > 3 && (
                                <Badge variant="outline" className="text-xs">
                                  +{command.nodeTags.length - 3}
                                </Badge>
                              )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex justify-end gap-1">
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8"
                              onClick={() =>
                                handleCopyCommand(
                                  command.command || "",
                                  command.id
                                )
                              }
                              disabled={!command.command}
                            >
                              {copiedCommandId === command.id ? (
                                <Check className="h-4 w-4 text-chart-3" />
                              ) : (
                                <Copy className="h-4 w-4" />
                              )}
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8"
                              onClick={() => handleNodeClick(command.nodeId)}
                            >
                              <ExternalLink className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
                </Table>
              </div>
            ) : (
              <div className="overflow-hidden rounded-2xl border border-border/60 bg-card/70 shadow-sm backdrop-blur-sm">
                <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[200px]">Variable</TableHead>
                    <TableHead className="w-[300px]">Value</TableHead>
                    <TableHead className="w-[200px]">Context</TableHead>
                    <TableHead className="w-[100px] text-right">
                      Actions
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoadingContexts ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-8">
                        Loading variables...
                      </TableCell>
                    </TableRow>
                  ) : filteredVariables.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={4}
                        className="text-center py-8 text-muted-foreground"
                      >
                        No variables found
                      </TableCell>
                    </TableRow>
                  ) : (
                    paginatedVariables.map((variable: any) => (
                      <TableRow key={`${variable.contextId}-${variable.id}`}>
                        <TableCell>
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <Package className="h-4 w-4 text-muted-foreground shrink-0" />
                              <div className="font-medium font-mono">
                                {variable.name}
                              </div>
                            </div>
                            {variable.sensitive && (
                              <Badge variant="destructive" className="text-xs">
                                Sensitive
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm font-mono text-muted-foreground">
                            {variable.sensitive ? "••••••••" : variable.value}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <div className="font-medium">
                              {variable.contextName}
                            </div>
                            {variable.contextDescription && (
                              <div className="text-xs text-muted-foreground line-clamp-1">
                                {variable.contextDescription}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex justify-end gap-1">
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8"
                              onClick={() => {
                                navigator.clipboard.writeText(
                                  variable.value || ""
                                );
                                setCopiedCommandId(variable.id);
                                toast.success(
                                  variable.sensitive
                                    ? "Sensitive variable value copied"
                                    : "Variable value copied"
                                );
                                setTimeout(
                                  () => setCopiedCommandId(null),
                                  2000
                                );
                              }}
                              disabled={!variable.value}
                              title={
                                variable.sensitive
                                  ? "Copy sensitive variable value"
                                  : "Copy variable value"
                              }
                            >
                              {copiedCommandId === variable.id ? (
                                <Check className="h-4 w-4 text-chart-3" />
                              ) : (
                                <Copy className="h-4 w-4" />
                              )}
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8"
                              onClick={() => setShowContextModal(true)}
                            >
                              <ExternalLink className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
                </Table>
              </div>
            )}
          </div>

          {/* Pagination */}
          <div className="p-4 border-t border-border shrink-0">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>
                  Showing{" "}
                  {viewMode === "nodes"
                    ? `${
                        filteredAndSortedNodes.length > 0
                          ? (page - 1) * pageSize + 1
                          : 0
                      } to ${Math.min(
                        page * pageSize,
                        filteredAndSortedNodes.length
                      )} of ${filteredAndSortedNodes.length} nodes`
                    : viewMode === "commands"
                    ? `${
                        filteredCommands.length > 0
                          ? (page - 1) * pageSize + 1
                          : 0
                      } to ${Math.min(
                        page * pageSize,
                        filteredCommands.length
                      )} of ${filteredCommands.length} commands`
                    : `${
                        filteredVariables.length > 0
                          ? (page - 1) * pageSize + 1
                          : 0
                      } to ${Math.min(
                        page * pageSize,
                        filteredVariables.length
                      )} of ${filteredVariables.length} variables`}
                </span>
                <Select
                  value={pageSize.toString()}
                  onValueChange={(value) => {
                    const newPageSize = Number(value);
                    const lastItemInCurrentPage = page * pageSize;
                    const newPage = Math.max(
                      1,
                      Math.ceil(lastItemInCurrentPage / newPageSize)
                    );
                    setPageSize(newPageSize);
                    setPage(newPage);
                  }}
                >
                  <SelectTrigger className="h-8 w-[70px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[10, 20, 30, 40, 50].map((size) => (
                      <SelectItem key={size} value={size.toString()}>
                        {size}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  Previous
                </Button>

                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNum;
                    if (totalPages <= 5) {
                      pageNum = i + 1;
                    } else if (page <= 3) {
                      pageNum = i + 1;
                    } else if (page >= totalPages - 2) {
                      pageNum = totalPages - 4 + i;
                    } else {
                      pageNum = page - 2 + i;
                    }

                    return (
                      <Button
                        key={i}
                        variant={pageNum === page ? "default" : "outline"}
                        size="sm"
                        onClick={() => setPage(pageNum)}
                        className="w-8"
                      >
                        {pageNum}
                      </Button>
                    );
                  })}
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages || totalPages === 0}
                >
                  Next
                </Button>
              </div>
            </div>
          </div>
        </SheetContent>
      </Sheet>
      <ContextModal
        isOpen={showContextModal}
        onClose={() => setShowContextModal(false)}
        projectId={projectId}
        isTemplate={false}
      />
    </>
  );
}
