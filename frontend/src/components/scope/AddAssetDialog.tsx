import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Plus, X, Server, Network, FileText } from "lucide-react";
import { useScopeStore, type ServiceStatus } from "@/store/scopeStore";

interface AddAssetDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
}

export function AddAssetDialog({ open, onOpenChange, projectId }: AddAssetDialogProps) {
  const { createAsset } = useScopeStore();

  const [newAsset, setNewAsset] = useState({
    ip: "",
    port: "",
    protocol: "tcp" as "tcp" | "udp",
    hostnames: [] as string[],
    vhosts: [] as string[],
    status: "not_tested" as ServiceStatus,
    notes: "",
  });

  const [newHostname, setNewHostname] = useState("");
  const [newVhost, setNewVhost] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const resetForm = () => {
    setNewAsset({
      ip: "",
      port: "",
      protocol: "tcp",
      hostnames: [],
      vhosts: [],
      status: "not_tested",
      notes: "",
    });
    setNewHostname("");
    setNewVhost("");
  };

  const handleCreate = async () => {
    if (!newAsset.ip || !newAsset.port) {
      return;
    }

    setIsCreating(true);
    try {
      const created = await createAsset(projectId, {
        ip: newAsset.ip,
        port: parseInt(newAsset.port),
        protocol: newAsset.protocol,
        hostnames: newAsset.hostnames,
        vhosts: newAsset.vhosts,
        status: newAsset.status,
        discovered_via: "manual",
        notes: newAsset.notes,
      });

      if (created) {
        resetForm();
        onOpenChange(false);
      } else {
        alert("Failed to create asset. It may already exist.");
      }
    } catch (error) {
      console.error("Failed to create asset:", error);
      alert("Failed to create asset. Please try again.");
    } finally {
      setIsCreating(false);
    }
  };

  const addHostname = () => {
    if (newHostname.trim() && !newAsset.hostnames.includes(newHostname.trim())) {
      setNewAsset({
        ...newAsset,
        hostnames: [...newAsset.hostnames, newHostname.trim()],
      });
      setNewHostname("");
    }
  };

  const removeHostname = (hostname: string) => {
    setNewAsset({
      ...newAsset,
      hostnames: newAsset.hostnames.filter((h) => h !== hostname),
    });
  };

  const addVhost = () => {
    if (newVhost.trim() && !newAsset.vhosts.includes(newVhost.trim())) {
      setNewAsset({
        ...newAsset,
        vhosts: [...newAsset.vhosts, newVhost.trim()],
      });
      setNewVhost("");
    }
  };

  const removeVhost = (vhost: string) => {
    setNewAsset({
      ...newAsset,
      vhosts: newAsset.vhosts.filter((v) => v !== vhost),
    });
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      if (!isOpen) resetForm();
      onOpenChange(isOpen);
    }}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader className="pb-4">
          <DialogTitle className="flex items-center gap-2 text-lg">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
              <Plus className="h-4 w-4 text-primary" />
            </div>
            Add New Service
          </DialogTitle>
          <DialogDescription className="text-xs mt-1">
            Add a new service to your scope
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="service" className="w-full">
          <TabsList className="grid w-full grid-cols-3 h-9">
            <TabsTrigger value="service" className="text-xs gap-1.5">
              <Server className="h-3 w-3" />
              Service
            </TabsTrigger>
            <TabsTrigger value="network" className="text-xs gap-1.5">
              <Network className="h-3 w-3" />
              Network
            </TabsTrigger>
            <TabsTrigger value="notes" className="text-xs gap-1.5">
              <FileText className="h-3 w-3" />
              Notes
            </TabsTrigger>
          </TabsList>

          {/* Service Tab - Required fields */}
          <TabsContent value="service" className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">
                  IP Address <span className="text-destructive">*</span>
                </Label>
                <Input
                  placeholder="10.1.1.100"
                  value={newAsset.ip}
                  onChange={(e) => setNewAsset({ ...newAsset, ip: e.target.value })}
                  className="h-9 font-mono"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">
                  Port <span className="text-destructive">*</span>
                </Label>
                <Input
                  type="number"
                  placeholder="80"
                  value={newAsset.port}
                  onChange={(e) => setNewAsset({ ...newAsset, port: e.target.value })}
                  className="h-9 font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Protocol</Label>
                <Select
                  value={newAsset.protocol}
                  onValueChange={(value) => setNewAsset({ ...newAsset, protocol: value as "tcp" | "udp" })}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="tcp">TCP</SelectItem>
                    <SelectItem value="udp">UDP</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Status</Label>
                <Select
                  value={newAsset.status}
                  onValueChange={(value) => setNewAsset({ ...newAsset, status: value as ServiceStatus })}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="not_tested">Not Tested</SelectItem>
                    <SelectItem value="testing">Testing</SelectItem>
                    <SelectItem value="clean">Clean</SelectItem>
                    <SelectItem value="vulnerable">Vulnerable</SelectItem>
                    <SelectItem value="exploitable">Exploitable</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

          </TabsContent>

          {/* Network Tab - Hostnames & VHosts */}
          <TabsContent value="network" className="space-y-4 mt-4">
            <div className="space-y-3">
              <Label className="text-xs text-muted-foreground uppercase tracking-wide">Hostnames (DNS)</Label>
              <div className="flex flex-wrap gap-2 min-h-[36px] p-2 border rounded-md bg-muted/30">
                {newAsset.hostnames.length ? (
                  newAsset.hostnames.map((hostname) => (
                    <Badge
                      key={hostname}
                      variant="secondary"
                      className="flex items-center gap-1 px-2 py-0.5 text-xs"
                    >
                      {hostname}
                      <button
                        className="ml-1 hover:bg-destructive/20 rounded"
                        onClick={() => removeHostname(hostname)}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))
                ) : (
                  <span className="text-xs text-muted-foreground">No hostnames</span>
                )}
              </div>
              <div className="flex gap-2">
                <Input
                  placeholder="www.example.com"
                  value={newHostname}
                  onChange={(e) => setNewHostname(e.target.value)}
                  onKeyPress={(e) => e.key === "Enter" && (e.preventDefault(), addHostname())}
                  className="h-8 text-sm"
                />
                <Button onClick={addHostname} size="sm" className="h-8" type="button">
                  <Plus className="h-3 w-3" />
                </Button>
              </div>
            </div>

            <div className="space-y-3">
              <Label className="text-xs text-muted-foreground uppercase tracking-wide">Virtual Hosts</Label>
              <div className="flex flex-wrap gap-2 min-h-[36px] p-2 border rounded-md bg-muted/30">
                {newAsset.vhosts.length ? (
                  newAsset.vhosts.map((vhost) => (
                    <Badge
                      key={vhost}
                      className="flex items-center gap-1 px-2 py-0.5 text-xs bg-blue-100 text-blue-800 border-blue-200"
                    >
                      {vhost}
                      <button
                        className="ml-1 hover:bg-destructive/20 rounded"
                        onClick={() => removeVhost(vhost)}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))
                ) : (
                  <span className="text-xs text-muted-foreground">No virtual hosts</span>
                )}
              </div>
              <div className="flex gap-2">
                <Input
                  placeholder="blog.example.com"
                  value={newVhost}
                  onChange={(e) => setNewVhost(e.target.value)}
                  onKeyPress={(e) => e.key === "Enter" && (e.preventDefault(), addVhost())}
                  className="h-8 text-sm"
                />
                <Button onClick={addVhost} size="sm" className="h-8" type="button">
                  <Plus className="h-3 w-3" />
                </Button>
              </div>
            </div>
          </TabsContent>

          {/* Notes Tab */}
          <TabsContent value="notes" className="space-y-4 mt-4">
            <div className="space-y-3">
              <Label className="text-xs text-muted-foreground uppercase tracking-wide">Notes</Label>
              <Textarea
                placeholder="Testing notes, observations..."
                value={newAsset.notes}
                onChange={(e) => setNewAsset({ ...newAsset, notes: e.target.value })}
                rows={6}
                className="text-sm resize-none"
              />
            </div>
          </TabsContent>
        </Tabs>

        <div className="flex justify-end gap-2 pt-4 border-t mt-4">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleCreate}
            disabled={isCreating || !newAsset.ip || !newAsset.port}
          >
            {isCreating ? "Creating..." : "Add Service"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
