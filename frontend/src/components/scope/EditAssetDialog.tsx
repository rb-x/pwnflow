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
import { Plus, X, Server, Globe, ArrowLeft } from "lucide-react";
import { useScopeStore, type Asset, type ServiceStatus, type Tag } from "@/store/scopeStore";

interface EditAssetDialogProps {
  asset?: Asset | null;
  hostGroup?: any | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
}

export function EditAssetDialog({ asset, hostGroup, open, onOpenChange, projectId }: EditAssetDialogProps) {
  const { updateAssetStatus, updateAsset: updateAssetApi, addTagToAsset, removeTagFromAsset, createCustomTag, predefinedTags } = useScopeStore();
  
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
    console.log('Save button clicked! Current view:', currentView, 'Edited asset exists:', !!editedAsset);
    setIsUpdating(true);
    
    if (currentView === "service" && editedAsset) {
      try {
        console.log('Updating asset with data:', {
          protocol: editedAsset.protocol,
          hostnames: editedAsset.hostnames,
          vhosts: editedAsset.vhosts,
          tags: editedAsset.tags,
          status: editedAsset.status,
          discovered_via: editedAsset.discovered_via,
          notes: editedAsset.notes
        });
        
        console.log('Making API call to update asset ID:', editedAsset.id, 'in project:', projectId);
        
        // Update the asset via API
        const updated = await updateAssetApi(projectId, editedAsset.id, {
          protocol: editedAsset.protocol,
          hostnames: editedAsset.hostnames,
          vhosts: editedAsset.vhosts,
          tags: editedAsset.tags,
          status: editedAsset.status,
          discovered_via: editedAsset.discovered_via,
          notes: editedAsset.notes
        });

        console.log('Update response:', updated);

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
        console.log('Updating host:', editedHostGroup.ip, 'with hostnames:', editedHostGroup.hostnames);
        
        // Update all services on this host with the new hostnames
        const updatePromises = editedHostGroup.services.map((service: Asset) => 
          updateAssetApi(projectId, service.id, {
            hostnames: editedHostGroup.hostnames
          })
        );
        
        const results = await Promise.all(updatePromises);
        const successCount = results.filter(result => result !== null).length;
        
        console.log(`Updated ${successCount} out of ${editedHostGroup.services.length} services`);
        
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

  // Service hostname management
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

  // Host-specific handlers
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        {(asset || hostGroup) ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {currentView === "service" && editedHostGroup && (
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-6 w-6 p-0"
                    onClick={() => setCurrentView("host")}
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </Button>
                )}
                {editedAsset ? (
                  <>
                    <Server className="h-5 w-5" />
                    Edit Service: {editedAsset.ip}:{editedAsset.port}
                  </>
                ) : editedHostGroup ? (
                  <>
                    <Globe className="h-5 w-5" />
                    Edit Host: {editedHostGroup.ip}
                  </>
                ) : 'Edit Asset'}
              </DialogTitle>
              <DialogDescription>
                {editedAsset 
                  ? 'Modify service details, virtual hosts, and testing metadata'
                  : editedHostGroup 
                    ? 'Modify host-level information and hostnames'
                    : 'Loading...'
                }
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-6 mt-6">
              {/* Host Edit Interface */}
              {currentView === "host" && editedHostGroup && (
                <>
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 pb-2 border-b">
                      <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                      <h4 className="text-sm font-semibold">Host Information</h4>
                    </div>
                    <div className="space-y-2">
                      <Label>IP Address (Read Only)</Label>
                      <Input value={editedHostGroup?.ip || ''} disabled className="bg-muted" />
                      <p className="text-xs text-muted-foreground">
                        IP address cannot be changed. Create a new host instead.
                      </p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center gap-2 pb-2 border-b">
                      <div className="w-2 h-2 rounded-full bg-green-500"></div>
                      <h4 className="text-sm font-semibold">Hostnames (DNS Resolution)</h4>
                    </div>
                    
                    <div className="space-y-2">
                      <Label>Current Hostnames</Label>
                      <div className="flex flex-wrap gap-2 min-h-[40px] p-2 border rounded-md">
                        {editedHostGroup?.hostnames?.length ? (
                          editedHostGroup.hostnames.map((hostname: string) => (
                            <Badge
                              key={hostname}
                              variant="secondary"
                              className="flex items-center gap-1 px-2 py-1"
                            >
                              <span className="text-xs">{hostname}</span>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-4 w-4 p-0 hover:bg-red-100"
                                onClick={() => removeHostname(hostname)}
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            </Badge>
                          ))
                        ) : (
                          <span className="text-sm text-muted-foreground">No hostnames added</span>
                        )}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Add Hostname</Label>
                      <div className="flex gap-2">
                        <Input
                          placeholder="www.example.com"
                          value={newHostname}
                          onChange={(e) => setNewHostname(e.target.value)}
                          onKeyPress={(e) => e.key === 'Enter' && addHostname()}
                        />
                        <Button onClick={addHostname} size="sm">
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between pb-2 border-b">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-purple-500"></div>
                        <h4 className="text-sm font-semibold">Services on this Host</h4>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentView("service-picker")}
                      >
                        Edit Services
                      </Button>
                    </div>
                    <div className="p-3 bg-muted rounded-md">
                      <div className="flex flex-wrap gap-2">
                        {editedHostGroup?.services?.map((service: any) => (
                          <Badge key={service.id} variant="outline" className="text-xs">
                            {service.port}/{service.protocol}
                          </Badge>
                        ))}
                      </div>
                      <p className="text-xs text-muted-foreground mt-2">
                        Click "Edit Services" to modify individual services
                      </p>
                    </div>
                  </div>
                </>
              )}

              {/* Service Edit Interface */}
              {currentView === "service" && editedAsset && (
                <>
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 pb-2 border-b">
                      <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                      <h4 className="text-sm font-semibold">Service Information</h4>
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label>IP Address (Read Only)</Label>
                        <Input value={editedAsset?.ip || ''} disabled className="bg-muted" />
                      </div>
                      <div className="space-y-2">
                        <Label>Port (Read Only)</Label>
                        <Input value={editedAsset?.port?.toString() || ''} disabled className="bg-muted" />
                      </div>
                      <div className="space-y-2">
                        <Label>Protocol</Label>
                        <Select 
                          value={editedAsset?.protocol || "tcp"} 
                          onValueChange={(value) => editedAsset && setEditedAsset({...editedAsset, protocol: value as "tcp" | "udp"})}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="tcp">TCP</SelectItem>
                            <SelectItem value="udp">UDP</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>

                  {/* Hostname Section for Services */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 pb-2 border-b">
                      <div className="w-2 h-2 rounded-full bg-green-500"></div>
                      <h4 className="text-sm font-semibold">Hostnames (DNS Resolution)</h4>
                    </div>
                    
                    <div className="space-y-2">
                      <Label>Current Hostnames</Label>
                      <div className="flex flex-wrap gap-2 min-h-[40px] p-2 border rounded-md">
                        {editedAsset?.hostnames?.length ? (
                          editedAsset.hostnames.map((hostname) => (
                            <Badge
                              key={hostname}
                              variant="secondary"
                              className="flex items-center gap-1 px-2 py-1"
                            >
                              <span className="text-xs">{hostname}</span>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-4 w-4 p-0 hover:bg-red-100"
                                onClick={() => removeServiceHostname(hostname)}
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            </Badge>
                          ))
                        ) : (
                          <span className="text-sm text-muted-foreground">No hostnames added</span>
                        )}
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <Label>Add Hostname</Label>
                      <div className="flex gap-2">
                        <Input
                          placeholder="www.example.com"
                          value={newHostname}
                          onChange={(e) => setNewHostname(e.target.value)}
                          onKeyPress={(e) => e.key === 'Enter' && addServiceHostname()}
                        />
                        <Button onClick={addServiceHostname} size="sm">
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center gap-2 pb-2 border-b">
                      <div className="w-2 h-2 rounded-full bg-purple-500"></div>
                      <h4 className="text-sm font-semibold">Virtual Hosts</h4>
                    </div>
                    
                    <div className="space-y-2">
                      <Label>Current Virtual Hosts</Label>
                      <div className="flex flex-wrap gap-2 min-h-[40px] p-2 border rounded-md">
                        {editedAsset?.vhosts?.length ? (
                          editedAsset.vhosts.map((vhost) => (
                            <Badge
                              key={vhost}
                              className="flex items-center gap-1 px-2 py-1 text-xs bg-blue-100 text-blue-800 border-blue-200"
                            >
                              <span className="text-xs">{vhost}</span>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-4 w-4 p-0 hover:bg-red-100"
                                onClick={() => removeVhost(vhost)}
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            </Badge>
                          ))
                        ) : (
                          <span className="text-sm text-muted-foreground">No virtual hosts added</span>
                        )}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Add Virtual Host</Label>
                      <div className="flex gap-2">
                        <Input
                          placeholder="blog.example.com"
                          value={newVhost}
                          onChange={(e) => setNewVhost(e.target.value)}
                          onKeyPress={(e) => e.key === 'Enter' && addVhost()}
                        />
                        <Button onClick={addVhost} size="sm">
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center gap-2 pb-2 border-b">
                      <div className="w-2 h-2 rounded-full bg-orange-500"></div>
                      <h4 className="text-sm font-semibold">Testing Details</h4>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Status</Label>
                        <Select 
                          value={editedAsset?.status || "not_tested"} 
                          onValueChange={(value) => editedAsset && setEditedAsset({...editedAsset, status: value as ServiceStatus})}
                        >
                          <SelectTrigger>
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
                      <div className="space-y-2">
                        <Label>Discovery Method</Label>
                        <Select 
                          value={editedAsset?.discovered_via || "manual"} 
                          onValueChange={(value) => editedAsset && setEditedAsset({...editedAsset, discovered_via: value as any})}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="manual">Manual Entry</SelectItem>
                            <SelectItem value="nmap">Nmap Scan</SelectItem>
                            <SelectItem value="ssl-cert">SSL Certificate</SelectItem>
                            <SelectItem value="http-vhosts">HTTP VHosts</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Tags</Label>
                      <div className="space-y-2">
                        <div className="flex flex-wrap gap-2 min-h-[40px] p-2 border rounded-md">
                          {editedAsset?.tags?.length ? (
                            editedAsset.tags.map((tag) => (
                              <Badge
                                key={tag.id}
                                className={`flex items-center gap-1 px-2 py-1 text-xs ${tag.color} text-white border-0`}
                              >
                                <span>{tag.name}</span>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-4 w-4 p-0 hover:bg-black/20"
                                  onClick={() => {
                                    if (editedAsset) {
                                      setEditedAsset({
                                        ...editedAsset,
                                        tags: editedAsset.tags.filter(t => t.id !== tag.id)
                                      });
                                    }
                                  }}
                                >
                                  <X className="h-3 w-3" />
                                </Button>
                              </Badge>
                            ))
                          ) : (
                            <span className="text-sm text-muted-foreground">No tags added</span>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <Input
                            placeholder="Add tag..."
                            value={newTag}
                            onChange={(e) => setNewTag(e.target.value)}
                            onKeyPress={(e) => {
                              if (e.key === 'Enter') {
                                if (newTag.trim() && editedAsset && !editedAsset.tags.some(t => t.name === newTag.trim())) {
                                  const newTagObj = {
                                    id: `tag_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                                    name: newTag.trim(),
                                    color: 'bg-gray-500', // Default color
                                    is_predefined: false
                                  };
                                  setEditedAsset({
                                    ...editedAsset,
                                    tags: [...editedAsset.tags, newTagObj]
                                  });
                                  setNewTag("");
                                }
                              }
                            }}
                          />
                          <Button 
                            onClick={() => {
                              if (newTag.trim() && editedAsset && !editedAsset.tags.some(t => t.name === newTag.trim())) {
                                const newTagObj = {
                                  id: `tag_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                                  name: newTag.trim(),
                                  color: 'bg-gray-500', // Default color
                                  is_predefined: false
                                };
                                setEditedAsset({
                                  ...editedAsset,
                                  tags: [...editedAsset.tags, newTagObj]
                                });
                                setNewTag("");
                              }
                            }}
                            size="sm"
                          >
                            <Plus className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Notes</Label>
                      <Textarea
                        placeholder="Testing notes, findings, etc..."
                        value={editedAsset?.notes || ""}
                        onChange={(e) => editedAsset && setEditedAsset({...editedAsset, notes: e.target.value})}
                        rows={3}
                      />
                    </div>
                  </div>
                </>
              )}

              {/* Service Picker Interface */}
              {currentView === "service-picker" && editedHostGroup && (
                <>
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 pb-2 border-b">
                      <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                      <h4 className="text-sm font-semibold">Services on {editedHostGroup.ip}</h4>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Select a service below to edit its details.
                    </p>
                    <div className="grid gap-2">
                      {editedHostGroup?.services?.map((service: any) => (
                        <div 
                          key={service.id}
                          className="p-3 border rounded-md hover:bg-muted/40 cursor-pointer"
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
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-xs">
                                {service.port}/{service.protocol}
                              </Badge>
                              <span className="text-sm font-medium">{service.port}/{service.protocol}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge variant={service.status === 'clean' ? 'default' : service.status === 'vulnerable' ? 'destructive' : 'secondary'} className="text-xs">
                                {service.status}
                              </Badge>
                              <span className="text-xs text-muted-foreground">Click to edit</span>
                            </div>
                          </div>
                          {service.vhosts && service.vhosts.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-2">
                              {service.vhosts.map((vhost: string) => (
                                <Badge key={vhost} variant="outline" className="text-xs bg-purple-50 border-purple-200">
                                  {vhost}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
            
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button 
                onClick={() => {
                  console.log('Save button clicked - Asset:', { ip: editedAsset?.ip, port: editedAsset?.port, id: editedAsset?.id });
                  handleSave();
                }}
                disabled={isUpdating || (currentView === "service" ? (!editedAsset?.ip || !editedAsset?.port) : false)}
                title={currentView === "service" && (!editedAsset?.ip || !editedAsset?.port) ? 
                  `Button disabled - Missing: ${!editedAsset?.ip ? 'IP' : ''} ${!editedAsset?.port ? 'Port' : ''}` : 
                  'Save changes to this asset'
                }
              >
                {isUpdating ? 'Saving...' : 'Save Changes'}
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