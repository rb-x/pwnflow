import { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Plus,
  Trash2,
  Edit2,
  Eye,
  EyeOff,
  Save,
  X,
  Package,
  Key,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Search,
} from "lucide-react";
import {
  useProjectContexts,
  useCreateContext,
  useUpdateContext,
  useDeleteContext,
  useCreateVariable,
  useUpdateVariable,
  useDeleteVariable,
} from "@/hooks/api/useContexts";
import { useMindMapStore } from "@/store/mindMapStore";
import type { Context, Variable } from "@/types/api";

interface ContextModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  isTemplate?: boolean;
}

interface ContextCardProps {
  context: Context;
  projectId: string;
  isActive: boolean;
  onToggle: (contextId: string, active: boolean) => void;
  onEdit: (context: Context) => void;
  onDelete: (contextId: string) => void;
  conflictingVariables?: string[];
}

interface VariableItemProps {
  variable: Variable;
  onEdit: (variable: Variable) => void;
  onDelete: (variableId: string) => void;
}

interface VariableFormProps {
  variable?: Variable;
  contextId: string;
  projectId: string;
  onClose: () => void;
}

function VariableForm({
  variable,
  contextId,
  projectId,
  onClose,
}: VariableFormProps) {
  const [name, setName] = useState(variable?.name || "");
  const [value, setValue] = useState(variable?.value || "");
  const [description, setDescription] = useState(variable?.description || "");
  const [sensitive, setSensitive] = useState(variable?.sensitive || false);

  const createVariable = useCreateVariable();
  const updateVariable = useUpdateVariable();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (variable) {
      updateVariable.mutate(
        {
          projectId,
          contextId,
          variableId: variable.id,
          data: { name, value, description, sensitive },
        },
        {
          onSuccess: onClose,
        }
      );
    } else {
      createVariable.mutate(
        {
          projectId,
          contextId,
          data: { name, value, description, sensitive },
        },
        {
          onSuccess: onClose,
        }
      );
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="var-name">Variable Name</Label>
        <Input
          id="var-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g., API_KEY, TARGET_URL"
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="var-value">Value</Label>
        <Textarea
          id="var-value"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Variable value"
          rows={3}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="var-desc">Description (Optional)</Label>
        <Input
          id="var-desc"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What this variable is used for"
        />
      </div>

      <div className="flex items-center space-x-2">
        <Switch
          id="var-sensitive"
          checked={sensitive}
          onCheckedChange={setSensitive}
        />
        <Label htmlFor="var-sensitive" className="cursor-pointer">
          Mark as sensitive (will be hidden in UI)
        </Label>
      </div>

      <div className="flex justify-end gap-2 pt-4">
        <Button type="button" variant="outline" size="sm" onClick={onClose}>
          Cancel
        </Button>
        <Button
          type="submit"
          size="sm"
          disabled={createVariable.isPending || updateVariable.isPending}
        >
          <Save className="h-4 w-4 " />
          {variable ? "Update" : "Create"}
        </Button>
      </div>
    </form>
  );
}

function VariableItem({ variable, onEdit, onDelete }: VariableItemProps) {
  const [showValue, setShowValue] = useState(!variable.sensitive);

  return (
    <div className="group p-3 border rounded-lg hover:bg-accent/5 transition-colors">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <Key className="h-4 w-4 text-muted-foreground" />
            <span className="font-mono text-sm font-medium">
              {variable.name}
            </span>
            {variable.sensitive && (
              <Badge variant="secondary" className="text-xs">
                Sensitive
              </Badge>
            )}
          </div>
          <div className="mt-1">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground font-mono">
                {showValue ? variable.value : "••••••••"}
              </span>
              {variable.sensitive && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => setShowValue(!showValue)}
                >
                  {showValue ? (
                    <EyeOff className="h-3 w-3" />
                  ) : (
                    <Eye className="h-3 w-3" />
                  )}
                </Button>
              )}
            </div>
          </div>
          {variable.description && (
            <p className="text-xs text-muted-foreground mt-1">
              {variable.description}
            </p>
          )}
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => onEdit(variable)}
          >
            <Edit2 className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 hover:text-destructive"
            onClick={() => onDelete(variable.id)}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}

function ContextCard({
  context,
  projectId,
  isActive,
  onToggle,
  onEdit,
  onDelete,
  conflictingVariables,
}: ContextCardProps) {
  const [showVariableForm, setShowVariableForm] = useState(false);
  const [editingVariable, setEditingVariable] = useState<
    Variable | undefined
  >();
  const deleteVariable = useDeleteVariable();

  const handleDeleteVariable = (variableId: string) => {
    if (confirm("Are you sure you want to delete this variable?")) {
      deleteVariable.mutate({ projectId, contextId: context.id, variableId });
    }
  };

  const handleEditVariable = (variable: Variable) => {
    setEditingVariable(variable);
    setShowVariableForm(true);
  };

  const handleCloseVariableForm = () => {
    setShowVariableForm(false);
    setEditingVariable(undefined);
  };

  return (
    <Card className={isActive ? "border-primary" : ""}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <CardTitle className="text-base flex items-center gap-2">
              <Package className="h-4 w-4" />
              {context.name}
              {isActive ? (
                <Badge variant="default" className="text-xs">
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  Active
                </Badge>
              ) : (
                <Badge variant="secondary" className="text-xs">
                  <XCircle className="h-3 w-3 mr-1" />
                  Inactive
                </Badge>
              )}
            </CardTitle>
            {context.description && (
              <CardDescription className="text-xs">
                {context.description}
              </CardDescription>
            )}
            {!isActive &&
              conflictingVariables &&
              conflictingVariables.length > 0 && (
                <div className="flex items-center gap-1 mt-2">
                  <AlertTriangle className="h-3 w-3 text-yellow-500" />
                  <span className="text-xs text-yellow-500">
                    Conflicts with: {conflictingVariables.join(", ")}
                  </span>
                </div>
              )}
          </div>
          <div className="flex items-center gap-2">
            <Switch
              checked={isActive}
              onCheckedChange={(checked) => onToggle(context.id, checked)}
              aria-label="Toggle context"
            />
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => onEdit(context)}
            >
              <Edit2 className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 hover:text-destructive"
              onClick={() => onDelete(context.id)}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">
              Variables ({context.variables.length})
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowVariableForm(true)}
            >
              <Plus className="h-3 w-3 mr-1" />
              Add Variable
            </Button>
          </div>

          {context.variables.length > 0 ? (
            <div className="space-y-2">
              {context.variables.map((variable) => (
                <VariableItem
                  key={variable.id}
                  variable={variable}
                  onEdit={handleEditVariable}
                  onDelete={handleDeleteVariable}
                />
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">
              No variables defined yet
            </p>
          )}
        </div>

        {showVariableForm && (
          <div className="mt-4 p-4 border rounded-lg bg-muted/20">
            <h4 className="text-sm font-medium mb-3">
              {editingVariable ? "Edit Variable" : "New Variable"}
            </h4>
            <VariableForm
              variable={editingVariable}
              contextId={context.id}
              projectId={projectId}
              onClose={handleCloseVariableForm}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function ContextModal({
  isOpen,
  onClose,
  projectId,
  isTemplate,
}: ContextModalProps) {
  const { data: contexts, isLoading } = useProjectContexts(projectId);
  const createContext = useCreateContext();
  const updateContext = useUpdateContext();
  const deleteContext = useDeleteContext();

  const setActiveContextsForProject = useMindMapStore(
    (state) => state.setActiveContextsForProject
  );
  const getActiveContextsForProject = useMindMapStore(
    (state) => state.getActiveContextsForProject
  );
  const activeContexts = getActiveContextsForProject(projectId);

  const [showContextForm, setShowContextForm] = useState(false);
  const [editingContext, setEditingContext] = useState<Context | undefined>();
  const [contextName, setContextName] = useState("");
  const [contextDescription, setContextDescription] = useState("");
  const [conflictWarnings, setConflictWarnings] = useState<
    Record<string, string>
  >({});
  const [variableSearchQuery, setVariableSearchQuery] = useState("");

  // Detect variable conflicts across active contexts
  const variableConflicts = useMemo(() => {
    if (!contexts) return new Map<string, string[]>();

    const conflicts = new Map<string, string[]>();
    const variableToContexts = new Map<string, string[]>();

    // Build map of variable names to context IDs
    contexts.forEach((context) => {
      if (activeContexts.includes(context.id)) {
        context.variables.forEach((variable) => {
          const existing = variableToContexts.get(variable.name) || [];
          existing.push(context.id);
          variableToContexts.set(variable.name, existing);
        });
      }
    });

    // Find conflicts (variables that appear in multiple contexts)
    variableToContexts.forEach((contextIds, variableName) => {
      if (contextIds.length > 1) {
        conflicts.set(variableName, contextIds);
      }
    });

    return conflicts;
  }, [contexts, activeContexts]);

  const handleCreateContext = (e: React.FormEvent) => {
    e.preventDefault();
    createContext.mutate(
      {
        projectId,
        data: { name: contextName, description: contextDescription || null },
      },
      {
        onSuccess: () => {
          setContextName("");
          setContextDescription("");
          setShowContextForm(false);
        },
      }
    );
  };

  const handleUpdateContext = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingContext) return;

    updateContext.mutate(
      {
        projectId,
        contextId: editingContext.id,
        data: { name: contextName, description: contextDescription || null },
      },
      {
        onSuccess: () => {
          setContextName("");
          setContextDescription("");
          setEditingContext(undefined);
          setShowContextForm(false);
        },
      }
    );
  };

  const handleEditContext = (context: Context) => {
    setEditingContext(context);
    setContextName(context.name);
    setContextDescription(context.description || "");
    setShowContextForm(true);
  };

  const handleDeleteContext = (contextId: string) => {
    if (
      confirm(
        "Are you sure you want to delete this context and all its variables?"
      )
    ) {
      deleteContext.mutate({ projectId, contextId });
      // Remove from active contexts if it was active
      setActiveContextsForProject(
        projectId,
        activeContexts.filter((id) => id !== contextId)
      );
    }
  };

  const handleToggleContext = (contextId: string, active: boolean) => {
    if (active) {
      // Check for conflicts before enabling
      const contextToEnable = contexts?.find((c) => c.id === contextId);
      if (!contextToEnable) return;

      const conflictingContexts: string[] = [];
      const conflictingVariables: string[] = [];

      // Check each variable in the context we're trying to enable
      contextToEnable.variables.forEach((variable) => {
        // Check against all currently active contexts
        contexts?.forEach((otherContext) => {
          if (
            activeContexts.includes(otherContext.id) &&
            otherContext.id !== contextId
          ) {
            const hasConflict = otherContext.variables.some(
              (v) => v.name === variable.name
            );
            if (hasConflict) {
              if (!conflictingContexts.includes(otherContext.id)) {
                conflictingContexts.push(otherContext.id);
              }
              if (!conflictingVariables.includes(variable.name)) {
                conflictingVariables.push(variable.name);
              }
            }
          }
        });
      });

      if (conflictingContexts.length > 0) {
        // Disable conflicting contexts
        const newActiveContexts = activeContexts.filter(
          (id) => !conflictingContexts.includes(id)
        );
        newActiveContexts.push(contextId);
        setActiveContextsForProject(projectId, newActiveContexts);

        // Show warning
        const conflictingContextNames = conflictingContexts
          .map((id) => contexts?.find((c) => c.id === id)?.name)
          .filter(Boolean)
          .join(", ");

        setConflictWarnings({
          ...conflictWarnings,
          [contextId]: `Disabled context(s) "${conflictingContextNames}" due to variable conflicts: ${conflictingVariables.join(
            ", "
          )}. Consider renaming these variables to avoid conflicts.`,
        });

        // Clear warning after 10 seconds
        setTimeout(() => {
          setConflictWarnings((prev) => {
            const updated = { ...prev };
            delete updated[contextId];
            return updated;
          });
        }, 10000);
      } else {
        setActiveContextsForProject(projectId, [...activeContexts, contextId]);
      }
    } else {
      setActiveContextsForProject(
        projectId,
        activeContexts.filter((id) => id !== contextId)
      );
      // Clear any warnings for this context
      setConflictWarnings((prev) => {
        const updated = { ...prev };
        delete updated[contextId];
        return updated;
      });
    }
  };

  const handleCloseForm = () => {
    setShowContextForm(false);
    setEditingContext(undefined);
    setContextName("");
    setContextDescription("");
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-[95vw] min-w-[50rem] max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Context Management</DialogTitle>
          <DialogDescription>
            Manage contexts and variables for your{" "}
            {isTemplate ? "template" : "project"}. Contexts can be enabled or
            disabled to control which variables are available.
          </DialogDescription>
        </DialogHeader>

        {/* Show conflict warnings */}
        {Object.entries(conflictWarnings).map(([contextId, warning]) => (
          <Alert
            key={contextId}
            variant="default"
            className="border-yellow-500/50"
          >
            <AlertTriangle className="h-4 w-4 text-yellow-500" />
            <AlertTitle>Variable Conflict Resolved</AlertTitle>
            <AlertDescription className="text-sm">{warning}</AlertDescription>
          </Alert>
        ))}

        <Tabs defaultValue="contexts" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="contexts">Contexts</TabsTrigger>
            <TabsTrigger value="active">Active Variables</TabsTrigger>
          </TabsList>

          <TabsContent value="contexts" className="space-y-4">
            {!showContextForm && (
              <div className="flex justify-between items-center">
                <p className="text-sm text-muted-foreground">
                  {contexts?.length || 0} context
                  {contexts?.length !== 1 ? "s" : ""} defined
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowContextForm(true)}
                >
                  <Plus className="h-4 w-4 " />
                  New Context
                </Button>
              </div>
            )}

            {showContextForm && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">
                    {editingContext ? "Edit Context" : "New Context"}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <form
                    onSubmit={
                      editingContext ? handleUpdateContext : handleCreateContext
                    }
                    className="space-y-4"
                  >
                    <div className="space-y-2">
                      <Label htmlFor="context-name">Context Name</Label>
                      <Input
                        id="context-name"
                        value={contextName}
                        onChange={(e) => setContextName(e.target.value)}
                        placeholder="e.g., Development, Production, Testing"
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="context-desc">
                        Description (Optional)
                      </Label>
                      <Textarea
                        id="context-desc"
                        value={contextDescription}
                        onChange={(e) => setContextDescription(e.target.value)}
                        placeholder="Describe what this context is used for"
                        rows={2}
                      />
                    </div>

                    <div className="flex justify-end gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleCloseForm}
                      >
                        Cancel
                      </Button>
                      <Button
                        type="submit"
                        size="sm"
                        disabled={
                          createContext.isPending || updateContext.isPending
                        }
                      >
                        <Save className="h-4 w-4 " />
                        {editingContext ? "Update" : "Create"}
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            )}

            <ScrollArea className="h-[400px] pr-4">
              {isLoading ? (
                <div className="text-center py-8 text-muted-foreground">
                  Loading contexts...
                </div>
              ) : contexts && contexts.length > 0 ? (
                <div className="space-y-3">
                  {contexts.map((context) => {
                    // Calculate conflicting variables for this context if it's not active
                    let conflictingVars: string[] = [];
                    if (!activeContexts.includes(context.id)) {
                      const conflicts = new Set<string>();
                      context.variables.forEach((variable) => {
                        // Check if this variable exists in any active context
                        contexts.forEach((otherContext) => {
                          if (activeContexts.includes(otherContext.id)) {
                            if (
                              otherContext.variables.some(
                                (v) => v.name === variable.name
                              )
                            ) {
                              conflicts.add(variable.name);
                            }
                          }
                        });
                      });
                      conflictingVars = Array.from(conflicts);
                    }

                    return (
                      <ContextCard
                        key={context.id}
                        context={context}
                        projectId={projectId}
                        isActive={activeContexts.includes(context.id)}
                        onToggle={handleToggleContext}
                        onEdit={handleEditContext}
                        onDelete={handleDeleteContext}
                        conflictingVariables={conflictingVars}
                      />
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  No contexts defined yet. Create one to get started.
                </div>
              )}
            </ScrollArea>
          </TabsContent>

          <TabsContent value="active" className="space-y-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  These variables are currently available from active contexts:
                </p>
                <div className="relative w-64">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search variables..."
                    value={variableSearchQuery}
                    onChange={(e) => setVariableSearchQuery(e.target.value)}
                    className="pl-8 h-9"
                  />
                </div>
              </div>
              {variableConflicts.size > 0 && (
                <Alert variant="default" className="border-yellow-500/50">
                  <AlertTriangle className="h-4 w-4 text-yellow-500" />
                  <AlertTitle>Variable Conflicts Detected</AlertTitle>
                  <AlertDescription className="text-sm">
                    {variableConflicts.size} variable
                    {variableConflicts.size > 1 ? "s have" : " has"} multiple
                    definitions across active contexts:{" "}
                    {Array.from(variableConflicts.keys()).join(", ")}. The last
                    enabled context takes precedence.
                  </AlertDescription>
                </Alert>
              )}
            </div>

            <ScrollArea className="h-[400px] pr-4">
              {contexts && activeContexts.length > 0 ? (
                <div className="space-y-4">
                  {(() => {
                    const activeContextsWithVariables = contexts
                      .filter((ctx) => activeContexts.includes(ctx.id))
                      .map((context) => {
                        // Filter variables based on search query
                        const filteredVariables = context.variables.filter(
                          (variable) => {
                            if (!variableSearchQuery) return true;
                            const query = variableSearchQuery.toLowerCase();
                            return (
                              variable.name.toLowerCase().includes(query) ||
                              variable.value
                                ?.toString()
                                .toLowerCase()
                                .includes(query) ||
                              variable.description
                                ?.toLowerCase()
                                .includes(query)
                            );
                          }
                        );

                        // Don't show context if no variables match
                        if (
                          variableSearchQuery &&
                          filteredVariables.length === 0
                        ) {
                          return null;
                        }

                        return (
                          <div key={context.id} className="space-y-2">
                            <h4 className="font-medium text-sm flex items-center gap-2">
                              <Package className="h-4 w-4" />
                              {context.name}
                              {variableSearchQuery && (
                                <Badge variant="secondary" className="text-xs">
                                  {filteredVariables.length} match
                                  {filteredVariables.length !== 1 ? "es" : ""}
                                </Badge>
                              )}
                            </h4>
                            <div className="pl-6 space-y-2">
                              {filteredVariables.map((variable) => {
                                const hasConflict = variableConflicts.has(
                                  variable.name
                                );
                                return (
                                  <div
                                    key={variable.id}
                                    className="flex items-center gap-2 text-sm"
                                  >
                                    <Key className="h-3 w-3 text-muted-foreground" />
                                    <span
                                      className={`font-mono ${
                                        hasConflict ? "text-yellow-500" : ""
                                      }`}
                                    >
                                      {variable.name}
                                    </span>
                                    {hasConflict && (
                                      <Badge
                                        variant="outline"
                                        className="text-xs py-0 px-1 border-yellow-500/50 text-yellow-500"
                                      >
                                        Multiple definitions
                                      </Badge>
                                    )}
                                    <span className="text-muted-foreground">
                                      =
                                    </span>
                                    <span className="font-mono text-muted-foreground">
                                      {variable.sensitive
                                        ? "••••••••"
                                        : variable.value}
                                    </span>
                                    {variable.description && (
                                      <span className="text-xs text-muted-foreground ml-2">
                                        ({variable.description})
                                      </span>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })
                      .filter(Boolean);

                    if (
                      variableSearchQuery &&
                      activeContextsWithVariables.length === 0
                    ) {
                      return (
                        <div className="text-center py-8 text-muted-foreground">
                          No variables found matching "{variableSearchQuery}"
                        </div>
                      );
                    }

                    return activeContextsWithVariables;
                  })()}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  No active contexts. Enable a context to see its variables
                  here.
                </div>
              )}
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
