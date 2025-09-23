import React, { useState, useMemo, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuCheckboxItem,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Search,
  Filter,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Plus,
  Upload,
  CheckCircle,
  Clock,
  Circle,
  ChevronDown,
  ChevronRight,
  Server,
  Trash2,
} from "lucide-react";
import { useScopeStore, type Asset, type Tag, type ServiceStatus } from "@/store/scopeStore";
import { EditAssetDialog } from "./EditAssetDialog";
import { ImportNmapDialog } from "./ImportNmapDialog";

interface ScopeTableProps {
  projectId: string;
}

type SortField = "status" | "target" | "port" | "protocol" | "vhost" | "tags" | "discoveredVia";
type SortDirection = "asc" | "desc";

export function ScopeTable({ projectId }: ScopeTableProps) {
  const { 
    assets, 
    loading, 
    error, 
    fetchAssets, 
    createAsset, 
    updateAsset: updateAssetApi, 
    deleteAsset,
    addTagToAsset, 
    removeTagFromAsset, 
    createCustomTag, 
    predefinedTags,
    importNmapXml,
    updateAssetStatus  // Legacy method for backwards compatibility
  } = useScopeStore();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<ServiceStatus | "all">("all");
  const [sortField, setSortField] = useState<SortField>("target");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [expandedHosts, setExpandedHosts] = useState<Set<string>>(new Set());
  const [addAssetDialogOpen, setAddAssetDialogOpen] = useState(false);
  const [editAssetDialogOpen, setEditAssetDialogOpen] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [selectedHost, setSelectedHost] = useState<any | null>(null);
  const [hoveredAssetId, setHoveredAssetId] = useState<string | null>(null);
  const [newAsset, setNewAsset] = useState({
    hostnames: [] as string[],
    ip: "",
    port: "",
    protocol: "tcp" as "tcp" | "udp",
    vhosts: [] as string[],
    notes: "",
    status: "not_tested" as ServiceStatus,
    discoveredVia: "manual" as "nmap" | "ssl-cert" | "http-vhosts" | "manual"
  });
  const [newHostname, setNewHostname] = useState("");
  const [newVhost, setNewVhost] = useState("");
  const [importNmapDialogOpen, setImportNmapDialogOpen] = useState(false);
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);

  // Fetch assets when component loads or projectId changes
  useEffect(() => {
    if (projectId) {
      fetchAssets(projectId);
    }
  }, [projectId, fetchAssets]);

  // Helper to extract domain from hostname
  const extractDomain = (hostname: string): string => {
    const parts = hostname.split('.');
    return parts.length > 2 ? parts.slice(-2).join('.') : hostname;
  };

  // Helper to get connected asset IDs - services on same IP
  const getConnectedAssetIds = (asset: Asset): string[] => {
    const connectedIds = new Set<string>([asset.id]);
    
    // Include other services on the same IP
    assets.forEach(otherAsset => {
      if (otherAsset.ip === asset.ip && otherAsset.id !== asset.id) {
        connectedIds.add(otherAsset.id);
      }
    });
    
    return Array.from(connectedIds);
  };

  // Helper to get relationship info for tooltip
  const getRelationshipInfo = (asset: Asset): string => {
    const connections = getConnectedAssetIds(asset);
    if (connections.length <= 1) return "";
    
    const otherAssets = connections.filter(id => id !== asset.id)
      .map(id => assets.find(a => a.id === id))
      .filter(Boolean) as Asset[];
    
    const services = otherAssets.filter(a => a.ip && a.port);
    return services.length ? `Same IP: ${services.map(a => `${a.port}/${a.protocol}`).join(", ")}` : "";
  };

  // Helper to check if an asset should be highlighted
  const shouldHighlightAsset = (asset: Asset): boolean => {
    if (!hoveredAssetId) return false;
    
    const hoveredAsset = assets.find(a => a.id === hoveredAssetId);
    if (!hoveredAsset) return false;
    
    const connectedIds = getConnectedAssetIds(hoveredAsset);
    return connectedIds.includes(asset.id);
  };

  const getStatusIcon = (status: ServiceStatus) => {
    switch (status) {
      case "clean":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "testing":
        return <Clock className="h-4 w-4 text-yellow-500" />;
      case "vulnerable":
        return <Circle className="h-4 w-4 text-red-800 fill-red-800" />;
      case "exploitable":
        return <Circle className="h-4 w-4 text-white fill-black" />;
      case "not_tested":
        return <Circle className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusBadge = (status: ServiceStatus) => {
    const labels = {
      clean: "Clean",
      testing: "Testing",
      vulnerable: "Vulnerable", 
      exploitable: "Exploitable",
      not_tested: "Not Tested",
    };

    const customClasses = {
      clean: "bg-green-100 text-green-700 hover:bg-green-100/80 border-green-200",
      vulnerable: "bg-red-800 text-red-100 hover:bg-red-800/80 border-red-800",
      exploitable: "bg-black text-white hover:bg-black/80 border-black",
      testing: "bg-yellow-100 text-yellow-700 hover:bg-yellow-100/80 border-yellow-200",
      not_tested: "bg-gray-100 text-gray-700 hover:bg-gray-100/80 border-gray-200"
    };

    return (
      <Badge 
        className={`${customClasses[status as keyof typeof customClasses] || ""} border`}
      >
        {labels[status]}
      </Badge>
    );
  };

  const handleStatusChange = async (id: string, newStatus: ServiceStatus) => {
    await updateAssetApi(projectId, id, { status: newStatus });
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <ArrowUpDown className="h-4 w-4" />;
    }
    return sortDirection === "asc" ? 
      <ArrowUp className="h-4 w-4" /> : 
      <ArrowDown className="h-4 w-4" />;
  };

  const filteredAndSortedData = useMemo(() => {
    let filtered = assets.filter(asset => {
      const hostnames = (asset.hostnames && asset.hostnames.length > 0) ? asset.hostnames.join(", ") : "";
      const ip = asset.ip || "";
      const port = asset.port?.toString() || "";
      const protocol = asset.protocol || "";
      const vhosts = (asset.vhosts && asset.vhosts.length > 0) ? asset.vhosts.join(", ") : "";
      const tags = asset.tags.map(tag => tag.name).join(" ");
      const notes = asset.notes || "";
      
      const matchesSearch = 
        hostnames.toLowerCase().includes(searchQuery.toLowerCase()) ||
        ip.toLowerCase().includes(searchQuery.toLowerCase()) ||
        port.includes(searchQuery) ||
        protocol.toLowerCase().includes(searchQuery.toLowerCase()) ||
        vhosts.toLowerCase().includes(searchQuery.toLowerCase()) ||
        tags.toLowerCase().includes(searchQuery.toLowerCase()) ||
        notes.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesStatus = statusFilter === "all" || asset.status === statusFilter;
      
      return matchesSearch && matchesStatus;
    });

    // Sort the filtered data
    filtered.sort((a, b) => {
      let aValue: any, bValue: any;
      
      switch (sortField) {
        case "status":
          aValue = a.status;
          bValue = b.status;
          break;
        case "target":
          aValue = a.ip || "";
          bValue = b.ip || "";
          break;
        case "port":
          aValue = a.port || 0;
          bValue = b.port || 0;
          break;
        case "protocol":
          aValue = a.protocol || "";
          bValue = b.protocol || "";
          break;
        case "vhost":
          aValue = (a.vhosts && a.vhosts.length > 0) ? a.vhosts.join(", ") : "";
          bValue = (b.vhosts && b.vhosts.length > 0) ? b.vhosts.join(", ") : "";
          break;
        case "tags":
          aValue = a.tags.length;
          bValue = b.tags.length;
          break;
        case "discoveredVia":
          aValue = a.discovered_via;
          bValue = b.discovered_via;
          break;
        default:
          aValue = a.ip || "";
          bValue = b.ip || "";
      }

      if (typeof aValue === "number" && typeof bValue === "number") {
        return sortDirection === "asc" ? aValue - bValue : bValue - aValue;
      }
      
      const comparison = String(aValue).localeCompare(String(bValue));
      return sortDirection === "asc" ? comparison : -comparison;
    });

    return filtered;
  }, [assets, searchQuery, statusFilter, sortField, sortDirection]);

  // Group services by IP for expandable host groups
  const hostGroups = useMemo(() => {
    const hostMap = new Map<string, {
      ip: string;
      hostnames: string[];
      services: Asset[];
      status: ServiceStatus;
    }>();

    filteredAndSortedData.forEach(asset => {
      const ip = asset.ip;
      if (!hostMap.has(ip)) {
        hostMap.set(ip, {
          ip,
          hostnames: [],
          services: [],
          status: "not_tested"
        });
      }
      
      const host = hostMap.get(ip)!;
      host.services.push(asset);
      
      // Collect all hostnames from all services on this IP
      if (asset.hostnames) {
        asset.hostnames.forEach(hostname => {
          if (!host.hostnames.includes(hostname)) {
            host.hostnames.push(hostname);
          }
        });
      }
      
      // Set most critical status
      const statusPriority = { "exploitable": 4, "vulnerable": 3, "testing": 2, "clean": 1, "not_tested": 0 };
      if (statusPriority[asset.status] > statusPriority[host.status]) {
        host.status = asset.status;
      }
    });
    
    return Array.from(hostMap.values()).sort((a, b) => a.ip.localeCompare(b.ip));
  }, [filteredAndSortedData]);

  // Pagination logic
  const totalItems = hostGroups.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedHostGroups = hostGroups.slice(startIndex, endIndex);

  // Reset to first page when search/filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter]);


  const toggleHost = (ip: string) => {
    const newExpanded = new Set(expandedHosts);
    if (newExpanded.has(ip)) {
      newExpanded.delete(ip);
    } else {
      newExpanded.add(ip);
    }
    setExpandedHosts(newExpanded);
  };

  const handleEditAsset = (asset: Asset) => {
    setSelectedAsset(asset);
    setSelectedHost(null);
    setEditAssetDialogOpen(true);
  };

  const handleEditHost = (hostGroup: any) => {
    setSelectedHost(hostGroup);
    setSelectedAsset(null);
    setEditAssetDialogOpen(true);
  };

  const handleDeleteHost = async (hostGroup: any) => {
    if (!confirm(`Are you sure you want to delete host ${hostGroup.ip} and all its ${hostGroup.services.length} services?`)) {
      return;
    }

    try {
      // Delete all services on this host
      const deletePromises = hostGroup.services.map((service: Asset) => 
        deleteAsset(projectId, service.id)
      );
      
      await Promise.all(deletePromises);
    } catch (error) {
      console.error('Failed to delete host:', error);
      alert('Failed to delete host. Please try again.');
    }
  };

  const addHostname = () => {
    if (newHostname.trim() && !newAsset.hostnames.includes(newHostname.trim())) {
      setNewAsset({
        ...newAsset,
        hostnames: [...newAsset.hostnames, newHostname.trim()]
      });
      setNewHostname("");
    }
  };

  const removeHostname = (hostnameToRemove: string) => {
    setNewAsset({
      ...newAsset,
      hostnames: newAsset.hostnames.filter(h => h !== hostnameToRemove)
    });
  };

  const addVhost = () => {
    if (newVhost.trim() && !newAsset.vhosts.includes(newVhost.trim())) {
      setNewAsset({
        ...newAsset,
        vhosts: [...newAsset.vhosts, newVhost.trim()]
      });
      setNewVhost("");
    }
  };

  const removeVhost = (vhostToRemove: string) => {
    setNewAsset({
      ...newAsset,
      vhosts: newAsset.vhosts.filter(v => v !== vhostToRemove)
    });
  };

  const handleAddAsset = async () => {
    // Validate required fields
    if (!newAsset.ip || !newAsset.port) {
      alert('IP Address and Port are required!');
      return;
    }
    
    try {
      const assetToAdd = {
        ip: newAsset.ip,
        port: parseInt(newAsset.port),
        protocol: newAsset.protocol,
        hostnames: newAsset.hostnames,
        vhosts: newAsset.vhosts,
        status: newAsset.status,
        discovered_via: newAsset.discoveredVia,
        notes: newAsset.notes
      };

      const created = await createAsset(projectId, assetToAdd);
      
      if (created) {
        setAddAssetDialogOpen(false);
        setNewAsset({
          hostnames: [],
          ip: "",
          port: "",
          protocol: "tcp",
          vhosts: [],
          notes: "",
          status: "not_tested",
          discoveredVia: "manual"
        });
        setNewHostname("");
        setNewVhost("");
      } else {
        alert('Failed to create asset. It may already exist.');
      }
    } catch (error) {
      console.error('Failed to create asset:', error);
      alert('Failed to create asset. Please try again.');
    }
  };

  const renderHostGroupRow = (hostGroup: any) => {
    const isExpanded = expandedHosts.has(hostGroup.ip);
    
    return (
      <TableRow 
        key={`host-${hostGroup.ip}`}
        className="group border-b border-border/40 hover:bg-muted/40 cursor-pointer bg-muted/20"
        onClick={() => toggleHost(hostGroup.ip)}
      >
        <TableCell>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
              {isExpanded ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </Button>
            {getStatusIcon(hostGroup.status)}
          </div>
        </TableCell>
        <TableCell className="font-mono text-sm font-semibold">
          <div className="flex items-center gap-2">
            <Server className="h-4 w-4 text-muted-foreground" />
            <span 
              className="cursor-pointer hover:text-primary"
              onClick={(e) => {
                e.stopPropagation();
                handleEditHost(hostGroup);
              }}
              title="Click to edit host"
            >
              {hostGroup.ip}
            </span>
            <Badge variant="outline" className="text-xs px-2 py-0.5">
              {hostGroup.services.length} services
            </Badge>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 text-muted-foreground hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={(e) => {
                e.stopPropagation();
                handleDeleteHost(hostGroup);
              }}
              title={`Delete host ${hostGroup.ip} and all services`}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        </TableCell>
        <TableCell className="text-sm">
          <div className="flex flex-wrap gap-1">
            {hostGroup.hostnames.length > 0 ? (
              hostGroup.hostnames.map((hostname: string) => (
                <Badge key={hostname} variant="outline" className="text-xs">
                  {hostname}
                </Badge>
              ))
            ) : (
              <span className="text-muted-foreground">-</span>
            )}
          </div>
        </TableCell>
        <TableCell className="text-sm">
          <div className="flex flex-wrap gap-1">
            {(() => {
              // Collect all unique vhosts from all services on this host
              const allVhosts = new Set<string>();
              hostGroup.services.forEach((service: Asset) => {
                if (service.vhosts) {
                  service.vhosts.forEach(vhost => allVhosts.add(vhost));
                }
              });
              const vhostArray = Array.from(allVhosts);
              
              return vhostArray.length > 0 ? (
                vhostArray.map(vhost => (
                  <Badge key={vhost} className="text-xs bg-blue-100 text-blue-800 border-blue-200">
                    {vhost}
                  </Badge>
                ))
              ) : (
                <span className="text-muted-foreground">-</span>
              );
            })()}
          </div>
        </TableCell>
        <TableCell className="text-muted-foreground">-</TableCell>
        <TableCell className="text-muted-foreground">-</TableCell>
        <TableCell className="text-muted-foreground">-</TableCell>
      </TableRow>
    );
  };

  const renderServiceRow = (asset: Asset, isChild = false) => {
    return (
      <TableRow 
        key={asset.id} 
        className={`border-b border-border/40 transition-colors cursor-pointer hover:bg-muted/40 ${
          isChild ? 'bg-muted/20' : ''
        }`}
      >
        <TableCell>
          <div className="flex items-center gap-2">
            {isChild && <div className="w-6 h-px bg-border ml-2" />}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                  {getStatusIcon(asset.status)}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuCheckboxItem 
                  checked={asset.status === "not_tested"}
                  onCheckedChange={() => handleStatusChange(asset.id, "not_tested")}
                >
                  Not Tested
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                  checked={asset.status === "testing"}
                  onCheckedChange={() => handleStatusChange(asset.id, "testing")}
                >
                  Testing
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                  checked={asset.status === "clean"}
                  onCheckedChange={() => handleStatusChange(asset.id, "clean")}
                >
                  Clean
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                  checked={asset.status === "vulnerable"}
                  onCheckedChange={() => handleStatusChange(asset.id, "vulnerable")}
                >
                  Vulnerable
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                  checked={asset.status === "exploitable"}
                  onCheckedChange={() => handleStatusChange(asset.id, "exploitable")}
                >
                  Exploitable
                </DropdownMenuCheckboxItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </TableCell>
        <TableCell className="font-mono text-sm">
          <div className="flex items-center gap-2">
            {isChild && <span className="text-muted-foreground">└─</span>}
            <span 
              className="cursor-pointer hover:text-primary"
              onClick={() => handleEditAsset(asset)}
              title="Click to edit service"
            >
              {asset.port}/{asset.protocol}
            </span>
          </div>
        </TableCell>
        <TableCell className="text-muted-foreground">
          -
        </TableCell>
        <TableCell className="text-sm">
          <div className="flex flex-wrap gap-1">
            {(asset.vhosts && asset.vhosts.length > 0) 
              ? asset.vhosts.map(vhost => (
                  <Badge key={vhost} className="text-xs bg-blue-100 text-blue-800 border-blue-200">
                    {vhost}
                  </Badge>
                ))
              : <span className="text-muted-foreground">-</span>
            }
          </div>
        </TableCell>
        <TableCell>
          <div className="flex flex-wrap gap-1">
            {asset.tags.map((tag) => (
              <Badge 
                key={tag.id} 
                className={`text-xs ${tag.color} text-white border-0`}
              >
                {tag.name}
              </Badge>
            ))}
            {asset.tags.length === 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-5 w-5 p-0 text-muted-foreground hover:text-foreground"
                title="Add tag"
                onClick={(e) => {
                  e.stopPropagation();
                  handleEditAsset(asset);
                }}
              >
                <Plus className="h-3 w-3" />
              </Button>
            )}
          </div>
        </TableCell>
        <TableCell>
          <Badge variant="outline" className="text-xs">
            {asset.discovered_via}
          </Badge>
        </TableCell>
        <TableCell className="text-sm text-muted-foreground max-w-64 truncate">
          {asset.notes || "-"}
        </TableCell>
      </TableRow>
    );
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header with search and filters */}
      <div className="flex-shrink-0 border-b border-border/60 bg-card/40 px-6 py-5">
        <div className="flex flex-col gap-4 rounded-xl border border-border/70 bg-background/70 p-4 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search assets, services, hostnames, IPs, tags..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-10 rounded-lg border border-border/60 bg-background/85 pl-9 text-sm"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Select
                value={statusFilter}
                onValueChange={(value) => setStatusFilter(value as ServiceStatus | "all")}
              >
                <SelectTrigger className="h-9 w-[150px] rounded-lg border border-border/60 bg-background/80 text-sm">
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent className="w-[200px]">
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="not_tested">Not Tested</SelectItem>
                  <SelectItem value="testing">Testing</SelectItem>
                  <SelectItem value="clean">Clean</SelectItem>
                  <SelectItem value="vulnerable">Vulnerable</SelectItem>
                  <SelectItem value="exploitable">Exploitable</SelectItem>
                </SelectContent>
              </Select>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-9 w-9 rounded-lg border border-border/60 bg-background/80"
                  >
                    <Filter className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuCheckboxItem
                    checked={sortField === "target"}
                    onCheckedChange={() => setSortField("target")}
                  >
                    Sort Alphabetically
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem
                    checked={sortField === "status"}
                    onCheckedChange={() => setSortField("status")}
                  >
                    Sort by Status
                  </DropdownMenuCheckboxItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <Button
                variant="outline"
                size="sm"
                className="h-9 rounded-lg border border-border/60 bg-background/80 text-sm"
                onClick={() => setImportNmapDialogOpen(true)}
              >
                <Upload className="mr-2 h-4 w-4" />
                Import Nmap
              </Button>

              <Dialog open={addAssetDialogOpen} onOpenChange={setAddAssetDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" className="h-9 rounded-lg text-sm">
                    <Plus className="mr-2 h-4 w-4" />
                    Add Asset
                  </Button>
                </DialogTrigger>
              <DialogContent className="sm:max-w-[600px]">
                <DialogHeader>
                  <DialogTitle>Add New Asset</DialogTitle>
                  <DialogDescription>
                    Add a new hostname, IP address, or service to your scope.
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-6 py-4">
                  {/* Host Information Section */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 pb-2 border-b">
                      <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                      <h4 className="text-sm font-semibold text-foreground">Host Information</h4>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="ip">IP Address <span className="text-red-500">*</span></Label>
                        <Input
                          id="ip"
                          placeholder="10.1.1.100"
                          value={newAsset.ip}
                          onChange={(e) => setNewAsset({...newAsset, ip: e.target.value})}
                          required
                        />
                        <p className="text-xs text-muted-foreground">IPv4 or IPv6 address (required)</p>
                      </div>
                      <div className="space-y-2">
                        <Label>Hostnames <span className="text-muted-foreground">(Optional)</span></Label>
                        <div className="space-y-2">
                          <div className="flex flex-wrap gap-2 min-h-[40px] p-2 border rounded-md">
                            {newAsset.hostnames.length ? (
                              newAsset.hostnames.map((hostname) => (
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
                                    <Plus className="h-3 w-3 rotate-45" />
                                  </Button>
                                </Badge>
                              ))
                            ) : (
                              <span className="text-sm text-muted-foreground">No hostnames added</span>
                            )}
                          </div>
                          <div className="flex gap-2">
                            <Input
                              placeholder="www.example.com"
                              value={newHostname}
                              onChange={(e) => setNewHostname(e.target.value)}
                              onKeyPress={(e) => e.key === 'Enter' && addHostname()}
                            />
                            <Button onClick={addHostname} size="sm" type="button">
                              <Plus className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground">Multiple domain/subdomain names</p>
                      </div>
                    </div>
                  </div>

                  {/* Service Details Section */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 pb-2 border-b">
                      <div className="w-2 h-2 rounded-full bg-green-500"></div>
                      <h4 className="text-sm font-semibold text-foreground">Service Details</h4>
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="port">Port <span className="text-red-500">*</span></Label>
                        <Input
                          id="port"
                          type="number"
                          placeholder="80"
                          value={newAsset.port}
                          onChange={(e) => setNewAsset({...newAsset, port: e.target.value})}
                          required
                        />
                        <p className="text-xs text-muted-foreground">Service port (required)</p>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="protocol">Protocol <span className="text-muted-foreground">(Optional)</span></Label>
                        <Select 
                          value={newAsset.protocol} 
                          onValueChange={(value) => setNewAsset({...newAsset, protocol: value as "tcp" | "udp"})}
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
                      <div className="space-y-2">
                        <Label htmlFor="status">Initial Status <span className="text-muted-foreground">(Optional)</span></Label>
                        <Select 
                          value={newAsset.status} 
                          onValueChange={(value) => setNewAsset({...newAsset, status: value as ServiceStatus})}
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
                    </div>
                  </div>

                  {/* Virtual Hosts Section */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 pb-2 border-b">
                      <div className="w-2 h-2 rounded-full bg-purple-500"></div>
                      <h4 className="text-sm font-semibold text-foreground">Virtual Hosts</h4>
                    </div>
                    <div className="space-y-2">
                      <Label>Virtual Hosts <span className="text-muted-foreground">(Optional)</span></Label>
                      <div className="space-y-2">
                        <div className="flex flex-wrap gap-2 min-h-[40px] p-2 border rounded-md">
                          {newAsset.vhosts.length ? (
                            newAsset.vhosts.map((vhost) => (
                              <Badge
                                key={vhost}
                                variant="outline"
                                className="flex items-center gap-1 px-2 py-1 bg-purple-50 border-purple-200"
                              >
                                <span className="text-xs">{vhost}</span>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-4 w-4 p-0 hover:bg-red-100"
                                  onClick={() => removeVhost(vhost)}
                                >
                                  <Plus className="h-3 w-3 rotate-45" />
                                </Button>
                              </Badge>
                            ))
                          ) : (
                            <span className="text-sm text-muted-foreground">No virtual hosts added</span>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <Input
                            placeholder="blog.example.com"
                            value={newVhost}
                            onChange={(e) => setNewVhost(e.target.value)}
                            onKeyPress={(e) => e.key === 'Enter' && addVhost()}
                          />
                          <Button onClick={addVhost} size="sm" type="button">
                            <Plus className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        VHosts served by this service
                      </p>
                    </div>
                  </div>

                  {/* Divider */}
                  <div className="border-t border-border/40"></div>

                  {/* Additional Information Section */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 pb-2 border-b">
                      <div className="w-2 h-2 rounded-full bg-orange-500"></div>
                      <h4 className="text-sm font-semibold text-foreground">Additional Information</h4>
                    </div>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="discoveredVia">Discovery Method <span className="text-muted-foreground">(Optional)</span></Label>
                        <Select 
                          value={newAsset.discoveredVia} 
                          onValueChange={(value) => setNewAsset({...newAsset, discoveredVia: value as any})}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="manual">Manual Entry</SelectItem>
                            <SelectItem value="nmap">Nmap Scan</SelectItem>
                            <SelectItem value="ssl-cert">SSL Certificate Discovery</SelectItem>
                            <SelectItem value="http-vhosts">HTTP Virtual Host Discovery</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="notes">Notes <span className="text-muted-foreground">(Optional)</span></Label>
                        <Textarea
                          id="notes"
                          placeholder="Additional notes, findings, or context about this asset..."
                          value={newAsset.notes}
                          onChange={(e) => setNewAsset({...newAsset, notes: e.target.value})}
                          rows={3}
                        />
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="flex justify-end gap-3">
                  <Button variant="outline" onClick={() => setAddAssetDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button 
                    onClick={handleAddAsset}
                    disabled={!newAsset.ip || !newAsset.port}
                  >
                    Add Asset
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
            
            <ImportNmapDialog
              open={importNmapDialogOpen}
              onOpenChange={setImportNmapDialogOpen}
              projectId={projectId}
            />
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 flex flex-col overflow-hidden px-3">
        <ScrollArea className="flex-1">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent border-b border-border/60">
                <TableHead className="w-32">
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => handleSort("status")}
                    className="h-8 p-0 hover:bg-transparent"
                  >
                    Status
                    {getSortIcon("status")}
                  </Button>
                </TableHead>
                <TableHead className="min-w-48">
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => handleSort("target")}
                    className="h-8 p-0 hover:bg-transparent"
                  >
                    Host / Service
                    {getSortIcon("target")}
                  </Button>
                </TableHead>
                <TableHead className="min-w-32">Hostnames</TableHead>
                <TableHead className="min-w-32">
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => handleSort("vhost")}
                    className="h-8 p-0 hover:bg-transparent"
                  >
                    Virtual Hosts
                    {getSortIcon("vhost")}
                  </Button>
                </TableHead>
                <TableHead className="min-w-32">
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => handleSort("tags")}
                    className="h-8 p-0 hover:bg-transparent"
                  >
                    Tags
                    {getSortIcon("tags")}
                  </Button>
                </TableHead>
                <TableHead className="w-32">
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => handleSort("discoveredVia")}
                    className="h-8 p-0 hover:bg-transparent"
                  >
                    Discovery
                    {getSortIcon("discoveredVia")}
                  </Button>
                </TableHead>
                <TableHead className="min-w-64">Notes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedHostGroups.map((hostGroup) => {
                const isExpanded = expandedHosts.has(hostGroup.ip);
                return (
                  <React.Fragment key={hostGroup.ip}>
                    {renderHostGroupRow(hostGroup)}
                    {isExpanded && hostGroup.services.map(service => 
                      renderServiceRow(service, true)
                    )}
                  </React.Fragment>
                );
              })}
            </TableBody>
          </Table>
          
          {loading && (
            <div className="flex items-center justify-center h-32 text-center">
              <div className="space-y-2">
                <p className="text-muted-foreground">Loading assets...</p>
              </div>
            </div>
          )}
          
          {!loading && paginatedHostGroups.length === 0 && (
            <div className="flex items-center justify-center h-32 text-center">
              <div className="space-y-2">
                <p className="text-muted-foreground">No assets found</p>
                <p className="text-sm text-muted-foreground">
                  {error ? `Error: ${error}` : "Try adjusting your search or filters"}
                </p>
              </div>
            </div>
          )}
        </ScrollArea>
        
        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-t border-border/40 bg-background">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">
                Showing {startIndex + 1} to {Math.min(endIndex, totalItems)} of {totalItems} hosts
              </span>
              <Select 
                value={itemsPerPage.toString()} 
                onValueChange={(value) => {
                  setItemsPerPage(parseInt(value));
                  setCurrentPage(1);
                }}
              >
                <SelectTrigger className="w-20 h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10</SelectItem>
                  <SelectItem value="20">20</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                  <SelectItem value="100">100</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(1)}
                disabled={currentPage === 1}
                className="h-8 px-2"
              >
                First
              </Button>
              <Button
                variant="outline" 
                size="sm"
                onClick={() => setCurrentPage(currentPage - 1)}
                disabled={currentPage === 1}
                className="h-8 px-2"
              >
                Previous
              </Button>
              
              <div className="flex items-center gap-1">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum;
                  if (totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (currentPage <= 3) {
                    pageNum = i + 1;
                  } else if (currentPage >= totalPages - 2) {
                    pageNum = totalPages - 4 + i;
                  } else {
                    pageNum = currentPage - 2 + i;
                  }
                  
                  return (
                    <Button
                      key={pageNum}
                      variant={currentPage === pageNum ? "default" : "outline"}
                      size="sm"
                      onClick={() => setCurrentPage(pageNum)}
                      className="h-8 w-8 p-0"
                    >
                      {pageNum}
                    </Button>
                  );
                })}
              </div>
              
              <Button
                variant="outline"
                size="sm" 
                onClick={() => setCurrentPage(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="h-8 px-2"
              >
                Next
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(totalPages)}
                disabled={currentPage === totalPages}
                className="h-8 px-2"
              >
                Last
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>

    {/* Edit Asset Dialog */}
    <EditAssetDialog
      asset={selectedAsset}
      hostGroup={selectedHost}
      open={editAssetDialogOpen}
      onOpenChange={(open) => {
        setEditAssetDialogOpen(open);
        if (!open) {
          setSelectedAsset(null);
          setSelectedHost(null);
        }
      }}
      projectId={projectId}
    />
  </div>
  );
}
