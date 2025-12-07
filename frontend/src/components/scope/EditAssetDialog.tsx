import { useState, useEffect } from "react";
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
import { Plus, X, Server, Globe, ArrowLeft, Tag, FileText, Network, CheckCircle2, AlertTriangle, Shield, Bug, CircleDot } from "lucide-react";
import { useScopeStore, type Asset, type ServiceStatus, type Tag as TagType } from "@/store/scopeStore";

interface EditAssetDialogProps {
  asset?: Asset | null;
  hostGroup?: any | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
}

export function EditAssetDialog({ asset, hostGroup, open, onOpenChange, projectId }: EditAssetDialogProps) {
  const { updateAsset: updateAssetApi } = useScopeStore();

  const [currentView, setCurrentView] = useState<"host" | "service" | "service-picker">("service");
  const [editedAsset, setEditedAsset] = useState<Asset | null>(null);
  const [editedHostGroup, setEditedHostGroup] = useState<any | null>(null);
  const [newHostname, setNewHostname] = useState("");
  const [newVhost, setNewVhost] = useState("");
  const [newTag, setNewTag] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    if (asset) {
      setEditedAsset({
        ...asset,
        hostnames: asset.hostnames || [],
        vhosts: asset.vhosts || []
      });
      setCurrentView("service");
      setEditedHostGroup(null);
    } else if (hostGroup) {
      setEditedHostGroup({ ...hostGroup });
      setCurrentView("host");
      setEditedAsset(null);
    } else {
      setEditedAsset(null);
      setEditedHostGroup(null);
    }
  }, [asset, hostGroup, open]);

  const handleSave = async () => {
    setIsUpdating(true);

    if (currentView === "service" && editedAsset) {
      try {
        const updated = await updateAssetApi(projectId, editedAsset.id, {
          protocol: editedAsset.protocol,
          hostnames: editedAsset.hostnames,
          vhosts: editedAsset.vhosts,
          tags: editedAsset.tags,
          status: editedAsset.status,
          discovered_via: editedAsset.discovered_via,
          notes: editedAsset.notes
        });

        if (updated) {
          onOpenChange(false);
        } else {
          alert('Failed to update asset. Please try again.');
        }
      } catch (error) {
        console.error('Failed to update asset:', error);
        alert('Failed to update asset. Please try again.');
      } finally {
        setIsUpdating(false);
      }
    } else if (currentView === "host" && editedHostGroup) {
      try {
        const updatePromises = editedHostGroup.services.map((service: Asset) => {
          const updateData: any = {
            hostnames: editedHostGroup.hostnames
          };
          // Include bulk status if set
          if (editedHostGroup.bulkStatus) {
            updateData.status = editedHostGroup.bulkStatus;
          }
          return updateAssetApi(projectId, service.id, updateData);
        });

        const results = await Promise.all(updatePromises);
        const successCount = results.filter(result => result !== null).length;

        if (successCount > 0) {
          onOpenChange(false);
        } else {
          alert('Failed to update host services. Please try again.');
        }
      } catch (error) {
        console.error('Failed to update host services:', error);
        alert('Failed to update host services. Please try again.');
      } finally {
        setIsUpdating(false);
      }
    }
  };

  // Service-specific handlers
  const addVhost = () => {
    if (newVhost.trim() && editedAsset && !editedAsset.vhosts?.includes(newVhost.trim())) {
      setEditedAsset({
        ...editedAsset,
        vhosts: [...(editedAsset.vhosts || []), newVhost.trim()]
      });
      setNewVhost("");
    }
  };

  const removeVhost = (vhostToRemove: string) => {
    if (editedAsset) {
      setEditedAsset({
        ...editedAsset,
        vhosts: editedAsset.vhosts?.filter(v => v !== vhostToRemove) || []
      });
    }
  };

  const addServiceHostname = () => {
    if (newHostname.trim() && editedAsset && !editedAsset.hostnames?.includes(newHostname.trim())) {
      setEditedAsset({
        ...editedAsset,
        hostnames: [...(editedAsset.hostnames || []), newHostname.trim()]
      });
      setNewHostname("");
    }
  };

  const removeServiceHostname = (hostnameToRemove: string) => {
    if (editedAsset) {
      setEditedAsset({
        ...editedAsset,
        hostnames: editedAsset.hostnames?.filter(h => h !== hostnameToRemove) || []
      });
    }
  };

  const addHostname = () => {
    if (newHostname.trim() && editedHostGroup && !editedHostGroup.hostnames.includes(newHostname.trim())) {
      setEditedHostGroup({
        ...editedHostGroup,
        hostnames: [...editedHostGroup.hostnames, newHostname.trim()]
      });
      setNewHostname("");
    }
  };

  const removeHostname = (hostnameToRemove: string) => {
    if (editedHostGroup) {
      setEditedHostGroup({
        ...editedHostGroup,
        hostnames: editedHostGroup.hostnames.filter((h: string) => h !== hostnameToRemove)
      });
    }
  };

  const addTag = () => {
    if (newTag.trim() && editedAsset && !editedAsset.tags.some(t => t.name === newTag.trim())) {
      const newTagObj = {
        id: `tag_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        name: newTag.trim(),
        color: 'bg-gray-500',
        is_predefined: false
      };
      setEditedAsset({
        ...editedAsset,
        tags: [...editedAsset.tags, newTagObj]
      });
      setNewTag("");
    }
  };

  const removeTag = (tagId: string) => {
    if (editedAsset) {
      setEditedAsset({
        ...editedAsset,
        tags: editedAsset.tags.filter(t => t.id !== tagId)
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px]">
        {(asset || hostGroup) ? (
          <>
            <DialogHeader className="pb-4">
              <DialogTitle className="flex items-center gap-2 text-lg">
                {currentView === "service" && editedHostGroup && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 -ml-1"
                    onClick={() => setCurrentView("host")}
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </Button>
                )}
                {editedAsset ? (
                  <>
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                      <Server className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <span className="font-mono">{editedAsset.ip}:{editedAsset.port}</span>
                      <span className="text-muted-foreground font-normal ml-2">/ {editedAsset.protocol}</span>
                    </div>
                  </>
                ) : editedHostGroup ? (
                  <>
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/10">
                      <Globe className="h-4 w-4 text-blue-500" />
                    </div>
                    <span className="font-mono">{editedHostGroup.ip}</span>
                  </>
                ) : 'Edit Asset'}
              </DialogTitle>
              {editedAsset && (
                <DialogDescription className="text-xs mt-1">
                  Modify service configuration, network settings, and metadata
                </DialogDescription>
              )}
            </DialogHeader>

            {/* Host Edit Interface */}
            {currentView === "host" && editedHostGroup && (
              <div className="space-y-4">
                <div className="space-y-3">
                  <Label className="text-xs text-muted-foreground uppercase tracking-wide">IP Address</Label>
                  <Input value={editedHostGroup?.ip || ''} disabled className="bg-muted font-mono" />
                </div>

                {/* Bulk Status Update */}
                <div className="space-y-3">
                  <Label className="text-xs text-muted-foreground uppercase tracking-wide">
                    Set All Services Status
                  </Label>
                  <div className="grid grid-cols-5 gap-1.5">
                    {[
                      { value: "not_tested", label: "Not Tested", icon: CircleDot, color: "text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800" },
                      { value: "testing", label: "Testing", icon: AlertTriangle, color: "text-yellow-500 hover:bg-yellow-50 dark:hover:bg-yellow-950" },
                      { value: "clean", label: "Clean", icon: CheckCircle2, color: "text-green-500 hover:bg-green-50 dark:hover:bg-green-950" },
                      { value: "vulnerable", label: "Vulnerable", icon: Shield, color: "text-orange-500 hover:bg-orange-50 dark:hover:bg-orange-950" },
                      { value: "exploitable", label: "Exploitable", icon: Bug, color: "text-red-500 hover:bg-red-50 dark:hover:bg-red-950" },
                    ].map(({ value, label, icon: Icon, color }) => (
                      <Button
                        key={value}
                        variant="outline"
                        size="sm"
                        className={`relative h-auto py-2 px-2 flex flex-col items-center gap-1 ${color} ${editedHostGroup.bulkStatus === value ? 'ring-2 ring-primary ring-offset-1' : ''}`}
                        onClick={() => {
                          setEditedHostGroup({
                            ...editedHostGroup,
                            bulkStatus: value as ServiceStatus
                          });
                        }}
                        disabled={isUpdating}
                      >
                        <Icon className={`h-4 w-4 ${editedHostGroup.bulkStatus === value ? 'opacity-100' : 'opacity-60'}`} />
                        <span className={`text-[10px] ${editedHostGroup.bulkStatus === value ? 'font-medium' : 'font-normal opacity-70'}`}>
                          {label.split(' ')[0]}
                        </span>
                      </Button>
                    ))}
                  </div>
                  {editedHostGroup.bulkStatus && (
                    <p className="text-xs text-muted-foreground">
                      Will set all {editedHostGroup.services?.length || 0} services to "{editedHostGroup.bulkStatus.replace('_', ' ')}"
                    </p>
                  )}
                </div>

                <div className="space-y-3">
                  <Label className="text-xs text-muted-foreground uppercase tracking-wide">Hostnames</Label>
                  <div className="flex flex-wrap gap-2 min-h-[36px] p-2 border rounded-md bg-muted/30">
                    {editedHostGroup?.hostnames?.length ? (
                      editedHostGroup.hostnames.map((hostname: string) => (
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
                      placeholder="Add hostname..."
                      value={newHostname}
                      onChange={(e) => setNewHostname(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && addHostname()}
                      className="h-8 text-sm"
                    />
                    <Button onClick={addHostname} size="sm" className="h-8">
                      <Plus className="h-3 w-3" />
                    </Button>
                  </div>
                </div>

                <div className="space-y-3">
                  <Label className="text-xs text-muted-foreground uppercase tracking-wide">
                    Services ({editedHostGroup?.services?.length || 0})
                  </Label>
                  <div className="flex flex-wrap gap-1.5">
                    {editedHostGroup?.services?.map((service: any) => (
                      <Badge
                        key={service.id}
                        variant="outline"
                        className="text-xs font-mono cursor-pointer hover:bg-muted"
                        onClick={() => {
                          setEditedAsset({
                            ...service,
                            hostnames: service.hostnames || [],
                            vhosts: service.vhosts || []
                          });
                          setCurrentView("service");
                        }}
                      >
                        {service.port}/{service.protocol}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Service Edit Interface with Tabs */}
            {currentView === "service" && editedAsset && (
              <Tabs defaultValue="details" className="w-full">
                <TabsList className="grid w-full grid-cols-4 h-9">
                  <TabsTrigger value="details" className="text-xs gap-1.5">
                    <Server className="h-3 w-3" />
                    Details
                  </TabsTrigger>
                  <TabsTrigger value="network" className="text-xs gap-1.5">
                    <Network className="h-3 w-3" />
                    Network
                  </TabsTrigger>
                  <TabsTrigger value="tags" className="text-xs gap-1.5">
                    <Tag className="h-3 w-3" />
                    Tags
                  </TabsTrigger>
                  <TabsTrigger value="notes" className="text-xs gap-1.5">
                    <FileText className="h-3 w-3" />
                    Notes
                  </TabsTrigger>
                </TabsList>

                {/* Details Tab */}
                <TabsContent value="details" className="space-y-4 mt-4">
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Status</Label>
                    <div className="grid grid-cols-5 gap-1.5">
                      {[
                        { value: "not_tested", label: "Not Tested", icon: CircleDot, color: "text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800" },
                        { value: "testing", label: "Testing", icon: AlertTriangle, color: "text-yellow-500 hover:bg-yellow-50 dark:hover:bg-yellow-950" },
                        { value: "clean", label: "Clean", icon: CheckCircle2, color: "text-green-500 hover:bg-green-50 dark:hover:bg-green-950" },
                        { value: "vulnerable", label: "Vulnerable", icon: Shield, color: "text-orange-500 hover:bg-orange-50 dark:hover:bg-orange-950" },
                        { value: "exploitable", label: "Exploitable", icon: Bug, color: "text-red-500 hover:bg-red-50 dark:hover:bg-red-950" },
                      ].map(({ value, label, icon: Icon, color }) => (
                        <Button
                          key={value}
                          variant="outline"
                          size="sm"
                          className={`relative h-auto py-2 px-2 flex flex-col items-center gap-1 ${color} ${editedAsset?.status === value ? 'ring-2 ring-primary ring-offset-1' : ''}`}
                          onClick={() => editedAsset && setEditedAsset({...editedAsset, status: value as ServiceStatus})}
                          disabled={isUpdating}
                        >
                          <Icon className={`h-4 w-4 ${editedAsset?.status === value ? 'opacity-100' : 'opacity-60'}`} />
                          <span className={`text-[10px] ${editedAsset?.status === value ? 'font-medium' : 'font-normal opacity-70'}`}>
                            {label.split(' ')[0]}
                          </span>
                        </Button>
                      ))}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">Protocol</Label>
                      <Select
                        value={editedAsset?.protocol || "tcp"}
                        onValueChange={(value) => editedAsset && setEditedAsset({...editedAsset, protocol: value as "tcp" | "udp"})}
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
                      <Label className="text-xs text-muted-foreground">Discovery</Label>
                      <Select
                        value={editedAsset?.discovered_via || "manual"}
                        onValueChange={(value) => editedAsset && setEditedAsset({...editedAsset, discovered_via: value as any})}
                      >
                        <SelectTrigger className="h-9">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="manual">Manual</SelectItem>
                          <SelectItem value="nmap">Nmap</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </TabsContent>

                {/* Network Tab (Hostnames + VHosts) */}
                <TabsContent value="network" className="space-y-4 mt-4">
                  <div className="space-y-3">
                    <Label className="text-xs text-muted-foreground uppercase tracking-wide">Hostnames (DNS)</Label>
                    <div className="flex flex-wrap gap-2 min-h-[36px] p-2 border rounded-md bg-muted/30">
                      {editedAsset?.hostnames?.length ? (
                        editedAsset.hostnames.map((hostname) => (
                          <Badge
                            key={hostname}
                            variant="secondary"
                            className="flex items-center gap-1 px-2 py-0.5 text-xs"
                          >
                            {hostname}
                            <button
                              className="ml-1 hover:bg-destructive/20 rounded"
                              onClick={() => removeServiceHostname(hostname)}
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
                        placeholder="Add hostname..."
                        value={newHostname}
                        onChange={(e) => setNewHostname(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && addServiceHostname()}
                        className="h-8 text-sm"
                      />
                      <Button onClick={addServiceHostname} size="sm" className="h-8">
                        <Plus className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <Label className="text-xs text-muted-foreground uppercase tracking-wide">Virtual Hosts</Label>
                    <div className="flex flex-wrap gap-2 min-h-[36px] p-2 border rounded-md bg-muted/30">
                      {editedAsset?.vhosts?.length ? (
                        editedAsset.vhosts.map((vhost) => (
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
                        placeholder="Add virtual host..."
                        value={newVhost}
                        onChange={(e) => setNewVhost(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && addVhost()}
                        className="h-8 text-sm"
                      />
                      <Button onClick={addVhost} size="sm" className="h-8">
                        <Plus className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </TabsContent>

                {/* Tags Tab */}
                <TabsContent value="tags" className="space-y-4 mt-4">
                  <div className="space-y-3">
                    <Label className="text-xs text-muted-foreground uppercase tracking-wide">Tags</Label>
                    <div className="flex flex-wrap gap-2 min-h-[60px] p-3 border rounded-md bg-muted/30">
                      {editedAsset?.tags?.length ? (
                        editedAsset.tags.map((tag) => (
                          <Badge
                            key={tag.id}
                            className={`flex items-center gap-1 px-2 py-1 text-xs ${tag.color} text-white border-0`}
                          >
                            {tag.name}
                            <button
                              className="ml-1 hover:bg-black/20 rounded"
                              onClick={() => removeTag(tag.id)}
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </Badge>
                        ))
                      ) : (
                        <span className="text-xs text-muted-foreground">No tags added</span>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Input
                        placeholder="Add tag..."
                        value={newTag}
                        onChange={(e) => setNewTag(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && addTag()}
                        className="h-8 text-sm"
                      />
                      <Button onClick={addTag} size="sm" className="h-8">
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
                      placeholder="Testing notes, findings, observations..."
                      value={editedAsset?.notes || ""}
                      onChange={(e) => editedAsset && setEditedAsset({...editedAsset, notes: e.target.value})}
                      rows={6}
                      className="text-sm resize-none"
                    />
                  </div>
                </TabsContent>
              </Tabs>
            )}

            {/* Service Picker Interface */}
            {currentView === "service-picker" && editedHostGroup && (
              <div className="space-y-3">
                <Label className="text-xs text-muted-foreground uppercase tracking-wide">
                  Select a service to edit
                </Label>
                <div className="grid gap-2 max-h-[300px] overflow-y-auto">
                  {editedHostGroup?.services?.map((service: any) => (
                    <div
                      key={service.id}
                      className="p-3 border rounded-md hover:bg-muted/40 cursor-pointer transition-colors"
                      onClick={() => {
                        setEditedAsset({
                          ...service,
                          hostnames: service.hostnames || [],
                          vhosts: service.vhosts || []
                        });
                        setCurrentView("service");
                      }}
                    >
                      <div className="flex items-center justify-between">
                        <Badge variant="outline" className="text-xs font-mono">
                          {service.port}/{service.protocol}
                        </Badge>
                        <Badge
                          variant={service.status === 'clean' ? 'default' : service.status === 'vulnerable' ? 'destructive' : 'secondary'}
                          className="text-xs"
                        >
                          {service.status.replace('_', ' ')}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-4 border-t mt-4">
              <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleSave}
                disabled={isUpdating || (currentView === "service" ? (!editedAsset?.ip || !editedAsset?.port) : false)}
              >
                {isUpdating ? 'Saving...' : 'Save'}
              </Button>
            </div>
          </>
        ) : (
          <div className="p-6 text-center">
            <p className="text-muted-foreground">Loading...</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
