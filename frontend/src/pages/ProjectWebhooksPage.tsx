import { useMemo, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import {
  ArrowLeft,
  Loader2,
  Plus,
  RefreshCw,
  Trash,
  ShieldCheck,
  Edit,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  useProjectWebhooks,
  useCreateWebhook,
  useUpdateWebhook,
  useDeleteWebhook,
} from "@/hooks/api/useProjectWebhooks";
import { useProject } from "@/hooks/api/useProjects";
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

export function ProjectWebhooksPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();

  if (!projectId) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center space-y-3">
          <p className="text-sm text-muted-foreground">Project not specified.</p>
          <Button variant="outline" onClick={() => navigate(-1)}>
            Go back
          </Button>
        </div>
      </div>
    );
  }

  const { data: project } = useProject(projectId);
  const { data: webhooks, isLoading, refetch } = useProjectWebhooks(projectId);
  const createMutation = useCreateWebhook(projectId);
  const updateMutation = useUpdateWebhook(projectId);
  const deleteMutation = useDeleteWebhook(projectId);

  const [url, setUrl] = useState("");
  const [secret, setSecret] = useState("");
  const [selectedEvents, setSelectedEvents] = useState<Set<string>>(new Set(["node.created", "node.updated"]));
  const [editingWebhook, setEditingWebhook] = useState<Webhook | null>(null);

  const handleToggleEvent = (eventId: string) => {
    setSelectedEvents((prev) => {
      const next = new Set(prev);
      if (next.has(eventId)) {
        next.delete(eventId);
      } else {
        next.add(eventId);
      }
      return next;
    });
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) {
      toast.error("Webhook URL is required");
      return;
    }
    if (selectedEvents.size === 0) {
      toast.error("Select at least one event");
      return;
    }
    await createMutation.mutateAsync({
      url: url.trim(),
      events: Array.from(selectedEvents),
      secret: secret.trim() || undefined,
    });
    setUrl("");
    setSecret("");
    setSelectedEvents(new Set(["node.created", "node.updated"]));
  };

  const openEditDialog = (hook: Webhook) => {
    setEditingWebhook(hook);
  };

  const handleUpdate = async () => {
    if (!editingWebhook) return;
    if (!editingWebhook.url) {
      toast.error("Webhook URL is required");
      return;
    }
    const updateEvents = editingWebhook.events?.length ? editingWebhook.events : [];
    await updateMutation.mutateAsync({
      id: editingWebhook.id,
      data: {
        url: editingWebhook.url,
        events: updateEvents,
        secret: editingWebhook.secret || undefined,
        is_active: editingWebhook.is_active,
      },
    });
    setEditingWebhook(null);
  };

  const toggleEventForEdit = (eventId: string) => {
    if (!editingWebhook) return;
    const current = new Set(editingWebhook.events || []);
    if (current.has(eventId)) {
      current.delete(eventId);
    } else {
      current.add(eventId);
    }
    setEditingWebhook({ ...editingWebhook, events: Array.from(current) });
  };

  const toggleActive = async (hook: Webhook) => {
    await updateMutation.mutateAsync({
      id: hook.id,
      data: { is_active: !hook.is_active },
    });
  };

  const handleDelete = async (hook: Webhook) => {
    await deleteMutation.mutateAsync(hook.id);
  };

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-8 py-12">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="text-left space-y-1">
          <h1 className="text-2xl font-semibold text-white">
            Webhooks {project ? `for ${project.name}` : ""}
          </h1>
          <p className="text-sm text-white/60">
            Receive notifications when activity happens in this project.
          </p>
        </div>
      </div>

      <Card className="border border-white/10 bg-[#101010]">
        <CardHeader>
          <CardTitle className="text-white">Add Webhook</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="webhook-url">Destination URL</Label>
              <Input
                id="webhook-url"
                placeholder="https://example.com/webhooks/pwnflow"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="bg-black/40 border-white/15"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="webhook-secret">Signing Secret (optional)</Label>
              <Input
                id="webhook-secret"
                placeholder="Used to sign webhook payloads"
                value={secret}
                onChange={(e) => setSecret(e.target.value)}
                className="bg-black/40 border-white/15"
              />
            </div>
            <div className="space-y-3">
              <Label>Events</Label>
              <div className="grid gap-2 sm:grid-cols-2">
                {AVAILABLE_EVENTS.map((event) => (
                  <label
                    key={event.id}
                    className="flex items-center gap-2 rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm"
                  >
                    <Checkbox
                      checked={selectedEvents.has(event.id)}
                      onCheckedChange={() => handleToggleEvent(event.id)}
                    />
                    <span>{event.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <Button type="submit" className="w-full" disabled={createMutation.isLoading}>
              {createMutation.isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating
                </>
              ) : (
                <>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Webhook
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">Existing webhooks</h2>
          <Button variant="ghost" size="icon" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>

        {isLoading ? (
          <div className="h-32 flex items-center justify-center text-white/60">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading webhooks
          </div>
        ) : webhooks && webhooks.length > 0 ? (
          <div className="space-y-3">
            {webhooks.map((hook) => (
              <div
                key={hook.id}
                className="flex items-start justify-between rounded-2xl border border-white/10 bg-[#101010] p-4"
              >
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm text-white/80">
                    <span className="font-medium break-all">{hook.url}</span>
                    {!hook.is_active && (
                      <Badge variant="outline" className="border-yellow-500/40 text-yellow-400">
                        Paused
                      </Badge>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {hook.events?.map((evt) => (
                      <Badge key={evt} variant="secondary" className="bg-white/10 text-white/80">
                        {evt}
                      </Badge>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => openEditDialog(hook)}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => toggleActive(hook)}
                    disabled={updateMutation.isLoading}
                  >
                    <ShieldCheck
                      className={`h-4 w-4 ${hook.is_active ? "text-emerald-400" : "text-white/40"}`}
                    />
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
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-white/15 bg-black/40 p-8 text-center text-sm text-white/60">
            No webhooks configured yet.
          </div>
        )}
      </div>

      <Dialog open={!!editingWebhook} onOpenChange={(open) => !open && setEditingWebhook(null)}>
        <DialogContent className="max-w-lg border border-white/10 bg-[#0f0f0f]">
          <DialogHeader>
            <DialogTitle>Edit webhook</DialogTitle>
          </DialogHeader>
          {editingWebhook && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Destination URL</Label>
                <Input
                  value={editingWebhook.url}
                  onChange={(e) =>
                    setEditingWebhook({ ...editingWebhook, url: e.target.value })
                  }
                  className="bg-black/40 border-white/15"
                />
              </div>
              <div className="space-y-2">
                <Label>Events</Label>
                <div className="space-y-2">
                  {AVAILABLE_EVENTS.map((event) => (
                    <label
                      key={event.id}
                      className="flex items-center gap-2 rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm"
                    >
                      <Checkbox
                        checked={editingWebhook.events?.includes(event.id) ?? false}
                        onCheckedChange={() => toggleEventForEdit(event.id)}
                      />
                      <span>{event.label}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <Label>Signing Secret</Label>
                <Input
                  value={editingWebhook.secret ?? ""}
                  onChange={(e) =>
                    setEditingWebhook({ ...editingWebhook, secret: e.target.value })
                  }
                  placeholder="Optional"
                  className="bg-black/40 border-white/15"
                />
              </div>
            </div>
          )}
          <DialogFooter className="flex items-center justify-between">
            <Button variant="ghost" onClick={() => setEditingWebhook(null)}>
              Cancel
            </Button>
            <Button onClick={handleUpdate} disabled={updateMutation.isLoading}>
              {updateMutation.isLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Save changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
