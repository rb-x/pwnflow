import React, { useState, useMemo, useEffect } from "react";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuCheckboxItem,
  DropdownMenuItem,
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
  Loader2,
  X,
  Globe,
  Tag,
  MoreVertical,
  Columns,
  Pencil,
} from "lucide-react";
import { useScopeStore, type Asset, type Tag as TagType, type ServiceStatus } from "@/store/scopeStore";
import { EditAssetDialog } from "./EditAssetDialog";
import { ImportNmapDialog } from "./ImportNmapDialog";
import { AddAssetDialog } from "./AddAssetDialog";

interface ScopeTableProps {
  projectId: string;
}

type SortField = "status" | "target";
type SortDirection = "asc" | "desc";
type DiscoveryMethod = "nmap" | "manual" | "all";

// Column definitions
type ColumnId = "status" | "host" | "service" | "hostnames" | "vhosts" | "tags" | "discovery" | "notes";

interface ColumnDef {
  id: ColumnId;
  label: string;
  defaultVisible: boolean;
}

const COLUMNS: ColumnDef[] = [
  { id: "status", label: "Status", defaultVisible: true },
  { id: "host", label: "Host / Service", defaultVisible: true },
  { id: "service", label: "Service", defaultVisible: true },
  { id: "hostnames", label: "Hostnames", defaultVisible: true },
  { id: "vhosts", label: "Virtual Hosts", defaultVisible: false },
  { id: "tags", label: "Tags", defaultVisible: true },
  { id: "discovery", label: "Discovery", defaultVisible: false },
  { id: "notes", label: "Notes", defaultVisible: false },
];

// Helper to extract service name from notes (format: "Service: http | Product: ...")
function extractServiceFromNotes(notes?: string): string | null {
  if (!notes) return null;
  const match = notes.match(/Service:\s*(\S+)/i);
  return match ? match[1] : null;
}

export function ScopeTable({ projectId }: ScopeTableProps) {
  const {
    assets,
    loading,
    error,
    fetchAssets,
    updateAsset: updateAssetApi,
    deleteAsset,
  } = useScopeStore();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<ServiceStatus | "all">("all");
  const [discoveryFilter, setDiscoveryFilter] = useState<DiscoveryMethod>("all");
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [sortField, setSortField] = useState<SortField>("target");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [expandedHosts, setExpandedHosts] = useState<Set<string>>(new Set());
  const [addAssetDialogOpen, setAddAssetDialogOpen] = useState(false);
  const [editAssetDialogOpen, setEditAssetDialogOpen] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [selectedHost, setSelectedHost] = useState<any | null>(null);
  const [importNmapDialogOpen, setImportNmapDialogOpen] = useState(false);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);

  // Column visibility state - load from localStorage
  const [visibleColumns, setVisibleColumns] = useState<Set<ColumnId>>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('scopeTable.visibleColumns');
      if (saved) {
        try {
          return new Set(JSON.parse(saved) as ColumnId[]);
        } catch {}
      }
    }
    return new Set(COLUMNS.filter(c => c.defaultVisible).map(c => c.id));
  });

  // Save column visibility to localStorage
  useEffect(() => {
    localStorage.setItem('scopeTable.visibleColumns', JSON.stringify([...visibleColumns]));
  }, [visibleColumns]);

  const toggleColumn = (columnId: ColumnId) => {
    const newVisible = new Set(visibleColumns);
    if (newVisible.has(columnId)) {
      // Don't allow hiding all columns - keep at least status and host
      if (columnId !== 'status' && columnId !== 'host') {
        newVisible.delete(columnId);
      }
    } else {
      newVisible.add(columnId);
    }
    setVisibleColumns(newVisible);
  };

  const isColumnVisible = (columnId: ColumnId) => visibleColumns.has(columnId);

  // Fetch assets when component loads or projectId changes
  useEffect(() => {
    if (projectId) {
      fetchAssets(projectId);
    }
  }, [projectId, fetchAssets]);

  // Get all unique tags from assets for filtering
  const allTags = useMemo(() => {
    const tagMap = new Map<string, TagType>();
    assets.forEach(asset => {
      asset.tags.forEach(tag => {
        if (!tagMap.has(tag.id)) {
          tagMap.set(tag.id, tag);
        }
      });
    });
    return Array.from(tagMap.values());
  }, [assets]);

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
      return null;
    }
    return sortDirection === "asc" ?
      <ArrowUp className="ml-1 h-3 w-3" /> :
      <ArrowDown className="ml-1 h-3 w-3" />;
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
      const matchesDiscovery = discoveryFilter === "all" || asset.discovered_via === discoveryFilter;
      const matchesTag = !tagFilter || asset.tags.some(t => t.id === tagFilter);

      return matchesSearch && matchesStatus && matchesDiscovery && matchesTag;
    });

    // Sort the filtered data
    filtered.sort((a, b) => {
      let aValue: string, bValue: string;

      switch (sortField) {
        case "status":
          const statusOrder = { "exploitable": 4, "vulnerable": 3, "testing": 2, "clean": 1, "not_tested": 0 };
          const aOrder = statusOrder[a.status];
          const bOrder = statusOrder[b.status];
          return sortDirection === "asc" ? aOrder - bOrder : bOrder - aOrder;
        case "target":
        default:
          aValue = a.ip || "";
          bValue = b.ip || "";
          const comparison = aValue.localeCompare(bValue);
          return sortDirection === "asc" ? comparison : -comparison;
      }
    });

    return filtered;
  }, [assets, searchQuery, statusFilter, discoveryFilter, tagFilter, sortField, sortDirection]);

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

      if (asset.hostnames) {
        asset.hostnames.forEach(hostname => {
          if (!host.hostnames.includes(hostname)) {
            host.hostnames.push(hostname);
          }
        });
      }

      const statusPriority = { "exploitable": 4, "vulnerable": 3, "testing": 2, "clean": 1, "not_tested": 0 };
      if (statusPriority[asset.status] > statusPriority[host.status]) {
        host.status = asset.status;
      }
    });

    return Array.from(hostMap.values()).sort((a, b) => a.ip.localeCompare(b.ip));
  }, [filteredAndSortedData]);

  // Stats for summary badges
  const stats = useMemo(() => {
    const totalHosts = hostGroups.length;
    const totalServices = assets.length;
    const statusCounts = {
      exploitable: 0,
      vulnerable: 0,
      testing: 0,
      clean: 0,
      not_tested: 0,
    };
    assets.forEach(a => {
      statusCounts[a.status]++;
    });
    return { totalHosts, totalServices, statusCounts };
  }, [hostGroups, assets]);

  // Pagination logic
  const totalItems = hostGroups.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedHostGroups = hostGroups.slice(startIndex, endIndex);

  // Reset to first page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter, discoveryFilter, tagFilter]);

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
      const deletePromises = hostGroup.services.map((service: Asset) =>
        deleteAsset(projectId, service.id)
      );
      await Promise.all(deletePromises);
    } catch (error) {
      console.error('Failed to delete host:', error);
      alert('Failed to delete host. Please try again.');
    }
  };

  const clearFilters = () => {
    setSearchQuery("");
    setStatusFilter("all");
    setDiscoveryFilter("all");
    setTagFilter(null);
  };

  const hasActiveFilters = searchQuery || statusFilter !== "all" || discoveryFilter !== "all" || tagFilter !== null;

  const handleTagClick = (tagId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (tagFilter === tagId) {
      setTagFilter(null);
    } else {
      setTagFilter(tagId);
    }
  };

  // Sortable header component - only for columns that make sense to sort
  const SortableHeader = ({
    field,
    children,
  }: {
    field: SortField;
    children: React.ReactNode;
  }) => (
    <Button
      variant="ghost"
      size="sm"
      className="h-8 px-2 hover:bg-transparent font-medium"
      onClick={() => handleSort(field)}
    >
      {children}
      {getSortIcon(field)}
    </Button>
  );

  return (
    <>
      <div className="flex flex-col h-full">
        {/* Header with search and filters */}
        <div className="flex-shrink-0 border-b border-border/60 bg-card/40 px-6 py-5 space-y-4">
          {/* Summary stats */}
          <div className="flex items-center gap-2 overflow-x-auto pb-2">
            <Badge variant="secondary" className="text-xs gap-1.5 px-3 py-1">
              <Server className="h-3 w-3" />
              {stats.totalHosts} hosts
            </Badge>
            <Badge variant="secondary" className="text-xs gap-1.5 px-3 py-1">
              <Globe className="h-3 w-3" />
              {stats.totalServices} services
            </Badge>
            {stats.statusCounts.exploitable > 0 && (
              <Badge className="text-xs gap-1.5 px-3 py-1 bg-black text-white">
                {stats.statusCounts.exploitable} exploitable
              </Badge>
            )}
            {stats.statusCounts.vulnerable > 0 && (
              <Badge className="text-xs gap-1.5 px-3 py-1 bg-red-800 text-white">
                {stats.statusCounts.vulnerable} vulnerable
              </Badge>
            )}
            {stats.statusCounts.testing > 0 && (
              <Badge className="text-xs gap-1.5 px-3 py-1 bg-yellow-100 text-yellow-700">
                {stats.statusCounts.testing} testing
              </Badge>
            )}
          </div>

          {/* Search and filters row */}
          <div className="flex gap-2 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search hosts, services, IPs, hostnames..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>

            <Select
              value={statusFilter}
              onValueChange={(value) => setStatusFilter(value as ServiceStatus | "all")}
            >
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="not_tested">Not Tested</SelectItem>
                <SelectItem value="testing">Testing</SelectItem>
                <SelectItem value="clean">Clean</SelectItem>
                <SelectItem value="vulnerable">Vulnerable</SelectItem>
                <SelectItem value="exploitable">Exploitable</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={discoveryFilter}
              onValueChange={(value) => setDiscoveryFilter(value as DiscoveryMethod)}
            >
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Discovery" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sources</SelectItem>
                <SelectItem value="nmap">Nmap</SelectItem>
                <SelectItem value="manual">Manual</SelectItem>
              </SelectContent>
            </Select>

            {allTags.length > 0 && (
              <Select
                value={tagFilter || "all"}
                onValueChange={(value) => setTagFilter(value === "all" ? null : value)}
              >
                <SelectTrigger className="w-[140px]">
                  <Tag className="h-3 w-3 mr-2" />
                  <SelectValue placeholder="Tag" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Tags</SelectItem>
                  {allTags.map((tag) => (
                    <SelectItem key={tag.id} value={tag.id}>
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${tag.color}`} />
                        {tag.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {/* Column visibility toggle */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-9">
                  <Columns className="mr-2 h-4 w-4" />
                  Columns
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                {COLUMNS.map((column) => (
                  <DropdownMenuCheckboxItem
                    key={column.id}
                    checked={isColumnVisible(column.id)}
                    onCheckedChange={() => toggleColumn(column.id)}
                    disabled={column.id === 'status' || column.id === 'host'}
                  >
                    {column.label}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" className="h-9">
                  <Plus className="mr-2 h-4 w-4" />
                  Add
                  <ChevronDown className="ml-1 h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setAddAssetDialogOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Manual Entry
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setImportNmapDialogOpen(true)}>
                  <Upload className="mr-2 h-4 w-4" />
                  Nmap XML
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="icon"
                onClick={clearFilters}
                title="Clear all filters"
                className="h-9 w-9"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>

          {/* Active filters display */}
          {hasActiveFilters && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm text-muted-foreground">Active filters:</span>
              {searchQuery && (
                <Badge variant="secondary" className="gap-1">
                  Search: {searchQuery}
                  <button onClick={() => setSearchQuery("")} className="ml-1 hover:bg-primary/20 rounded">
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              )}
              {statusFilter !== "all" && (
                <Badge variant="secondary" className="gap-1">
                  Status: {statusFilter.replace('_', ' ')}
                  <button onClick={() => setStatusFilter("all")} className="ml-1 hover:bg-primary/20 rounded">
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              )}
              {discoveryFilter !== "all" && (
                <Badge variant="secondary" className="gap-1">
                  Discovery: {discoveryFilter}
                  <button onClick={() => setDiscoveryFilter("all")} className="ml-1 hover:bg-primary/20 rounded">
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              )}
              {tagFilter && (
                <Badge variant="secondary" className="gap-1">
                  Tag: {allTags.find(t => t.id === tagFilter)?.name || tagFilter}
                  <button onClick={() => setTagFilter(null)} className="ml-1 hover:bg-primary/20 rounded">
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              )}
            </div>
          )}
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto px-6 py-4">
          <div className="overflow-hidden rounded-2xl border border-border/60 bg-card/70 shadow-sm backdrop-blur-sm">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-12"></TableHead>
                  {isColumnVisible('status') && (
                    <TableHead className="w-24">
                      <SortableHeader field="status">Status</SortableHeader>
                    </TableHead>
                  )}
                  {isColumnVisible('host') && (
                    <TableHead className="min-w-48">
                      <SortableHeader field="target">Host / Service</SortableHeader>
                    </TableHead>
                  )}
                  {isColumnVisible('service') && (
                    <TableHead className="w-24">Service</TableHead>
                  )}
                  {isColumnVisible('hostnames') && (
                    <TableHead className="min-w-32">Hostnames</TableHead>
                  )}
                  {isColumnVisible('vhosts') && (
                    <TableHead className="min-w-32">Virtual Hosts</TableHead>
                  )}
                  {isColumnVisible('tags') && (
                    <TableHead className="min-w-24">Tags</TableHead>
                  )}
                  {isColumnVisible('discovery') && (
                    <TableHead className="w-28">Discovery</TableHead>
                  )}
                  {isColumnVisible('notes') && (
                    <TableHead className="min-w-48">Notes</TableHead>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={visibleColumns.size + 1} className="h-32">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">Loading assets...</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : paginatedHostGroups.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={visibleColumns.size + 1} className="h-32">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <Server className="h-8 w-8 text-muted-foreground/50" />
                        <span className="text-muted-foreground">No assets found</span>
                        <span className="text-sm text-muted-foreground">
                          {error ? `Error: ${error}` : hasActiveFilters ? "Try adjusting your filters" : "Import from Nmap or add assets manually"}
                        </span>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedHostGroups.map((hostGroup) => {
                    const isExpanded = expandedHosts.has(hostGroup.ip);
                    return (
                      <React.Fragment key={hostGroup.ip}>
                        {/* Host row */}
                        <TableRow
                          className="group cursor-pointer bg-muted/30 hover:bg-muted/50 transition-colors"
                          onClick={() => toggleHost(hostGroup.ip)}
                        >
                          <TableCell className="py-3">
                            <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                              {isExpanded ? (
                                <ChevronDown className="h-4 w-4 transition-transform" />
                              ) : (
                                <ChevronRight className="h-4 w-4 transition-transform" />
                              )}
                            </Button>
                          </TableCell>
                          {isColumnVisible('status') && (
                            <TableCell>
                              {getStatusIcon(hostGroup.status)}
                            </TableCell>
                          )}
                          {isColumnVisible('host') && (
                            <TableCell className="font-mono text-sm font-semibold">
                              <div className="flex items-center gap-2">
                                <Server className="h-4 w-4 text-muted-foreground" />
                                <span
                                  className="hover:text-primary cursor-pointer"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleEditHost(hostGroup);
                                  }}
                                >
                                  {hostGroup.ip}
                                </span>
                                <Badge variant="outline" className="text-xs">
                                  {hostGroup.services.length} {hostGroup.services.length === 1 ? 'service' : 'services'}
                                </Badge>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteHost(hostGroup);
                                  }}
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            </TableCell>
                          )}
                          {isColumnVisible('service') && (
                            <TableCell className="text-muted-foreground">-</TableCell>
                          )}
                          {isColumnVisible('hostnames') && (
                            <TableCell>
                              <div className="flex flex-wrap gap-1">
                                {hostGroup.hostnames.length > 0 ? (
                                  hostGroup.hostnames.slice(0, 2).map((hostname: string) => (
                                    <Badge key={hostname} variant="outline" className="text-xs">
                                      {hostname}
                                    </Badge>
                                  ))
                                ) : (
                                  <span className="text-muted-foreground">-</span>
                                )}
                                {hostGroup.hostnames.length > 2 && (
                                  <Badge variant="outline" className="text-xs">
                                    +{hostGroup.hostnames.length - 2}
                                  </Badge>
                                )}
                              </div>
                            </TableCell>
                          )}
                          {isColumnVisible('vhosts') && (
                            <TableCell>
                              {(() => {
                                const allVhosts = new Set<string>();
                                hostGroup.services.forEach((service: Asset) => {
                                  service.vhosts?.forEach(vhost => allVhosts.add(vhost));
                                });
                                const vhostArray = Array.from(allVhosts);

                                return vhostArray.length > 0 ? (
                                  <div className="flex flex-wrap gap-1">
                                    {vhostArray.slice(0, 2).map(vhost => (
                                      <Badge key={vhost} className="text-xs bg-blue-100 text-blue-800 border-blue-200">
                                        {vhost}
                                      </Badge>
                                    ))}
                                    {vhostArray.length > 2 && (
                                      <Badge variant="outline" className="text-xs">
                                        +{vhostArray.length - 2}
                                      </Badge>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-muted-foreground">-</span>
                                );
                              })()}
                            </TableCell>
                          )}
                          {isColumnVisible('tags') && (
                            <TableCell className="text-muted-foreground">-</TableCell>
                          )}
                          {isColumnVisible('discovery') && (
                            <TableCell className="text-muted-foreground">-</TableCell>
                          )}
                          {isColumnVisible('notes') && (
                            <TableCell className="text-muted-foreground">-</TableCell>
                          )}
                        </TableRow>

                        {/* Service rows (expanded) */}
                        {isExpanded && hostGroup.services.map((asset: Asset) => (
                          <TableRow
                            key={asset.id}
                            className="group/service hover:bg-muted/30 transition-colors"
                          >
                            <TableCell></TableCell>
                            {isColumnVisible('status') && (
                              <TableCell>
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                      {getStatusIcon(asset.status)}
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="start">
                                    {(["not_tested", "testing", "clean", "vulnerable", "exploitable"] as ServiceStatus[]).map((status) => (
                                      <DropdownMenuCheckboxItem
                                        key={status}
                                        checked={asset.status === status}
                                        onCheckedChange={() => handleStatusChange(asset.id, status)}
                                      >
                                        {status.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}
                                      </DropdownMenuCheckboxItem>
                                    ))}
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </TableCell>
                            )}
                            {isColumnVisible('host') && (
                              <TableCell className="font-mono text-sm">
                                <div className="flex items-center gap-2 pl-6">
                                  <span className="text-muted-foreground">└─</span>
                                  <span
                                    className="hover:text-primary cursor-pointer"
                                    onClick={() => handleEditAsset(asset)}
                                  >
                                    {asset.port}/{asset.protocol}
                                  </span>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 w-6 p-0 opacity-0 group-hover/service:opacity-100 transition-opacity text-muted-foreground hover:text-primary"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleEditAsset(asset);
                                    }}
                                    title="Edit service"
                                  >
                                    <Pencil className="h-3 w-3" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 w-6 p-0 opacity-0 group-hover/service:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (confirm(`Delete service ${asset.ip}:${asset.port}?`)) {
                                        deleteAsset(projectId, asset.id);
                                      }
                                    }}
                                    title="Delete service"
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </div>
                              </TableCell>
                            )}
                            {isColumnVisible('service') && (
                              <TableCell>
                                {(() => {
                                  const serviceName = extractServiceFromNotes(asset.notes);
                                  return serviceName ? (
                                    <Badge variant="secondary" className="text-xs font-mono">
                                      {serviceName}
                                    </Badge>
                                  ) : (
                                    <span className="text-muted-foreground">-</span>
                                  );
                                })()}
                              </TableCell>
                            )}
                            {isColumnVisible('hostnames') && (
                              <TableCell className="text-muted-foreground">-</TableCell>
                            )}
                            {isColumnVisible('vhosts') && (
                              <TableCell>
                                <div className="flex flex-wrap gap-1">
                                  {asset.vhosts?.length ? (
                                    asset.vhosts.map(vhost => (
                                      <Badge key={vhost} className="text-xs bg-blue-100 text-blue-800 border-blue-200">
                                        {vhost}
                                      </Badge>
                                    ))
                                  ) : (
                                    <span className="text-muted-foreground">-</span>
                                  )}
                                </div>
                              </TableCell>
                            )}
                            {isColumnVisible('tags') && (
                              <TableCell>
                                <div className="flex flex-wrap gap-1">
                                  {asset.tags.length > 0 ? (
                                    asset.tags.map((tag) => (
                                      <Badge
                                        key={tag.id}
                                        className={`text-xs ${tag.color} text-white border-0 cursor-pointer hover:opacity-80 transition-opacity ${tagFilter === tag.id ? 'ring-2 ring-offset-1 ring-primary' : ''}`}
                                        onClick={(e) => handleTagClick(tag.id, e)}
                                        title={`Click to filter by "${tag.name}"`}
                                      >
                                        {tag.name}
                                      </Badge>
                                    ))
                                  ) : (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-5 w-5 p-0 text-muted-foreground hover:text-foreground"
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
                            )}
                            {isColumnVisible('discovery') && (
                              <TableCell>
                                <Badge
                                  variant="outline"
                                  className={`text-xs cursor-pointer hover:bg-muted ${discoveryFilter === asset.discovered_via ? 'ring-2 ring-offset-1 ring-primary' : ''}`}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (discoveryFilter === asset.discovered_via) {
                                      setDiscoveryFilter("all");
                                    } else {
                                      setDiscoveryFilter(asset.discovered_via as DiscoveryMethod);
                                    }
                                  }}
                                  title={`Click to filter by "${asset.discovered_via}"`}
                                >
                                  {asset.discovered_via}
                                </Badge>
                              </TableCell>
                            )}
                            {isColumnVisible('notes') && (
                              <TableCell className="text-sm text-muted-foreground max-w-48 truncate">
                                {asset.notes || "-"}
                              </TableCell>
                            )}
                          </TableRow>
                        ))}
                      </React.Fragment>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </div>

        {/* Pagination - always visible */}
        <div className="flex-shrink-0 p-4 border-t border-border">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>
                Showing {totalItems > 0 ? startIndex + 1 : 0} to {Math.min(endIndex, totalItems)} of {totalItems} hosts
              </span>
              <Select
                value={itemsPerPage.toString()}
                onValueChange={(value) => {
                  setItemsPerPage(parseInt(value));
                  setCurrentPage(1);
                }}
              >
                <SelectTrigger className="h-8 w-[70px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[10, 20, 50, 100].map((size) => (
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
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
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
                      key={i}
                      variant={currentPage === pageNum ? "default" : "outline"}
                      size="sm"
                      onClick={() => setCurrentPage(pageNum)}
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
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages || totalPages === 0}
              >
                Next
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Import Nmap Dialog */}
      <ImportNmapDialog
        open={importNmapDialogOpen}
        onOpenChange={setImportNmapDialogOpen}
        projectId={projectId}
      />

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

      {/* Add Asset Dialog */}
      <AddAssetDialog
        open={addAssetDialogOpen}
        onOpenChange={setAddAssetDialogOpen}
        projectId={projectId}
      />
    </>
  );
}
