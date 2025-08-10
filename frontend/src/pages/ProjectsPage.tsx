import { useState, useMemo } from "react";
import {
  Plus,
  FolderOpen,
  Search,
  MoreHorizontal,
  Trash2,
  Edit,
  ChevronDown,
  FileText,
  FileUp,
  Upload,
  Download,
  FolderDown,
  Calendar,
  Clock,
  GitBranch,
  ArrowRight,
  Package,
  ArrowDown,
  ArrowUp,
  CheckSquare,
  X,
  Check,
  ChevronsUpDown,
  Activity,
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import {
  useProjects,
  useCreateProject,
  useUpdateProject,
  useDeleteProject,
  useBulkDeleteProjects,
} from "@/hooks/api/useProjects";
import { useCategoryTags } from "@/hooks/api/useCategoryTags";
import {
  useTemplates,
  useCreateProjectFromTemplate,
} from "@/hooks/api/useTemplates";
import { CreateTemplateFromProjectDialog } from "@/components/CreateTemplateFromProjectDialog";
import { LegacyImportModal } from "@/components/import/LegacyImportModal";
import { ProjectExportDialog } from "@/components/export/ProjectExportDialog";
import { ProjectImportDialog } from "@/components/export/ProjectImportDialog";
import { BulkExportDialog } from "@/components/export/BulkExportDialog";
import { env } from "@/config/env";
import { ProjectProgressModal } from "@/components/ProjectProgressModal";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { TagInput } from "@/components/TagInput";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function ProjectsPage() {
  const { data: projects, isLoading } = useProjects();
  const { data: categoryTags } = useCategoryTags();
  const { data: templates } = useTemplates();
  const createProject = useCreateProject();
  const createProjectFromTemplate = useCreateProjectFromTemplate();
  const updateProject = useUpdateProject();
  const deleteProject = useDeleteProject();
  const bulkDeleteProjects = useBulkDeleteProjects();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [createTemplateOpen, setCreateTemplateOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [bulkExportOpen, setBulkExportOpen] = useState(false);
  const [projectImportOpen, setProjectImportOpen] = useState(false);
  const [importInitialData, setImportInitialData] = useState<{
    file: File;
    password: string;
  } | null>(null);
  const [selectedProject, setSelectedProject] = useState<any>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(
    null
  );
  const [templateSearchOpen, setTemplateSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortOption, setSortOption] = useState<
    "date_desc" | "date_asc" | "name_asc" | "name_desc"
  >("date_desc");
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedProjects, setSelectedProjects] = useState<Set<string>>(
    new Set()
  );
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [progressModalOpen, setProgressModalOpen] = useState(false);
  const [progressProject, setProgressProject] = useState<{
    id: string;
    name: string;
  } | null>(null);

  const tagSuggestions = categoryTags?.map((tag) => tag.name) || [];

  const filteredProjects = useMemo(() => {
    let filtered = projects || [];

    // Apply search filter
    if (searchQuery) {
      filtered = filtered.filter(
        (project) =>
          project.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          project.description
            ?.toLowerCase()
            .includes(searchQuery.toLowerCase()) ||
          project.category_tags.some((tag) =>
            tag.toLowerCase().includes(searchQuery.toLowerCase())
          )
      );
    }

    // Apply sorting
    filtered = [...filtered].sort((a, b) => {
      switch (sortOption) {
        case "date_desc":
          return (
            new Date(b.created_at || 0).getTime() -
            new Date(a.created_at || 0).getTime()
          );
        case "date_asc":
          return (
            new Date(a.created_at || 0).getTime() -
            new Date(b.created_at || 0).getTime()
          );
        case "name_asc":
          return a.name.localeCompare(b.name);
        case "name_desc":
          return b.name.localeCompare(a.name);
        default:
          return 0;
      }
    });

    return filtered;
  }, [projects, searchQuery, sortOption]);

  const handleCreateProject = async () => {
    if (!name.trim()) return;

    // Remove any duplicate tags (case-insensitive)
    const uniqueTags = Array.from(
      new Set(tags.map((tag) => tag.toLowerCase()))
    ).map((lowerTag) => tags.find((tag) => tag.toLowerCase() === lowerTag)!);

    if (selectedTemplateId) {
      // Create project from template
      await createProjectFromTemplate.mutateAsync({
        templateId: selectedTemplateId,
        name,
        description: description || undefined,
      });
    } else {
      // Create blank project
      await createProject.mutateAsync({
        name,
        description: description || null,
        category_tags: uniqueTags.length > 0 ? uniqueTags : undefined,
      });
    }

    setOpen(false);
    setName("");
    setDescription("");
    setTags([]);
    setSelectedTemplateId(null);
  };

  const handleOpenImportWithData = async (
    jobId: string,
    password: string,
    filename: string
  ) => {
    try {
      // Get the file blob from the export API
      const response = await fetch(
        `${
          env.API_BASE_URL
        }/export/download/${jobId}`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("penflow_token")}`,
          },
        }
      );

      if (!response.ok) throw new Error("Failed to fetch export file");

      const blob = await response.blob();
      const file = new File([blob], filename, {
        type: "application/x-penflow-project",
      });

      setImportInitialData({ file, password });
      setProjectImportOpen(true);
    } catch (error) {
      console.error("Failed to prepare import:", error);
      // Fall back to manual flow
      setProjectImportOpen(true);
    }
  };

  const handleEditProject = async () => {
    if (!selectedProject || !name.trim()) return;

    // Remove any duplicate tags (case-insensitive)
    const uniqueTags = Array.from(
      new Set(tags.map((tag) => tag.toLowerCase()))
    ).map((lowerTag) => tags.find((tag) => tag.toLowerCase() === lowerTag)!);

    await updateProject.mutateAsync({
      id: selectedProject.id,
      name,
      description: description || null,
      category_tags: uniqueTags,
    });

    setEditOpen(false);
    setSelectedProject(null);
    setName("");
    setDescription("");
    setTags([]);
  };

  const handleDeleteProject = async () => {
    if (!selectedProject) return;

    await deleteProject.mutateAsync(selectedProject.id);

    setDeleteOpen(false);
    setSelectedProject(null);
  };

  const openEditDialog = (project: any) => {
    setSelectedProject(project);
    setName(project.name);
    setDescription(project.description || "");
    setTags(project.category_tags || []);
    setEditOpen(true);
  };

  const openDeleteDialog = (project: any) => {
    setSelectedProject(project);
    setDeleteOpen(true);
  };

  const openCreateTemplateDialog = (project: any) => {
    setSelectedProject(project);
    setCreateTemplateOpen(true);
  };

  const toggleProjectSelection = (projectId: string) => {
    const newSelection = new Set(selectedProjects);
    if (newSelection.has(projectId)) {
      newSelection.delete(projectId);
    } else {
      newSelection.add(projectId);
    }
    setSelectedProjects(newSelection);
  };

  const selectAll = () => {
    const allProjectIds = new Set(filteredProjects.map((p) => p.id));
    setSelectedProjects(allProjectIds);
  };

  const deselectAll = () => {
    setSelectedProjects(new Set());
  };

  const toggleSelectionMode = () => {
    setSelectionMode(!selectionMode);
    if (selectionMode) {
      setSelectedProjects(new Set());
    }
  };

  const handleBulkDelete = async () => {
    try {
      const projectIds = Array.from(selectedProjects);
      await bulkDeleteProjects.mutateAsync(projectIds);
      setBulkDeleteOpen(false);
      setSelectedProjects(new Set());
      setSelectionMode(false);
    } catch (error) {
      console.error("Bulk delete error:", error);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6 p-8">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 flex-1 max-w-md" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {[...Array(8)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <Skeleton className="h-5 w-3/4 mb-2" />
                <Skeleton className="h-3 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-8">
      <div className="flex items-center gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search projects..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Sort Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline">
              {sortOption === "date_desc" || sortOption === "name_desc" ? (
                <ArrowDown className="h-4 w-4" />
              ) : (
                <ArrowUp className="h-4 w-4" />
              )}
              <span>
                {sortOption === "date_desc"
                  ? "Newest"
                  : sortOption === "date_asc"
                  ? "Oldest"
                  : sortOption === "name_asc"
                  ? "A-Z"
                  : "Z-A"}
              </span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Sort by</DropdownMenuLabel>
            <DropdownMenuItem onClick={() => setSortOption("date_desc")}>
              <Calendar className="h-4 w-4" />
              Newest First
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setSortOption("date_asc")}>
              <Calendar className="h-4 w-4" />
              Oldest First
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setSortOption("name_asc")}>
              <ArrowUp className="h-4 w-4" />
              Name (A-Z)
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setSortOption("name_desc")}>
              <ArrowDown className="h-4 w-4" />
              Name (Z-A)
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Selection Mode Button */}
        <Button
          variant={selectionMode ? "default" : "outline"}
          onClick={toggleSelectionMode}
        >
          {selectionMode ? (
            <>
              <X className="h-4 w-4" />
              Cancel
            </>
          ) : (
            <>
              <CheckSquare className="h-4 w-4" />
              Select
            </>
          )}
        </Button>

        {/* Import Options */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline">
              <Upload className="h-4 w-4" />
              Import
              <ChevronDown className="ml-2 h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Import Projects</DropdownMenuLabel>
            <DropdownMenuItem onClick={() => setProjectImportOpen(true)}>
              <FileUp className="h-4 w-4" />
              Import Project File
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>Legacy Import</DropdownMenuLabel>
            <DropdownMenuItem onClick={() => setImportOpen(true)}>
              <Upload className="h-4 w-4" />
              Import Legacy Project
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Export Options */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline">
              <Download className="h-4 w-4" />
              Export
              <ChevronDown className="ml-2 h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setBulkExportOpen(true)}>
              <FolderDown className="h-4 w-4" />
              Export All Projects
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>
              Individual export via project menu ↓
            </DropdownMenuLabel>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* New Project Button */}
        <Button onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" />
          New Project
        </Button>
        <Dialog
          open={open}
          onOpenChange={(isOpen) => {
            setOpen(isOpen);
            if (!isOpen) {
              setName("");
              setDescription("");
              setTags([]);
              setSelectedTemplateId(null);
            }
          }}
        >
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Create New Project</DialogTitle>
              <DialogDescription>
                Start a new cybersecurity assessment project
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Project Name</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Web App Security Assessment"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description (optional)</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Brief description of the project"
                  rows={3}
                />
              </div>
              <div className="space-y-2">
                <Label>Create from Template (optional)</Label>
                <Popover
                  open={templateSearchOpen}
                  onOpenChange={setTemplateSearchOpen}
                >
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={templateSearchOpen}
                      className="w-full justify-between"
                    >
                      {selectedTemplateId ? (
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4" />
                          {
                            templates?.find((t) => t.id === selectedTemplateId)
                              ?.name
                          }
                        </div>
                      ) : (
                        "Select a template (optional)..."
                      )}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[462px] p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Search templates..." />
                      <CommandList className="max-h-[200px]">
                        <CommandEmpty>No templates found.</CommandEmpty>
                        <CommandGroup>
                          {templates?.map((template) => (
                            <CommandItem
                              key={template.id}
                              value={template.name}
                              onSelect={() => {
                                setSelectedTemplateId(
                                  selectedTemplateId === template.id
                                    ? null
                                    : template.id
                                );
                                setTemplateSearchOpen(false);
                              }}
                            >
                              <Check
                                className={cn(
                                  "h-4 w-4 shrink-0",
                                  selectedTemplateId === template.id
                                    ? "opacity-100"
                                    : "opacity-0"
                                )}
                              />
                              <div className="flex-1 min-w-0">
                                <div className="font-medium truncate">
                                  {template.name}
                                </div>
                                {template.description && (
                                  <div className="text-xs text-muted-foreground truncate">
                                    {template.description}
                                  </div>
                                )}
                              </div>
                              <div className="text-xs text-muted-foreground ml-2 shrink-0">
                                {template.node_count || 0} nodes
                              </div>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
                {selectedTemplateId && (
                  <p className="text-xs text-muted-foreground">
                    The project will include all nodes, connections, and
                    configurations from the selected template.
                  </p>
                )}
              </div>
              {!selectedTemplateId && (
                <div className="space-y-2">
                  <Label>Category Tags</Label>
                  <TagInput
                    value={tags}
                    onChange={setTags}
                    suggestions={tagSuggestions}
                    placeholder="Add tags to categorize your project..."
                  />
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleCreateProject}
                disabled={
                  !name.trim() ||
                  createProject.isPending ||
                  createProjectFromTemplate.isPending
                }
              >
                {createProject.isPending || createProjectFromTemplate.isPending
                  ? "Creating..."
                  : "Create Project"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Selection Mode Toolbar */}
      {selectionMode && (
        <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg border mb-4">
          <div className="flex items-center gap-4">
            <span className="text-sm font-medium">
              {selectedProjects.size} of {filteredProjects.length} selected
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={selectAll}
                disabled={selectedProjects.size === filteredProjects.length}
                className="font-medium"
              >
                Select All
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={deselectAll}
                disabled={selectedProjects.size === 0}
                className="font-medium"
              >
                Deselect All
              </Button>
            </div>
          </div>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => setBulkDeleteOpen(true)}
            disabled={selectedProjects.size === 0}
          >
            <Trash2 className="h-4 w-4" />
            Delete Selected ({selectedProjects.size})
          </Button>
        </div>
      )}

      {/* Edit Project Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Project</DialogTitle>
            <DialogDescription>Update project details</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Project Name</Label>
              <Input
                id="edit-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Project name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-description">Description</Label>
              <Textarea
                id="edit-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Project description"
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label>Category Tags</Label>
              <TagInput
                value={tags}
                onChange={setTags}
                suggestions={tagSuggestions}
                placeholder="Update project tags..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleEditProject}
              disabled={!name.trim() || updateProject.isPending}
            >
              {updateProject.isPending ? "Updating..." : "Update Project"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Project</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{selectedProject?.name}"? This
              action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteProject}
              disabled={deleteProject.isPending}
            >
              {deleteProject.isPending ? "Deleting..." : "Delete Project"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {filteredProjects?.map((project) => (
          <Card
            key={project.id}
            className={`group hover:shadow-lg transition-all duration-300 hover:border-primary/20 hover:-translate-y-1 cursor-pointer relative overflow-hidden py-0 ${
              selectionMode && selectedProjects.has(project.id)
                ? "ring-2 ring-primary"
                : ""
            }`}
            onClick={() => {
              if (selectionMode) {
                toggleProjectSelection(project.id);
              }
            }}
          >
            {/* Subtle background gradient */}
            <div className="absolute inset-0 bg-gradient-to-br from-primary/3 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

            <CardContent className="p-6 relative">
              {/* Selection Checkbox */}
              {selectionMode && (
                <div className="absolute top-4 right-4 z-10">
                  <div
                    className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors ${
                      selectedProjects.has(project.id)
                        ? "bg-primary border-primary"
                        : "bg-background border-muted-foreground hover:border-primary"
                    }`}
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleProjectSelection(project.id);
                    }}
                  >
                    {selectedProjects.has(project.id) && (
                      <CheckSquare className="h-2.5 w-2.5 text-primary-foreground" />
                    )}
                  </div>
                </div>
              )}
              {/* Header with title and actions */}
              <div className="flex items-start justify-between mb-4">
                <Link
                  to={selectionMode ? "#" : `/projects/${project.id}`}
                  className="flex-1 min-w-0"
                  onClick={(e) => {
                    if (selectionMode) {
                      e.preventDefault();
                      toggleProjectSelection(project.id);
                    }
                  }}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <div className="p-1.5 rounded-md bg-primary/10 group-hover:bg-primary/15 transition-colors">
                      <FolderOpen className="h-4 w-4 text-primary" />
                    </div>
                    <h3 className="font-semibold text-base truncate group-hover:text-primary transition-colors">
                      {project.name}
                    </h3>
                  </div>
                </Link>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => openEditDialog(project)}>
                      <Edit className="h-4 w-4" />
                      Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => {
                        setProgressProject({
                          id: project.id,
                          name: project.name,
                        });
                        setProgressModalOpen(true);
                      }}
                    >
                      <Activity className="h-4 w-4" />
                      View Progress
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => {
                        setSelectedProject(project);
                        setExportOpen(true);
                      }}
                    >
                      <Download className="h-4 w-4" />
                      Export
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => openCreateTemplateDialog(project)}
                    >
                      <FileUp className="h-4 w-4" />
                      Create Template
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="text-destructive"
                      onClick={() => openDeleteDialog(project)}
                    >
                      <Trash2 className="h-4 w-4" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              <Link
                to={selectionMode ? undefined : `/projects/${project.id}`}
                className="block"
                onClick={(e) => {
                  if (selectionMode) {
                    e.preventDefault();
                    toggleProjectSelection(project.id);
                  }
                }}
              >
                {/* Description */}
                <p className="text-sm text-muted-foreground line-clamp-2 mb-4 min-h-[2.5rem]">
                  {project.description || "No description provided"}
                </p>

                {/* Project Stats */}
                <div className="flex items-center gap-4 mb-4 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <GitBranch className="h-3 w-3" />
                    <span>{project.node_count || 0} nodes</span>
                  </div>
                  {project.context_count !== undefined &&
                    project.context_count > 0 && (
                      <div className="flex items-center gap-1">
                        <Package className="h-3 w-3" />
                        <span>{project.context_count} contexts</span>
                      </div>
                    )}
                  {project.created_at && (
                    <div className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      <span>
                        {new Date(project.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  )}
                </div>

                {/* Tags */}
                {project.category_tags && project.category_tags.length > 0 && (
                  <div className="flex gap-1.5 flex-wrap mb-4">
                    {project.category_tags.slice(0, 3).map((tag) => (
                      <span
                        key={tag}
                        className="text-xs px-2 py-1 rounded-full bg-secondary/80 text-secondary-foreground border"
                      >
                        {tag}
                      </span>
                    ))}
                    {project.category_tags.length > 3 && (
                      <span className="text-xs px-2 py-1 text-muted-foreground bg-muted/50 rounded-full border">
                        +{project.category_tags.length - 3}
                      </span>
                    )}
                  </div>
                )}

                {/* Footer with dates and action */}
                <div className="flex items-center justify-between pt-4 border-t border-border/60">
                  <div className="flex flex-col gap-1 text-xs text-muted-foreground">
                    {project.updated_at && (
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        <span>
                          Updated{" "}
                          {new Date(project.updated_at).toLocaleDateString()}
                        </span>
                      </div>
                    )}
                    {project.created_at && (
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        <span>
                          Created{" "}
                          {new Date(project.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-1 text-xs text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                    <span>Open</span>
                    <ArrowRight className="h-3 w-3" />
                  </div>
                </div>
              </Link>
            </CardContent>
          </Card>
        ))}

        {filteredProjects?.length === 0 && searchQuery && (
          <div className="col-span-full text-center py-12">
            <p className="text-muted-foreground">
              No projects found matching "{searchQuery}"
            </p>
          </div>
        )}

        {(!projects || (projects.length === 0 && !searchQuery)) && (
          <Card
            className="border-dashed cursor-pointer hover:bg-muted/20 transition-colors"
            onClick={() => setOpen(true)}
          >
            <CardContent className="flex items-center justify-center p-5 h-[140px]">
              <div className="text-center">
                <Plus className="h-6 w-6 mx-auto mb-1 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  Create your first project
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Create Template from Project Dialog */}
      {selectedProject && (
        <CreateTemplateFromProjectDialog
          isOpen={createTemplateOpen}
          onClose={() => setCreateTemplateOpen(false)}
          projectId={selectedProject.id}
          projectName={selectedProject.name}
        />
      )}

      {/* Legacy Import Modal */}
      <LegacyImportModal
        isOpen={importOpen}
        onClose={() => setImportOpen(false)}
      />

      {selectedProject && (
        <ProjectExportDialog
          open={exportOpen}
          onOpenChange={setExportOpen}
          projectId={selectedProject.id}
          projectName={selectedProject.name}
          onOpenImportWithData={handleOpenImportWithData}
        />
      )}

      <ProjectImportDialog
        open={projectImportOpen}
        onOpenChange={(open) => {
          setProjectImportOpen(open);
          if (!open) {
            setImportInitialData(null);
          }
        }}
        onImportComplete={() => {
          // Refetch projects will happen automatically via React Query
        }}
        initialFile={importInitialData?.file}
        initialPassword={importInitialData?.password}
      />

      {/* Bulk Delete Confirmation Dialog */}
      <Dialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Selected Projects</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete {selectedProjects.size} selected
              project{selectedProjects.size !== 1 ? "s" : ""}? This action
              cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkDeleteOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleBulkDelete}
              disabled={bulkDeleteProjects.isPending}
            >
              {bulkDeleteProjects.isPending
                ? "Deleting..."
                : `Delete ${selectedProjects.size} Projects`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <BulkExportDialog
        open={bulkExportOpen}
        onOpenChange={setBulkExportOpen}
        items={filteredProjects.map((p) => ({
          id: p.id,
          name: p.name,
          description: p.description || undefined,
          type: "project" as const,
        }))}
        type="projects"
      />

      {/* Progress Modal */}
      {progressProject && (
        <ProjectProgressModal
          open={progressModalOpen}
          onOpenChange={setProgressModalOpen}
          projectId={progressProject.id}
          projectName={progressProject.name}
        />
      )}
    </div>
  );
}
