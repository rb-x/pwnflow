import { useState, useMemo } from "react";
import {
  Plus,
  Search,
  MoreHorizontal,
  Trash2,
  Edit,
  Copy,
  FileText,
  Sparkles,
  ExternalLink,
  Download,
  FileUp,
  ChevronDown,
  FolderDown,
  Upload,
  GitBranch,
  Package,
  ArrowRight,
  ArrowDown,
  ArrowUp,
  CheckSquare,
  X,
} from "lucide-react";
import { Link } from "react-router-dom";
import {
  useTemplates,
  useCreateTemplate,
  useUpdateTemplate,
  useDeleteTemplate,
  useBulkDeleteTemplates,
  useCreateProjectFromTemplate,
} from "@/hooks/api/useTemplates";
import { useCategoryTags } from "@/hooks/api/useCategoryTags";
import { useProjects } from "@/hooks/api/useProjects";
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
import { Check, ChevronsUpDown, FolderOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import { TemplateExportDialog } from "@/components/export/TemplateExportDialog";
import { TemplateImportDialog } from "@/components/export/TemplateImportDialog";
import { BulkExportDialog } from "@/components/export/BulkExportDialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { TagInput } from "@/components/TagInput";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function TemplatesPage() {
  const { data: templates, isLoading } = useTemplates();
  const { data: categoryTags } = useCategoryTags();
  const { data: projects } = useProjects();
  const createTemplate = useCreateTemplate();
  const updateTemplate = useUpdateTemplate();
  const deleteTemplate = useDeleteTemplate();
  const bulkDeleteTemplates = useBulkDeleteTemplates();
  const createProjectFromTemplate = useCreateProjectFromTemplate();

  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [cloneOpen, setCloneOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [bulkExportOpen, setBulkExportOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<any>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [projectName, setProjectName] = useState("");
  const [projectDescription, setProjectDescription] = useState("");
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(
    null
  );
  const [projectSearchOpen, setProjectSearchOpen] = useState(false);
  const [sortOption, setSortOption] = useState<
    "date_desc" | "date_asc" | "name_asc" | "name_desc"
  >("date_desc");
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedTemplates, setSelectedTemplates] = useState<Set<string>>(
    new Set()
  );
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);

  const tagSuggestions = categoryTags?.map((tag) => tag.name) || [];

  const filteredTemplates = useMemo(() => {
    let filtered = templates || [];

    // Apply search filter
    if (searchQuery) {
      filtered = filtered.filter(
        (template) =>
          template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          template.description
            ?.toLowerCase()
            .includes(searchQuery.toLowerCase()) ||
          template.category_tags.some((tag) =>
            tag.toLowerCase().includes(searchQuery.toLowerCase())
          )
      );
    }

    // Apply sorting
    filtered = [...filtered].sort((a, b) => {
      switch (sortOption) {
        case "date_desc":
          return b.name.localeCompare(a.name); // Templates don't have created_at, so sort by name
        case "date_asc":
          return a.name.localeCompare(b.name);
        case "name_asc":
          return a.name.localeCompare(b.name);
        case "name_desc":
          return b.name.localeCompare(a.name);
        default:
          return 0;
      }
    });

    return filtered;
  }, [templates, searchQuery, sortOption]);

  const handleCreateTemplate = async () => {
    if (!name.trim()) return;

    const uniqueTags = Array.from(
      new Set(tags.map((tag) => tag.toLowerCase()))
    ).map((lowerTag) => tags.find((tag) => tag.toLowerCase() === lowerTag)!);

    await createTemplate.mutateAsync({
      name,
      description: description || null,
      source_project_id: selectedProjectId || undefined,
      category_tags: uniqueTags.length > 0 ? uniqueTags : undefined,
    });

    setCreateOpen(false);
    setName("");
    setDescription("");
    setTags([]);
    setSelectedProjectId(null);
  };

  const handleEditTemplate = async () => {
    if (!selectedTemplate || !name.trim()) return;

    const uniqueTags = Array.from(
      new Set(tags.map((tag) => tag.toLowerCase()))
    ).map((lowerTag) => tags.find((tag) => tag.toLowerCase() === lowerTag)!);

    await updateTemplate.mutateAsync({
      id: selectedTemplate.id,
      name,
      description: description || null,
      category_tags: uniqueTags,
    });

    setEditOpen(false);
    setSelectedTemplate(null);
    setName("");
    setDescription("");
    setTags([]);
  };

  const handleDeleteTemplate = async () => {
    if (!selectedTemplate) return;

    await deleteTemplate.mutateAsync(selectedTemplate.id);

    setDeleteOpen(false);
    setSelectedTemplate(null);
  };

  const handleCloneToProject = async () => {
    if (!selectedTemplate || !projectName.trim()) return;

    await createProjectFromTemplate.mutateAsync({
      templateId: selectedTemplate.id,
      name: projectName,
      description: projectDescription || undefined,
    });

    setCloneOpen(false);
    setSelectedTemplate(null);
    setProjectName("");
    setProjectDescription("");
  };

  const openEditDialog = (template: any) => {
    setSelectedTemplate(template);
    setName(template.name);
    setDescription(template.description || "");
    setTags(template.category_tags || []);
    setEditOpen(true);
  };

  const openDeleteDialog = (template: any) => {
    setSelectedTemplate(template);
    setDeleteOpen(true);
  };

  const openCloneDialog = (template: any) => {
    setSelectedTemplate(template);
    setProjectName(`${template.name} - Project`);
    setProjectDescription(template.description || "");
    setCloneOpen(true);
  };

  const toggleTemplateSelection = (templateId: string) => {
    const newSelection = new Set(selectedTemplates);
    if (newSelection.has(templateId)) {
      newSelection.delete(templateId);
    } else {
      newSelection.add(templateId);
    }
    setSelectedTemplates(newSelection);
  };

  const selectAll = () => {
    const allTemplateIds = new Set(filteredTemplates.map((t) => t.id));
    setSelectedTemplates(allTemplateIds);
  };

  const deselectAll = () => {
    setSelectedTemplates(new Set());
  };

  const toggleSelectionMode = () => {
    setSelectionMode(!selectionMode);
    if (selectionMode) {
      setSelectedTemplates(new Set());
    }
  };

  const handleBulkDelete = async () => {
    try {
      const templateIds = Array.from(selectedTemplates);
      await bulkDeleteTemplates.mutateAsync(templateIds);
      setBulkDeleteOpen(false);
      setSelectedTemplates(new Set());
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
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-6 w-3/4 mb-2" />
                <Skeleton className="h-4 w-full" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-20" />
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
            placeholder="Search templates..."
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
                {sortOption === "name_asc"
                  ? "A-Z"
                  : sortOption === "name_desc"
                  ? "Z-A"
                  : sortOption === "date_desc"
                  ? "Newest"
                  : "Oldest"}
              </span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Sort by</DropdownMenuLabel>
            <DropdownMenuItem onClick={() => setSortOption("name_asc")}>
              <ArrowUp className=" h-4 w-4" />
              Name (A-Z)
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setSortOption("name_desc")}>
              <ArrowDown className=" h-4 w-4" />
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
              <Upload className=" h-4 w-4" />
              Import
              <ChevronDown className="ml-2 h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Import Templates</DropdownMenuLabel>
            <DropdownMenuItem onClick={() => setImportOpen(true)}>
              <FileUp className=" h-4 w-4" />
              Import Template File
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Export Options */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline">
              <Download className=" h-4 w-4" />
              Export
              <ChevronDown className="ml-2 h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setBulkExportOpen(true)}>
              <FolderDown className=" h-4 w-4" />
              Export All Templates
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>
              Individual export via template menu ↓
            </DropdownMenuLabel>
          </DropdownMenuContent>
        </DropdownMenu>
        <Dialog
          open={createOpen}
          onOpenChange={(isOpen) => {
            setCreateOpen(isOpen);
            if (!isOpen) {
              setName("");
              setDescription("");
              setTags([]);
              setSelectedProjectId(null);
            }
          }}
        >
          <DialogTrigger asChild>
            <Button>
              <Plus className=" h-4 w-4" />
              New Template
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Create New Template</DialogTitle>
              <DialogDescription>
                Create a reusable template for your assessments
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Template Name</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Web Application Security Assessment"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description (optional)</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe what this template includes"
                  rows={3}
                />
              </div>
              <div className="space-y-2">
                <Label>Create from Project (optional)</Label>
                <Popover
                  open={projectSearchOpen}
                  onOpenChange={setProjectSearchOpen}
                >
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={projectSearchOpen}
                      className="w-full justify-between"
                    >
                      {selectedProjectId ? (
                        <div className="flex items-center gap-2">
                          <FolderOpen className="h-4 w-4" />
                          {
                            projects?.find((p) => p.id === selectedProjectId)
                              ?.name
                          }
                        </div>
                      ) : (
                        "Select a project to copy from..."
                      )}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[400px] p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Search projects..." />
                      <CommandList className="max-h-[200px]">
                        <CommandEmpty>No projects found.</CommandEmpty>
                        <CommandGroup>
                          {projects?.map((project) => (
                            <CommandItem
                              key={project.id}
                              value={project.name}
                              onSelect={() => {
                                setSelectedProjectId(
                                  selectedProjectId === project.id
                                    ? null
                                    : project.id
                                );
                                setProjectSearchOpen(false);
                              }}
                            >
                              <Check
                                className={cn(
                                  " h-4 w-4 shrink-0",
                                  selectedProjectId === project.id
                                    ? "opacity-100"
                                    : "opacity-0"
                                )}
                              />
                              <div className="flex-1 min-w-0">
                                <div className="font-medium truncate">
                                  {project.name}
                                </div>
                                {project.description && (
                                  <div className="text-xs text-muted-foreground truncate">
                                    {project.description}
                                  </div>
                                )}
                              </div>
                              <div className="text-xs text-muted-foreground ml-2 shrink-0">
                                {project.node_count || 0} nodes
                              </div>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
                {selectedProjectId && (
                  <p className="text-xs text-muted-foreground">
                    The template will include all nodes, connections, and
                    configurations from the selected project.
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label>Category Tags</Label>
                <TagInput
                  value={tags}
                  onChange={setTags}
                  suggestions={tagSuggestions}
                  placeholder="Add tags to categorize your template..."
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleCreateTemplate}
                disabled={!name.trim() || createTemplate.isPending}
              >
                {createTemplate.isPending ? "Creating..." : "Create Template"}
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
              {selectedTemplates.size} of {filteredTemplates.length} selected
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={selectAll}
                disabled={selectedTemplates.size === filteredTemplates.length}
                className="font-medium"
              >
                Select All
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={deselectAll}
                disabled={selectedTemplates.size === 0}
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
            disabled={selectedTemplates.size === 0}
          >
            <Trash2 className="h-4 w-4 " />
            Delete Selected ({selectedTemplates.size})
          </Button>
        </div>
      )}

      {(!templates || templates.length === 0) && !searchQuery ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="rounded-full bg-muted p-6 mb-4">
              <FileText className="h-12 w-12 text-muted-foreground" />
            </div>
            <h3 className="text-xl font-semibold mb-2">No templates yet</h3>
            <p className="text-muted-foreground text-center max-w-sm mb-6">
              Templates help you quickly start new projects with predefined
              structures and configurations.
            </p>
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className=" h-4 w-4" />
              Create your first template
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredTemplates?.map((template) => (
            <Card
              key={template.id}
              className={`group hover:shadow-lg transition-all duration-300 hover:border-primary/20 hover:-translate-y-1 cursor-pointer relative overflow-hidden py-0 ${
                selectionMode && selectedTemplates.has(template.id)
                  ? "ring-2 ring-primary"
                  : ""
              }`}
              onClick={() => {
                if (selectionMode) {
                  toggleTemplateSelection(template.id);
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
                        selectedTemplates.has(template.id)
                          ? "bg-primary border-primary"
                          : "bg-background border-muted-foreground hover:border-primary"
                      }`}
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleTemplateSelection(template.id);
                      }}
                    >
                      {selectedTemplates.has(template.id) && (
                        <CheckSquare className="h-2.5 w-2.5 text-primary-foreground" />
                      )}
                    </div>
                  </div>
                )}
                {/* Header with title and actions */}
                <div className="flex items-start justify-between mb-4">
                  <Link
                    to={selectionMode ? "#" : `/templates/${template.id}`}
                    className="flex-1 min-w-0"
                    onClick={(e) => {
                      if (selectionMode) {
                        e.preventDefault();
                        toggleTemplateSelection(template.id);
                      }
                    }}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <div className="p-1.5 rounded-md bg-primary/10 group-hover:bg-primary/15 transition-colors">
                        <FileText className="h-4 w-4 text-primary" />
                      </div>
                      <h3 className="font-semibold text-base truncate group-hover:text-primary transition-colors">
                        {template.name}
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
                      <DropdownMenuItem asChild>
                        <Link to={`/templates/${template.id}`}>
                          <ExternalLink className=" h-4 w-4" />
                          View Content
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => openCloneDialog(template)}
                      >
                        <Copy className=" h-4 w-4" />
                        Create Project
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => openEditDialog(template)}
                      >
                        <Edit className=" h-4 w-4" />
                        Edit Details
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => {
                          setSelectedTemplate(template);
                          setExportOpen(true);
                        }}
                      >
                        <Download className=" h-4 w-4" />
                        Export
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-destructive"
                        onClick={() => openDeleteDialog(template)}
                      >
                        <Trash2 className=" h-4 w-4" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                <Link
                  to={selectionMode ? "#" : `/templates/${template.id}`}
                  className="block"
                  onClick={(e) => {
                    if (selectionMode) {
                      e.preventDefault();
                      toggleTemplateSelection(template.id);
                    }
                  }}
                >
                  {/* Description */}
                  <p className="text-sm text-muted-foreground line-clamp-2 mb-4 min-h-[2.5rem]">
                    {template.description || "No description provided"}
                  </p>

                  {/* Template Stats */}
                  <div className="flex items-center gap-4 mb-4 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <GitBranch className="h-3 w-3" />
                      <span>{template.node_count || 0} nodes</span>
                    </div>
                    {template.context_count !== undefined &&
                      template.context_count > 0 && (
                        <div className="flex items-center gap-1">
                          <Package className="h-3 w-3" />
                          <span>{template.context_count} contexts</span>
                        </div>
                      )}
                  </div>

                  {/* Tags */}
                  {template.category_tags &&
                    template.category_tags.length > 0 && (
                      <div className="flex gap-1.5 flex-wrap mb-4">
                        {template.category_tags.slice(0, 3).map((tag) => (
                          <span
                            key={tag}
                            className="text-xs px-2 py-1 rounded-full bg-secondary/80 text-secondary-foreground border"
                          >
                            {tag}
                          </span>
                        ))}
                        {template.category_tags.length > 3 && (
                          <span className="text-xs px-2 py-1 text-muted-foreground bg-muted/50 rounded-full border">
                            +{template.category_tags.length - 3}
                          </span>
                        )}
                      </div>
                    )}

                  {/* Footer with action */}
                  <div className="flex items-center justify-between pt-4 border-t border-border/60">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-xs h-7 px-2"
                      onClick={(e) => {
                        e.preventDefault();
                        openCloneDialog(template);
                      }}
                    >
                      <Sparkles className="h-3 w-3 mr-1" />
                      Create Project
                    </Button>

                    <div className="flex items-center gap-1 text-xs text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                      <span>View</span>
                      <ArrowRight className="h-3 w-3" />
                    </div>
                  </div>
                </Link>
              </CardContent>
            </Card>
          ))}

          {filteredTemplates?.length === 0 && searchQuery && (
            <div className="col-span-full text-center py-12">
              <p className="text-muted-foreground">
                No templates found matching "{searchQuery}"
              </p>
            </div>
          )}
        </div>
      )}

      {/* Edit Template Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Template</DialogTitle>
            <DialogDescription>Update template details</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Template Name</Label>
              <Input
                id="edit-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Template name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-description">Description</Label>
              <Textarea
                id="edit-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Template description"
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label>Category Tags</Label>
              <TagInput
                value={tags}
                onChange={setTags}
                suggestions={tagSuggestions}
                placeholder="Update template tags..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleEditTemplate}
              disabled={!name.trim() || updateTemplate.isPending}
            >
              {updateTemplate.isPending ? "Updating..." : "Update Template"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Template</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{selectedTemplate?.name}"? This
              action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteTemplate}
              disabled={deleteTemplate.isPending}
            >
              {deleteTemplate.isPending ? "Deleting..." : "Delete Template"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Clone to Project Dialog */}
      <Dialog open={cloneOpen} onOpenChange={setCloneOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Project from Template</DialogTitle>
            <DialogDescription>
              Start a new project based on "{selectedTemplate?.name}"
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="project-name">Project Name</Label>
              <Input
                id="project-name"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                placeholder="Enter project name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="project-description">
                Description (optional)
              </Label>
              <Textarea
                id="project-description"
                value={projectDescription}
                onChange={(e) => setProjectDescription(e.target.value)}
                placeholder="Project description"
                rows={3}
              />
            </div>
            <div className="rounded-lg border p-4 bg-muted/30">
              <p className="text-sm text-muted-foreground mb-2">
                This will create a new project with:
              </p>
              <ul className="text-sm space-y-1">
                <li>• All nodes and connections from the template</li>
                <li>• Template's category tags</li>
                <li>
                  • Variables and contexts (sensitive data will be cleared)
                </li>
              </ul>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCloneOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCloneToProject}
              disabled={
                !projectName.trim() || createProjectFromTemplate.isPending
              }
            >
              {createProjectFromTemplate.isPending
                ? "Creating..."
                : "Create Project"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {selectedTemplate && (
        <TemplateExportDialog
          open={exportOpen}
          onOpenChange={setExportOpen}
          templateId={selectedTemplate.id}
          templateName={selectedTemplate.name}
        />
      )}

      <TemplateImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        onImportComplete={() => {
          // Refetch templates will happen automatically via React Query
        }}
      />

      {/* Bulk Delete Confirmation Dialog */}
      <Dialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Selected Templates</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete {selectedTemplates.size} selected
              template{selectedTemplates.size !== 1 ? "s" : ""}? This action
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
              disabled={bulkDeleteTemplates.isPending}
            >
              {bulkDeleteTemplates.isPending
                ? "Deleting..."
                : `Delete ${selectedTemplates.size} Templates`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <BulkExportDialog
        open={bulkExportOpen}
        onOpenChange={setBulkExportOpen}
        items={filteredTemplates.map((t) => ({
          id: t.id,
          name: t.name,
          description: t.description || undefined,
          type: "template" as const,
        }))}
        type="templates"
      />
    </div>
  );
}
