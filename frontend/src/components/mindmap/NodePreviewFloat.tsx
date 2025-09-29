import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type {
  ComponentType,
  PointerEvent as ReactPointerEvent,
  KeyboardEvent as ReactKeyboardEvent,
} from "react";
import {
  X,
  FileText,
  Bug,
  Terminal,
  Tag,
  CircleDashed,
  PlayCircle,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Copy,
  Maximize2,
  Pencil,
  Check,
  Loader2,
} from "lucide-react";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { Tabs as VercelTabs } from "@/components/ui/vercel-tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { TipTapEditor } from "@/components/TipTapEditor";
import { CommandDisplay } from "./CommandDisplay";
import { useProjectNodes, useUpdateNode } from "@/hooks/api/useNodes";
import { useNodeCommands } from "@/hooks/api/useCommands";
import { useNodeFinding } from "@/hooks/api/useFindings";
import { useProjectContexts } from "@/hooks/api/useContexts";
import { cn } from "@/lib/utils";
import type { Command } from "@/types/api";
import { useReactFlow } from "@xyflow/react";
import { toast } from "sonner";
import { useMindMapStore } from "@/store/mindMapStore";

interface NodePreviewFloatProps {
  projectId: string;
  nodeId: string | null;
  position: { x: number; y: number } | null;
  isTemplate?: boolean;
  onClose: () => void;
  onPositionChange?: (position: { x: number; y: number }) => void;
}

const CARD_WIDTH = 480;
const CARD_MARGIN = 16;

const statusConfig: Record<
  string,
  { label: string; icon: ComponentType<{ className?: string }>; className: string }
> = {
  NOT_STARTED: {
    label: "Not Started",
    icon: CircleDashed,
    className: "text-blue-500 bg-blue-500/10",
  },
  IN_PROGRESS: {
    label: "In Progress",
    icon: PlayCircle,
    className: "text-yellow-500 bg-yellow-500/10",
  },
  SUCCESS: {
    label: "Success",
    icon: CheckCircle2,
    className: "text-emerald-500 bg-emerald-500/10",
  },
  FAILED: {
    label: "Failed",
    icon: XCircle,
    className: "text-red-500 bg-red-500/10",
  },
  NOT_APPLICABLE: {
    label: "Not Applicable",
    icon: HelpCircle,
    className: "text-muted-foreground bg-muted/20",
  },
};

export function NodePreviewFloat({
  projectId,
  nodeId,
  position,
  isTemplate = false,
  onClose,
  onPositionChange,
}: NodePreviewFloatProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const dragStateRef = useRef<{ offsetX: number; offsetY: number } | null>(null);
  const [activeTab, setActiveTab] = useState("description");
  const [isDragging, setIsDragging] = useState(false);
  const [localStatus, setLocalStatus] = useState<string>("NOT_STARTED");
  const [copiedCommandId, setCopiedCommandId] = useState<string | null>(null);
  const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [localTitle, setLocalTitle] = useState("");
  const [isSavingTitle, setIsSavingTitle] = useState(false);
  const titleInputRef = useRef<HTMLInputElement>(null);

  const { data: projectData } = useProjectNodes(projectId, isTemplate);
  const updateNode = useUpdateNode();
  const { setNodes } = useReactFlow();

  const node = useMemo(() => {
    if (!nodeId || !projectData?.nodes) return null;
    return projectData.nodes.find((item) => item.id === nodeId) || null;
  }, [nodeId, projectData]);

  const { data: fetchedCommands = [] } = useNodeCommands(projectId, nodeId || "", {
    enabled: !isTemplate && !!nodeId,
  });

  const { data: fetchedFinding } = useNodeFinding(projectId, nodeId || "", {
    enabled: !isTemplate && !!nodeId,
  });

  const commands: Command[] = useMemo(() => {
    if (isTemplate && node?.commands) {
      return node.commands;
    }
    return Array.isArray(fetchedCommands) ? fetchedCommands : [];
  }, [fetchedCommands, isTemplate, node?.commands]);

  const contextsQuery = useProjectContexts(projectId);
  const contexts = isTemplate ? [] : contextsQuery.data || [];
  const getActiveContextsForProject = useMindMapStore(
    (state) => state.getActiveContextsForProject
  );
  const activeContexts = getActiveContextsForProject(projectId);

  const activeVariables = useMemo(() => {
    if (!contexts || !activeContexts.length) return new Map<string, any>();

    const variableMap = new Map<string, any>();
    contexts
      .filter((ctx) => activeContexts.includes(ctx.id))
      .forEach((ctx) => {
        ctx.variables.forEach((variable) => {
          variableMap.set(variable.name, variable);
        });
      });

    return variableMap;
  }, [contexts, activeContexts]);

  const finding = useMemo(() => {
    if (isTemplate) {
      return node?.finding || null;
    }
    return fetchedFinding ?? node?.finding ?? null;
  }, [fetchedFinding, isTemplate, node?.finding]);

  useEffect(() => {
    if (nodeId) {
      setActiveTab("description");
    }
  }, [nodeId]);

  useEffect(() => {
    if (node?.title) {
      setLocalTitle(node.title);
    }
  }, [node?.title]);

  useEffect(() => {
    if (isEditingTitle) {
      const timeoutId = setTimeout(() => {
        if (titleInputRef.current) {
          titleInputRef.current.focus();
          titleInputRef.current.select();
        }
      }, 0);

      return () => clearTimeout(timeoutId);
    }
  }, [isEditingTitle]);

  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current) {
        clearTimeout(copyTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest("[data-node-preview-ignore-close]")) {
        return;
      }

      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        onClose();
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  const clampPosition = useCallback(
    (next: { x: number; y: number }) => {
      const parentRect = containerRef.current?.parentElement?.getBoundingClientRect();
      if (!parentRect) return next;

      const cardWidth = containerRef.current?.offsetWidth ?? CARD_WIDTH;
      const cardHeight = containerRef.current?.offsetHeight ?? 360;

      const maxX = parentRect.width - cardWidth - CARD_MARGIN;
      const maxY = parentRect.height - cardHeight - CARD_MARGIN;

      return {
        x: Math.min(Math.max(CARD_MARGIN, next.x), Math.max(CARD_MARGIN, maxX)),
        y: Math.min(Math.max(CARD_MARGIN, next.y), Math.max(CARD_MARGIN, maxY)),
      };
    },
    []
  );

  const handlePointerDown = useCallback(
    (event: ReactPointerEvent) => {
      if (!onPositionChange || !containerRef.current) return;
      if (event.button !== 0) return;
      const target = event.target as HTMLElement;
      if (
        target.closest("button") ||
        target.closest("[data-node-preview-ignore-close]")
      ) {
        return;
      }
      const rect = containerRef.current.getBoundingClientRect();
      dragStateRef.current = {
        offsetX: event.clientX - rect.left,
        offsetY: event.clientY - rect.top,
      };
      containerRef.current.setPointerCapture(event.pointerId);
      setIsDragging(true);
    },
    [onPositionChange]
  );

  const handlePointerMove = useCallback(
    (event: ReactPointerEvent) => {
      if (!onPositionChange || !dragStateRef.current) return;
      event.preventDefault();
      const parentRect = containerRef.current?.parentElement?.getBoundingClientRect();
      if (!parentRect) return;

      const unclamped = {
        x: event.clientX - parentRect.left - dragStateRef.current.offsetX,
        y: event.clientY - parentRect.top - dragStateRef.current.offsetY,
      };
      const next = clampPosition(unclamped);
      onPositionChange(next);
    },
    [clampPosition, onPositionChange]
  );

  const handlePointerUp = useCallback(
    (event: ReactPointerEvent) => {
      if (!onPositionChange || !containerRef.current) return;
      dragStateRef.current = null;
      containerRef.current.releasePointerCapture(event.pointerId);
      setIsDragging(false);
    },
    [onPositionChange]
  );

  const handleStartEditingTitle = useCallback(() => {
    if (isTemplate || !node) return;
    setLocalTitle(node.title || "");
    setIsEditingTitle(true);
  }, [isTemplate, node]);

  const handleCancelTitle = useCallback(() => {
    if (!node) return;
    setLocalTitle(node.title || "");
    setIsEditingTitle(false);
  }, [node]);

  const handleSaveTitle = useCallback(async () => {
    if (!node || isTemplate || isSavingTitle) return;

    const trimmedTitle = localTitle.trim();
    if (!trimmedTitle) {
      toast.error("Title cannot be empty");
      return;
    }

    if (trimmedTitle === node.title) {
      setIsEditingTitle(false);
      return;
    }

    try {
      setIsSavingTitle(true);
      const updatedNode = await updateNode.mutateAsync({
        projectId,
        nodeId: node.id,
        data: { title: trimmedTitle },
      });

      setNodes((flowNodes) =>
        flowNodes.map((flowNode) =>
          flowNode.id === node.id
            ? {
                ...flowNode,
                data: {
                  ...flowNode.data,
                  ...updatedNode,
                  label: updatedNode.title ?? trimmedTitle,
                },
              }
            : flowNode
        )
      );

      setLocalTitle(updatedNode.title ?? trimmedTitle);
      setIsEditingTitle(false);
      toast.success("Title updated");
    } catch (error) {
      toast.error("Failed to update title");
    } finally {
      setIsSavingTitle(false);
    }
  }, [
    isSavingTitle,
    isTemplate,
    localTitle,
    node,
    projectId,
    setNodes,
    updateNode,
  ]);

  const handleTitleKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLInputElement>) => {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        void handleSaveTitle();
      } else if (event.key === "Escape") {
        event.preventDefault();
        handleCancelTitle();
      }
    },
    [handleCancelTitle, handleSaveTitle]
  );

  if (!nodeId || !projectData) {
    return null;
  }

  if (!node) {
    return null;
  }

  const status = statusConfig[localStatus] || statusConfig.NOT_STARTED;
  const StatusIcon = status.icon;
  const displayedTitle = node.title ?? localTitle;

  const resolvedPosition = clampPosition(
    position || { x: CARD_MARGIN, y: CARD_MARGIN }
  );

  useEffect(() => {
    if (node?.status) {
      setLocalStatus((prev) => (prev !== node.status ? node.status : prev));
    }
  }, [node?.status]);

  const resolveCommandVariables = useCallback(
    (commandText: string, replaceWithValues: boolean = false) => {
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
          const matchIndex = match.index ?? 0;

          if (matchIndex > lastIndex) {
            resolvedParts.push({
              text: commandText.slice(lastIndex, matchIndex),
            });
          }

          const variable = activeVariables.get(variableName.trim());

          if (replaceWithValues && variable) {
            resolvedParts.push({ text: variable.value || "" });
          } else {
            resolvedParts.push({
              text: fullMatch,
              isVariable: true,
              variable: variable || null,
              found: !!variable,
            });
          }

          lastIndex = matchIndex + fullMatch.length;
        });

        if (lastIndex < commandText.length) {
          resolvedParts.push({ text: commandText.slice(lastIndex) });
        }

        return resolvedParts;
      } catch (error) {
        console.error("Error resolving command variables:", error);
        return [{ text: commandText || "" }];
      }
    },
    [activeVariables]
  );

  const handleCopyCommand = useCallback(
    (command: Command) => {
      try {
        if (isTemplate) {
          navigator.clipboard.writeText(command.command || "");
          toast.success("Command copied");
          if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
          setCopiedCommandId(command.id);
          copyTimeoutRef.current = setTimeout(() => setCopiedCommandId(null), 1500);
          return;
        }

        const resolvedParts = resolveCommandVariables(command.command, true);
        const resolvedCommand = resolvedParts
          .map((part) => part.text || "")
          .join("");

        navigator.clipboard.writeText(resolvedCommand);
        toast.success("Command copied with resolved variables");
        if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
        setCopiedCommandId(command.id);
        copyTimeoutRef.current = setTimeout(() => setCopiedCommandId(null), 1500);
      } catch (error) {
        console.error("Error copying command:", error);
        navigator.clipboard.writeText(command.command || "");
        toast.success("Command copied");
        if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
        setCopiedCommandId(command.id);
        copyTimeoutRef.current = setTimeout(() => setCopiedCommandId(null), 1500);
      }
    },
    [isTemplate, resolveCommandVariables]
  );

  const handleStatusChange = async (nextStatus: string) => {
    if (!node) return;
    const previousStatus = localStatus;
    setLocalStatus(nextStatus);
    try {
      const updatedNode = await updateNode.mutateAsync({
        projectId,
        nodeId: node.id,
        data: { status: nextStatus },
      });

      setNodes((flowNodes) =>
        flowNodes.map((flowNode) =>
          flowNode.id === node.id
            ? {
                ...flowNode,
                data: {
                  ...flowNode.data,
                  ...updatedNode,
                },
              }
            : flowNode
        )
      );

      if (updatedNode.status) {
        setLocalStatus(updatedNode.status);
      }

      toast.success("Status updated");
    } catch (error) {
      toast.error("Failed to update status");
      setLocalStatus(previousStatus);
    }
  };

  return (
    <div
      ref={containerRef}
      className={cn(
        "absolute z-50 w-[480px] max-h-[540px] flex flex-col",
        "bg-card/95 backdrop-blur border border-border/80 shadow-2xl rounded-xl",
        "animate-in fade-in-0 zoom-in-95",
        isDragging ? "cursor-grabbing" : ""
      )}
      style={{ top: `${resolvedPosition.y}px`, left: `${resolvedPosition.x}px` }}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      <div
        className={cn(
          "flex items-start justify-between gap-3 p-4 border-b border-border/70",
          onPositionChange ? (isDragging ? "cursor-grabbing" : "cursor-grab") : ""
        )}
        onPointerDown={handlePointerDown}
      >
        <div className="flex flex-col gap-2 pr-8">
          <div className="flex items-center gap-2 min-w-0">
            {isEditingTitle && !isTemplate ? (
              <div
                className="flex items-center gap-2 min-w-0 flex-1"
                data-node-preview-ignore-close
              >
                <Input
                  ref={titleInputRef}
                  value={localTitle}
                  onChange={(event) => setLocalTitle(event.target.value)}
                  onKeyDown={handleTitleKeyDown}
                  disabled={isSavingTitle}
                  data-node-preview-ignore-close
                  className="h-9 flex-1 text-lg font-semibold leading-tight"
                />
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8"
                  onClick={() => void handleSaveTitle()}
                  disabled={isSavingTitle || !localTitle.trim()}
                  data-node-preview-ignore-close
                >
                  {isSavingTitle ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Check className="h-4 w-4" />
                  )}
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8"
                  onClick={handleCancelTitle}
                  disabled={isSavingTitle}
                  data-node-preview-ignore-close
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <>
                <h3
                  className="flex-1 truncate text-lg font-semibold leading-tight"
                  title={displayedTitle}
                  onDoubleClick={() => {
                    if (!isTemplate) {
                      handleStartEditingTitle();
                    }
                  }}
                >
                  {displayedTitle}
                </h3>
                {!isTemplate && (
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 shrink-0 text-muted-foreground hover:text-foreground"
                    onClick={handleStartEditingTitle}
                    data-node-preview-ignore-close
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                )}
              </>
            )}
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            {isTemplate ? (
              <span
                className={cn(
                  "inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium",
                  status.className
                )}
              >
                <StatusIcon className="h-3.5 w-3.5" />
                {status.label}
              </span>
            ) : (
              <Select value={localStatus} onValueChange={handleStatusChange}>
                <SelectTrigger
                  className="h-auto border-0 bg-transparent p-0 focus:ring-0 focus:ring-offset-0 [&>svg]:hidden"
                  data-node-preview-ignore-close
                >
                  <SelectValue asChild>
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium",
                        status.className
                      )}
                    >
                      <StatusIcon className="h-3.5 w-3.5" />
                      {status.label}
                    </span>
                  </SelectValue>
                </SelectTrigger>
                <SelectContent
                  align="start"
                  className="w-48"
                  data-node-preview-ignore-close
                >
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
            )}
          </div>
        </div>
        <div
          className="flex items-center gap-1 shrink-0"
          data-node-preview-ignore-close
        >
          {!isTemplate && node && (
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7"
              onClick={() => {
                useMindMapStore.getState().setSelectedNodeId(node.id);
                useMindMapStore.getState().setDrawerOpen(true);
                onClose();
              }}
            >
              <Maximize2 className="h-4 w-4" />
            </Button>
          )}
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="flex-1 flex flex-col overflow-hidden"
      >
        <div className="border-b border-border px-4 py-2">
          <VercelTabs
            tabs={[
              {
                id: "description",
                label: "Description",
                icon: <FileText className="h-3.5 w-3.5" />,
              },
              {
                id: "findings",
                label: finding ? "Findings (1)" : "Findings",
                icon: <Bug className="h-3.5 w-3.5" />,
              },
              {
                id: "commands",
                label:
                  commands.length > 0
                    ? `Commands (${commands.length})`
                    : "Commands",
                icon: <Terminal className="h-3.5 w-3.5" />,
              },
              {
                id: "tags",
                label:
                  node.tags && node.tags.length > 0
                    ? `Tags (${node.tags.length})`
                    : "Tags",
                icon: <Tag className="h-3.5 w-3.5" />,
              },
            ]}
            activeTab={activeTab}
            onTabChange={setActiveTab}
          />
        </div>

        <div className="flex-1 overflow-hidden">
          <TabsContent
            value="description"
            className="data-[state=active]:flex data-[state=active]:flex-col h-full overflow-hidden"
          >
            <div className="flex-1 overflow-y-auto max-h-[360px]">
              <div className="p-4 space-y-3 text-sm">
                {node.description ? (
                  <TipTapEditor
                    initialContent={node.description}
                    readOnly={true}
                    placeholder=""
                  />
                ) : (
                  <p className="text-muted-foreground italic">
                    No description available.
                  </p>
                )}
              </div>
            </div>
          </TabsContent>

          <TabsContent
            value="findings"
            className="data-[state=active]:flex data-[state=active]:flex-col h-full overflow-hidden"
          >
            <div className="flex-1 overflow-y-auto max-h-[360px]">
              <div className="p-4 space-y-3 text-sm">
                {finding?.content ? (
                  <TipTapEditor
                    initialContent={finding.content}
                    readOnly={true}
                    placeholder=""
                  />
                ) : (
                  <p className="text-muted-foreground italic">
                    No findings recorded.
                  </p>
                )}
              </div>
            </div>
          </TabsContent>

          <TabsContent
            value="commands"
            className="data-[state=active]:flex data-[state=active]:flex-col h-full overflow-hidden"
          >
            <div className="flex-1 overflow-y-auto max-h-[360px]">
              <div className="p-4 space-y-4 text-sm">
                {commands.length === 0 && (
                  <p className="text-muted-foreground italic">
                    No commands documented.
                  </p>
                )}
                {commands.map((command) => {
                  const commandParts = isTemplate
                    ? [{ text: command.command }]
                    : resolveCommandVariables(command.command);

                  return (
                    <div
                      key={command.id}
                      className="rounded-md border border-border/70 bg-background/80 shadow-sm"
                    >
                      <div className="flex items-start justify-between gap-2 p-3 relative">
                        <div>
                          <h4 className="font-medium text-sm">{command.title}</h4>
                          {command.description && (
                            <p className="text-xs text-muted-foreground mt-1">
                              {command.description}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 shrink-0"
                            onClick={() => handleCopyCommand(command)}
                            title="Copy command"
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                        </div>
                        {copiedCommandId === command.id && (
                          <div className="absolute -top-3 right-0 rounded bg-foreground/90 px-2 py-0.5 text-[11px] font-medium text-background shadow-sm">
                            Copied
                          </div>
                        )}
                      </div>
                      <div className="border-t border-border/70 p-3 font-mono text-xs bg-muted/50">
                        <CommandDisplay
                        commandParts={commandParts}
                        showSensitiveVariables={{}}
                        onToggleSensitive={() => {}}
                        isReadOnly
                        className="whitespace-pre-wrap break-words"
                      />
                    </div>
                  </div>
                  );
                })}
              </div>
            </div>
          </TabsContent>

          <TabsContent
            value="tags"
            className="data-[state=active]:flex data-[state=active]:flex-col h-full"
          >
            <div className="flex-1">
              <div className="p-4 space-y-3 text-sm">
                {node.tags?.length ? (
                  <div className="flex flex-wrap gap-2">
                    {node.tags.map((tag) => (
                      <Badge key={tag} variant="secondary">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground italic">
                    No tags assigned.
                  </p>
                )}
              </div>
            </div>
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
