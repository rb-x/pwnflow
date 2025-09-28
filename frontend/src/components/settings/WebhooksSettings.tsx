import { useEffect, useMemo, useState } from "react";
import {
  Copy,
  Edit,
  Loader2,
  Plus,
  RefreshCw,
  Shield,
  Trash,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { useProjects } from "@/hooks/api/useProjects";
import {
  useCreateScopedWebhook,
  useDeleteScopedWebhook,
  useUpdateScopedWebhook,
  useWebhooks,
} from "@/hooks/api/useWebhooks";
import type { Webhook } from "@/types";
import { toast } from "sonner";

const AVAILABLE_EVENTS = [
  { id: "project.created", label: "Project Created" },
  { id: "project.deleted", label: "Project Deleted" },
  { id: "node.created", label: "Node Created" },
  { id: "node.updated", label: "Node Updated" },
  { id: "node.deleted", label: "Node Deleted" },
  { id: "finding.created", label: "Finding Created" },
  { id: "command.triggered", label: "Command Triggered" },
];

const DEFAULT_EVENTS = new Set(["node.created", "node.updated"]);

type ScopeOption = "global" | "project";

interface FormState {
  scope: ScopeOption;
  projectId?: string;
  url: string;
  secret: string;
  events: Set<string>;
}

const INITIAL_FORM: FormState = {
  scope: "project",
  projectId: undefined,
  url: "",
  secret: "",
  events: new Set(DEFAULT_EVENTS),
};

export function WebhooksSettings() {
  const { data: projects, isLoading: projectsLoading } = useProjects();
  const { data: webhooks = [], isLoading, refetch } = useWebhooks();
  const createMutation = useCreateScopedWebhook();
  const updateMutation = useUpdateScopedWebhook();
  const deleteMutation = useDeleteScopedWebhook();

  const projectLookup = useMemo(() => {
    if (!projects) return new Map<string, string>();
    return new Map(projects.map((project) => [project.id, project.name]));
  }, [projects]);

  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [createForm, setCreateForm] = useState<FormState>(INITIAL_FORM);

  const [editingWebhook, setEditingWebhook] = useState<Webhook | null>(null);
  const [editForm, setEditForm] = useState<FormState>({ ...INITIAL_FORM, scope: "project" });

  useEffect(() => {
    if (projects && projects.length > 0) {
      setCreateForm((prev) => ({
        ...prev,
        projectId: prev.projectId ?? projects[0].id,
      }));
    }
  }, [projects]);

  useEffect(() => {
    if (projects && projects.length === 0) {
      setCreateForm((prev) => ({
        ...prev,
        scope: "global",
        projectId: undefined,
      }));
    }
  }, [projects]);

  useEffect(() => {
    if (editingWebhook) {
      setEditForm({
        scope: editingWebhook.scope,
        projectId: editingWebhook.project_id ?? undefined,
        url: editingWebhook.url,
        secret: editingWebhook.secret ?? "",
        events: new Set(editingWebhook.events ?? []),
      });
    }
  }, [editingWebhook]);

  const resetCreateForm = () => {
    setCreateForm((prev) => ({
      ...INITIAL_FORM,
      projectId: projects && projects.length > 0 ? projects[0].id : undefined,
    }));
  };

  const toggleCreateEvent = (eventId: string) => {
    setCreateForm((prev) => {
      const events = new Set(prev.events);
      if (events.has(eventId)) {
        events.delete(eventId);
      } else {
        events.add(eventId);
      }
      return { ...prev, events };
    });
  };

  const toggleEditEvent = (eventId: string) => {
    setEditForm((prev) => {
      const events = new Set(prev.events);
      if (events.has(eventId)) {
        events.delete(eventId);
      } else {
        events.add(eventId);
      }
      return { ...prev, events };
    });
  };

  const handleCreate = async () => {
    if (!createForm.url.trim()) {
      toast.error("Webhook URL is required");
      return;
    }

    if (createForm.events.size === 0) {
      toast.error("Select at least one event");
      return;
    }

    if (createForm.scope === "project" && !createForm.projectId) {
      toast.error("Select a project for project webhooks");
      return;
    }

    await createMutation.mutateAsync({
      scope: createForm.scope,
      project_id: createForm.scope === "project" ? createForm.projectId : undefined,
      url: createForm.url.trim(),
      events: Array.from(createForm.events),
      secret: createForm.secret.trim() || undefined,
    });

    setIsCreateDialogOpen(false);
    resetCreateForm();
  };

  const handleToggleActive = async (hook: Webhook) => {
    await updateMutation.mutateAsync({
      id: hook.id,
      data: { is_active: !hook.is_active },
    });
  };

  const handleUpdate = async () => {
    if (!editingWebhook) return;
    if (!editForm.url.trim()) {
      toast.error("Webhook URL is required");
      return;
    }
    if (editForm.events.size === 0) {
      toast.error("Select at least one event");
      return;
    }

    await updateMutation.mutateAsync({
      id: editingWebhook.id,
      data: {
        url: editForm.url.trim(),
        secret: editForm.secret.trim() || undefined,
        events: Array.from(editForm.events),
        is_active: editingWebhook.is_active,
      },
    });

    setEditingWebhook(null);
  };

  const handleDelete = async (hook: Webhook) => {
    await deleteMutation.mutateAsync(hook.id);
  };

  const copyWebhookUrl = (url: string) => {
    navigator.clipboard.writeText(url);
    toast.success("Webhook URL copied");
  };

  if (projectsLoading && isLoading) {
    return (
      <Card className="border border-white/10 bg-[#0f0f0f]">
        <CardHeader>
          <CardTitle>Webhooks</CardTitle>
          <CardDescription>Loading settings…</CardDescription>
        </CardHeader>
        <CardContent className="flex h-40 items-center justify-center text-white/60">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Loading
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border border-white/10 bg-[#0f0f0f]">
      <CardHeader>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <CardTitle className="text-white">Webhooks</CardTitle>
            <CardDescription>Configure global and project webhook integrations.</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Button onClick={() => setIsCreateDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add webhook
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="flex h-32 items-center justify-center text-white/60">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading webhooks
          </div>
        ) : webhooks.length === 0 ? (
          <div className="rounded-xl border border-dashed border-white/20 bg-black/40 p-8 text-center text-sm text-white/60">
            No webhooks configured yet. Create a webhook to receive notifications.
          </div>
        ) : (
          <div className="space-y-3">
            {webhooks.map((hook) => {
              const projectName = hook.project_id ? projectLookup.get(hook.project_id) : null;
              return (
                <div
                  key={hook.id}
                  className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-[#111] p-4 lg:flex-row lg:items-center lg:justify-between"
                >
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center gap-2 text-sm text-white/90">
                      <Badge variant="outline" className="border-white/20 bg-white/5 text-white/80">
                        {hook.scope === "global" ? "Global" : projectName ? `Project • ${projectName}` : "Project"}
                      </Badge>
                      <code className="rounded-lg bg-black/60 px-3 py-1 text-xs text-white/80">
                        {hook.url}
                      </code>
                      <Button variant="ghost" size="icon" onClick={() => copyWebhookUrl(hook.url)}>
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Badge variant={hook.is_active ? "default" : "secondary"}>
                        {hook.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {hook.events.map((evt) => (
                        <Badge key={evt} variant="secondary" className="bg-white/10 text-white/80">
                          {evt}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="icon" onClick={() => setEditingWebhook(hook)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleToggleActive(hook)}
                      disabled={updateMutation.isLoading}
                    >
                      <Shield className={`h-4 w-4 ${hook.is_active ? "text-emerald-400" : "text-white/40"}`} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(hook)}
                      disabled={deleteMutation.isLoading}
                    >
                      <Trash className="h-4 w-4 text-red-400" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>

      <Dialog open={isCreateDialogOpen} onOpenChange={(open) => {
        setIsCreateDialogOpen(open);
        if (!open) {
          resetCreateForm();
        }
      }}>
        <DialogContent className="max-w-3xl border border-white/10 bg-[#0f0f0f]">
          <DialogHeader>
            <DialogTitle>Create webhook</DialogTitle>
          </DialogHeader>
          <div className="space-y-6">
            <div className="space-y-2">
              <Label>Scope</Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={createForm.scope === "global" ? "default" : "outline"}
                  onClick={() => setCreateForm((prev) => ({ ...prev, scope: "global" }))}
                >
                  Global
                </Button>
                <Button
                  type="button"
                  variant={createForm.scope === "project" ? "default" : "outline"}
                  disabled={!projects || projects.length === 0}
                  onClick={() =>
                    setCreateForm((prev) => ({
                      ...prev,
                      scope: "project",
                      projectId:
                        prev.projectId || (projects && projects.length > 0 ? projects[0].id : undefined),
                    }))
                  }
                >
                  Project
                </Button>
              </div>
            </div>

            {createForm.scope === "project" ? (
              <div className="space-y-2">
                <Label>Project</Label>
                <Select
                  value={createForm.projectId}
                  onValueChange={(value) =>
                    setCreateForm((prev) => ({
                      ...prev,
                      projectId: value,
                    }))
                  }
                >
                  <SelectTrigger className="w-full bg-black/40 border-white/15">
                    <SelectValue placeholder="Select a project" />
                  </SelectTrigger>
                  <SelectContent>
                    {(projects ?? []).map((project) => (
                      <SelectItem key={project.id} value={project.id}>
                        {project.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Destination URL</Label>
                <Input
                  placeholder="https://example.com/webhooks"
                  value={createForm.url}
                  onChange={(e) => setCreateForm((prev) => ({ ...prev, url: e.target.value }))}
                  className="bg-black/40 border-white/15"
                />
              </div>
              <div className="space-y-2">
                <Label>Signing secret (optional)</Label>
                <Input
                  placeholder="Secret used to sign payloads"
                  value={createForm.secret}
                  onChange={(e) => setCreateForm((prev) => ({ ...prev, secret: e.target.value }))}
                  className="bg-black/40 border-white/15"
                />
              </div>
            </div>

            <div className="space-y-3">
              <Label>Events</Label>
              <div className="grid gap-2 md:grid-cols-2">
                {AVAILABLE_EVENTS.map((event) => (
                  <label
                    key={event.id}
                    className="flex items-center gap-2 rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm"
                  >
                    <Checkbox
                      checked={createForm.events.has(event.id)}
                      onCheckedChange={() => toggleCreateEvent(event.id)}
                    />
                    <span>{event.label}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsCreateDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={createMutation.isLoading}>
              {createMutation.isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingWebhook} onOpenChange={(open) => {
        if (!open) {
          setEditingWebhook(null);
        }
      }}>
        <DialogContent className="max-w-3xl border border-white/10 bg-[#0f0f0f]">
          <DialogHeader>
            <DialogTitle>Edit webhook</DialogTitle>
          </DialogHeader>
          {editingWebhook ? (
            <div className="space-y-6">
              <div className="space-y-1 text-sm text-white/70">
                <span className="font-medium text-white">Scope:</span>{" "}
                {editingWebhook.scope === "global"
                  ? "Global"
                  : `Project • ${projectLookup.get(editingWebhook.project_id ?? "") || "Unknown"}`}
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Destination URL</Label>
                  <Input
                    value={editForm.url}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, url: e.target.value }))}
                    className="bg-black/40 border-white/15"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Signing secret</Label>
                  <Input
                    value={editForm.secret}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, secret: e.target.value }))}
                    placeholder="Optional"
                    className="bg-black/40 border-white/15"
                  />
                </div>
              </div>

              <div className="space-y-3">
                <Label>Events</Label>
                <div className="grid gap-2 md:grid-cols-2">
                  {AVAILABLE_EVENTS.map((event) => (
                    <label
                      key={event.id}
                      className="flex items-center gap-2 rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm"
                    >
                      <Checkbox
                        checked={editForm.events.has(event.id)}
                        onCheckedChange={() => toggleEditEvent(event.id)}
                      />
                      <span>{event.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Checkbox
                  checked={editingWebhook.is_active}
                  onCheckedChange={() =>
                    setEditingWebhook((prev) =>
                      prev
                        ? {
                            ...prev,
                            is_active: !prev.is_active,
                          }
                        : prev
                    )
                  }
                />
                <span className="text-sm text-white/70">Active</span>
              </div>
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditingWebhook(null)}>
              Cancel
            </Button>
            <Button onClick={handleUpdate} disabled={updateMutation.isLoading}>
              {updateMutation.isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Save changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
