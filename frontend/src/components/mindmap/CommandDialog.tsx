import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Key, Package, X, Save } from "lucide-react";
import { useProjectContexts } from "@/hooks/api/useContexts";
import { useMindMapStore } from "@/store/mindMapStore";
import type { Command } from "@/types/api";

interface CommandDialogProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  nodeId: string;
  command?: Command;
  onSave: (data: {
    title: string;
    command: string;
    description?: string;
  }) => void;
  isSaving?: boolean;
}

interface VariableCardProps {
  name: string;
  value: string;
  description?: string | null;
  sensitive?: boolean;
  contextName: string;
  onInsert: (variable: string) => void;
}

function VariableCard({
  name,
  value,
  description,
  sensitive,
  contextName,
  onInsert,
}: VariableCardProps) {
  return (
    <Card
      className="cursor-pointer hover:bg-accent/5 transition-colors"
      onClick={() => onInsert(`{{${name}}}`)}
    >
      <CardContent className="p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <Key className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="font-mono text-sm font-medium">{name}</span>
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              <span className="font-mono">
                {sensitive ? "••••••••" : value}
              </span>
            </div>
            {description && (
              <p className="text-xs text-muted-foreground mt-1">
                {description}
              </p>
            )}
          </div>
          <Badge variant="secondary" className="text-xs shrink-0">
            {contextName}
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}

export function CommandDialog({
  isOpen,
  onClose,
  projectId,
  nodeId,
  command,
  onSave,
  isSaving = false,
}: CommandDialogProps) {
  const [title, setTitle] = useState(command?.title || "");
  const [commandText, setCommandText] = useState(command?.command || "");
  const [description, setDescription] = useState(command?.description || "");
  const [cursorPosition, setCursorPosition] = useState(0);

  const { data: contexts, isLoading: contextsLoading } =
    useProjectContexts(projectId);
  const getActiveContextsForProject = useMindMapStore(
    (state) => state.getActiveContextsForProject
  );
  const activeContexts = getActiveContextsForProject(projectId);

  useEffect(() => {
    if (command) {
      setTitle(command.title);
      setCommandText(command.command);
      setDescription(command.description || "");
    } else {
      setTitle("");
      setCommandText("");
      setDescription("");
    }
  }, [command]);

  const handleInsertVariable = (variable: string) => {
    if (!commandText) {
      setCommandText(variable);
      return;
    }

    const newText =
      commandText.slice(0, cursorPosition) +
      variable +
      commandText.slice(cursorPosition);

    setCommandText(newText);
    setCursorPosition(cursorPosition + variable.length);
  };

  const handleCommandTextChange = (
    e: React.ChangeEvent<HTMLTextAreaElement>
  ) => {
    setCommandText(e.target.value);
    setCursorPosition(e.target.selectionStart || 0);
  };

  const handleSave = () => {
    if (!title.trim() || !commandText.trim()) return;

    onSave({
      title: title.trim(),
      command: commandText.trim(),
      description: description.trim() || undefined,
    });
  };

  const activeVariables =
    contexts
      ?.filter((ctx) => activeContexts.includes(ctx.id))
      .flatMap((ctx) =>
        ctx.variables.map((v) => ({
          ...v,
          contextName: ctx.name,
        }))
      ) || [];

  const availableVariablesByContext =
    contexts
      ?.filter((ctx) => activeContexts.includes(ctx.id))
      .map((ctx) => ({
        contextName: ctx.name,
        variables: ctx.variables,
      })) || [];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>
            {command ? "Edit Command" : "Create Command"}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col gap-4">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="command-title">Title</Label>
              <Input
                id="command-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Port Scan, SQL Injection Test"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="command-description">
                Description (Optional)
              </Label>
              <Input
                id="command-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Brief description of what this command does"
              />
            </div>
          </div>

          <div className="flex-1 overflow-hidden flex flex-col">
            <div className="flex items-center justify-between mb-2">
              <Label>Available Variables</Label>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  // Dispatch the event to open context modal
                  const contextEvent = new CustomEvent("openContextModal");
                  window.dispatchEvent(contextEvent);
                }}
              >
                Manage Contexts
              </Button>
            </div>

            {contextsLoading ? (
              <div className="text-sm text-muted-foreground">
                Loading variables...
              </div>
            ) : activeVariables.length === 0 ? (
              <Card className="p-4">
                <p className="text-sm text-muted-foreground text-center">
                  No active contexts with variables. Enable contexts to use
                  variables in commands.
                </p>
              </Card>
            ) : (
              <Tabs
                defaultValue="all"
                className="flex-1 overflow-hidden flex flex-col"
              >
                <TabsList>
                  <TabsTrigger value="all">
                    All Variables ({activeVariables.length})
                  </TabsTrigger>
                  {availableVariablesByContext.map((ctx) => (
                    <TabsTrigger key={ctx.contextName} value={ctx.contextName}>
                      {ctx.contextName} ({ctx.variables.length})
                    </TabsTrigger>
                  ))}
                </TabsList>

                <TabsContent value="all" className="flex-1 overflow-hidden">
                  <ScrollArea className="h-[200px] pr-4">
                    <div className="grid grid-cols-2 gap-2">
                      {activeVariables.map((variable) => (
                        <VariableCard
                          key={`${variable.contextName}-${variable.name}`}
                          name={variable.name}
                          value={variable.value}
                          description={variable.description}
                          sensitive={variable.sensitive}
                          contextName={variable.contextName}
                          onInsert={handleInsertVariable}
                        />
                      ))}
                    </div>
                  </ScrollArea>
                </TabsContent>

                {availableVariablesByContext.map((ctx) => (
                  <TabsContent
                    key={ctx.contextName}
                    value={ctx.contextName}
                    className="flex-1 overflow-hidden"
                  >
                    <ScrollArea className="h-[200px] pr-4">
                      <div className="grid grid-cols-2 gap-2">
                        {ctx.variables.map((variable) => (
                          <VariableCard
                            key={variable.name}
                            name={variable.name}
                            value={variable.value}
                            description={variable.description}
                            sensitive={variable.sensitive}
                            contextName={ctx.contextName}
                            onInsert={handleInsertVariable}
                          />
                        ))}
                      </div>
                    </ScrollArea>
                  </TabsContent>
                ))}
              </Tabs>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="command-text">Command</Label>
            <Textarea
              id="command-text"
              value={commandText}
              onChange={handleCommandTextChange}
              onSelect={(e) =>
                setCursorPosition(e.currentTarget.selectionStart || 0)
              }
              placeholder="Enter command... Click variables above to insert them"
              rows={6}
              className="font-mono text-sm"
              required
            />
            <p className="text-xs text-muted-foreground">
              Use {`{{variable_name}}`} syntax for variables. Click on variables
              above to insert them.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={!title.trim() || !commandText.trim() || isSaving}
          >
            <Save className="h-4 w-4 " />
            {command ? "Update" : "Save"} Command
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
