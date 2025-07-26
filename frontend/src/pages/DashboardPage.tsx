import { useProjects } from "@/hooks/api/useProjects";
import { useTemplates } from "@/hooks/api/useTemplates";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  FolderOpen,
  FileText,
  GitBranch,
  Plus,
  ArrowRight,
  Clock,
  Tag,
  Upload,
  ChevronDown,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { useState } from "react";
import { ProjectImportDialog } from "@/components/export/ProjectImportDialog";
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
import { TagInput } from "@/components/TagInput";
import { useCategoryTags } from "@/hooks/api/useCategoryTags";
import { useCreateProject } from "@/hooks/api/useProjects";
import { useCreateTemplate } from "@/hooks/api/useTemplates";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from "@/components/ui/command";

export function DashboardPage() {
  const navigate = useNavigate();
  const [showImportModal, setShowImportModal] = useState(false);
  const [showCreateProjectDialog, setShowCreateProjectDialog] = useState(false);
  const [showCreateTemplateDialog, setShowCreateTemplateDialog] =
    useState(false);
  const [projectName, setProjectName] = useState("");
  const [projectDescription, setProjectDescription] = useState("");
  const [projectTags, setProjectTags] = useState<string[]>([]);
  const [templateName, setTemplateName] = useState("");
  const [templateDescription, setTemplateDescription] = useState("");
  const [templateTags, setTemplateTags] = useState<string[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(
    null
  );
  const [projectSearchOpen, setProjectSearchOpen] = useState(false);

  const createProject = useCreateProject();
  const createTemplate = useCreateTemplate();
  const { data: categoryTags } = useCategoryTags();

  const {
    data: projects,
    isLoading: projectsLoading,
    error: projectsError,
  } = useProjects();
  const {
    data: templates,
    isLoading: templatesLoading,
    error: templatesError,
  } = useTemplates();

  // Calculate statistics
  const totalProjects = projects?.length || 0;
  const totalTemplates = templates?.length || 0;

  // Get recent projects (last 5)
  const recentProjects = projects?.slice(0, 5) || [];

  // Get all unique category tags
  const allCategoryTags = new Set<string>();
  projects?.forEach((p) =>
    p.category_tags?.forEach((tag) => allCategoryTags.add(tag))
  );
  templates?.forEach((t) =>
    t.category_tags?.forEach((tag) => allCategoryTags.add(tag))
  );
  const topTags = Array.from(allCategoryTags).slice(0, 5);
  const tagSuggestions = categoryTags?.map((tag) => tag.name) || [];

  const handleCreateProject = async () => {
    if (!projectName.trim()) return;

    // Remove any duplicate tags (case-insensitive)
    const uniqueTags = Array.from(
      new Set(projectTags.map((tag) => tag.toLowerCase()))
    ).map(
      (lowerTag) => projectTags.find((tag) => tag.toLowerCase() === lowerTag)!
    );

    await createProject.mutateAsync({
      name: projectName,
      description: projectDescription || null,
      category_tags: uniqueTags.length > 0 ? uniqueTags : undefined,
    });

    setShowCreateProjectDialog(false);
    setProjectName("");
    setProjectDescription("");
    setProjectTags([]);
  };

  const handleCreateTemplate = async () => {
    if (!templateName.trim()) return;

    const uniqueTags = Array.from(
      new Set(templateTags.map((tag) => tag.toLowerCase()))
    ).map(
      (lowerTag) => templateTags.find((tag) => tag.toLowerCase() === lowerTag)!
    );

    await createTemplate.mutateAsync({
      name: templateName,
      description: templateDescription || null,
      category_tags: uniqueTags,
      source_project_id: selectedProjectId || null,
    });

    setShowCreateTemplateDialog(false);
    setTemplateName("");
    setTemplateDescription("");
    setTemplateTags([]);
    setSelectedProjectId(null);
  };

  return (
    <div className="p-8 space-y-8">
      {/* Statistics Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* Projects Card */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Projects
            </CardTitle>
            <FolderOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {projectsLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <>
                <div className="text-2xl font-bold">{totalProjects}</div>
                <p className="text-xs text-muted-foreground">
                  {totalProjects === 1
                    ? "1 active project"
                    : `${totalProjects} active projects`}
                </p>
              </>
            )}
          </CardContent>
        </Card>

        {/* Templates Card */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Templates
            </CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {templatesLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <>
                <div className="text-2xl font-bold">{totalTemplates}</div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Total Nodes Card */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Nodes</CardTitle>
            <GitBranch className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <TotalNodesCount projects={projects} />
          </CardContent>
        </Card>

        {/* Category Tags Card */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Top Categories
            </CardTitle>
            <Tag className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-1">
              {topTags.length > 0 ? (
                topTags.map((tag) => (
                  <Badge key={tag} variant="secondary" className="text-xs">
                    {tag}
                  </Badge>
                ))
              ) : (
                <p className="text-xs text-muted-foreground">
                  No categories yet
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
          <CardDescription>Get started with common tasks</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <Button
              className="h-auto flex-col gap-2 p-4"
              variant="outline"
              onClick={() => setShowCreateProjectDialog(true)}
            >
              <Plus className="h-5 w-5" />
              <span>Create Project</span>
            </Button>
            <Button
              className="h-auto flex-col gap-2 p-4"
              variant="outline"
              onClick={() => setShowCreateTemplateDialog(true)}
            >
              <FileText className="h-5 w-5" />
              <span>Create Template</span>
            </Button>
            <Button
              className="h-auto flex-col gap-2 p-4"
              variant="outline"
              onClick={() => setShowImportModal(true)}
            >
              <Upload className="h-5 w-5" />
              <span>Import Project</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-8 lg:grid-cols-2">
        {/* Recent Projects */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Recent Projects</CardTitle>
                <CardDescription>
                  Your latest cybersecurity mind maps
                </CardDescription>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate("/projects")}
              >
                View all
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {projectsLoading ? (
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => (
                  <Skeleton key={i} className="h-20 w-full" />
                ))}
              </div>
            ) : recentProjects.length > 0 ? (
              <ScrollArea className="h-[400px] pr-4">
                <div className="space-y-4">
                  {recentProjects.map((project) => (
                    <ProjectCard key={project.id} project={project} />
                  ))}
                </div>
              </ScrollArea>
            ) : (
              <div className="text-center py-8">
                <FolderOpen className="mx-auto h-12 w-12 text-muted-foreground/50" />
                <p className="mt-2 text-sm text-muted-foreground">
                  No projects yet
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-4"
                  onClick={() => navigate("/projects")}
                >
                  Create your first project
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Templates Gallery */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Template Gallery</CardTitle>
                <CardDescription>
                  Reusable attack patterns and workflows
                </CardDescription>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate("/templates")}
              >
                View all
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {templatesLoading ? (
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => (
                  <Skeleton key={i} className="h-20 w-full" />
                ))}
              </div>
            ) : templates && templates.length > 0 ? (
              <ScrollArea className="h-[400px] pr-4">
                <div className="grid gap-4">
                  {templates.slice(0, 6).map((template) => (
                    <TemplateCard key={template.id} template={template} />
                  ))}
                </div>
              </ScrollArea>
            ) : (
              <div className="text-center py-8">
                <FileText className="mx-auto h-12 w-12 text-muted-foreground/50" />
                <p className="mt-2 text-sm text-muted-foreground">
                  No templates yet
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-4"
                  onClick={() => navigate("/templates")}
                >
                  Create your first template
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Import Modal */}
      <ProjectImportDialog
        open={showImportModal}
        onOpenChange={setShowImportModal}
        onImportComplete={() => {
          // Refetch projects will happen automatically via React Query
        }}
      />

      {/* Create Project Dialog */}
      <Dialog
        open={showCreateProjectDialog}
        onOpenChange={(isOpen) => {
          setShowCreateProjectDialog(isOpen);
          if (!isOpen) {
            setProjectName("");
            setProjectDescription("");
            setProjectTags([]);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Project</DialogTitle>
            <DialogDescription>
              Start a new cybersecurity assessment project
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="project-name">Project Name</Label>
              <Input
                id="project-name"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                placeholder="e.g., Web App Security Assessment"
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
                placeholder="Brief description of the project"
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label>Category Tags</Label>
              <TagInput
                value={projectTags}
                onChange={setProjectTags}
                suggestions={tagSuggestions}
                placeholder="Add tags to categorize your project..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowCreateProjectDialog(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateProject}
              disabled={!projectName.trim() || createProject.isPending}
            >
              {createProject.isPending ? "Creating..." : "Create Project"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Template Dialog */}
      <Dialog
        open={showCreateTemplateDialog}
        onOpenChange={(isOpen) => {
          setShowCreateTemplateDialog(isOpen);
          if (!isOpen) {
            setTemplateName("");
            setTemplateDescription("");
            setTemplateTags([]);
            setSelectedProjectId(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Template</DialogTitle>
            <DialogDescription>
              Create a reusable template for future projects
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="template-name">Template Name</Label>
              <Input
                id="template-name"
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                placeholder="e.g., OWASP Top 10 Assessment"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="template-description">
                Description (optional)
              </Label>
              <Textarea
                id="template-description"
                value={templateDescription}
                onChange={(e) => setTemplateDescription(e.target.value)}
                placeholder="Brief description of the template"
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
                    <ChevronDown className="ml-2 h-4 w-4 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-full p-0">
                  <Command>
                    <CommandInput placeholder="Search projects..." />
                    <CommandEmpty>No project found.</CommandEmpty>
                    <CommandGroup>
                      {projects?.map((project) => (
                        <CommandItem
                          key={project.id}
                          value={project.name}
                          onSelect={() => {
                            setSelectedProjectId(project.id);
                            setProjectSearchOpen(false);
                          }}
                        >
                          <FolderOpen className=" h-4 w-4" />
                          {project.name}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </Command>
                </PopoverContent>
              </Popover>
              {selectedProjectId && (
                <p className="text-sm text-muted-foreground mt-2">
                  The template will include all nodes, contexts, and structure
                  from the selected project.
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Category Tags</Label>
              <TagInput
                value={templateTags}
                onChange={setTemplateTags}
                suggestions={tagSuggestions}
                placeholder="Add tags to categorize your template..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowCreateTemplateDialog(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateTemplate}
              disabled={!templateName.trim() || createTemplate.isPending}
            >
              {createTemplate.isPending ? "Creating..." : "Create Template"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Component to calculate total nodes across all projects
function TotalNodesCount({ projects }: { projects: any[] | undefined }) {
  const totalNodes =
    projects?.reduce((sum, project) => sum + (project.node_count || 0), 0) || 0;

  if (!projects) {
    return <Skeleton className="h-8 w-16" />;
  }

  return (
    <>
      <div className="text-2xl font-bold">{totalNodes}</div>
      <p className="text-xs text-muted-foreground">Across all projects</p>
    </>
  );
}

// Project Card Component
function ProjectCard({ project }: { project: any }) {
  const navigate = useNavigate();
  const nodeCount = project.node_count || 0;

  return (
    <div
      className="group relative rounded-lg border p-4 hover:bg-accent cursor-pointer transition-colors"
      onClick={() => navigate(`/projects/${project.id}`)}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <h3 className="font-semibold line-clamp-1">{project.name}</h3>
          {project.description && (
            <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
              {project.description}
            </p>
          )}
          <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <GitBranch className="h-3 w-3" />
              {nodeCount} nodes
            </span>
            {project.updated_at && (
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {formatDistanceToNow(new Date(project.updated_at), {
                  addSuffix: true,
                })}
              </span>
            )}
          </div>
          {project.category_tags && project.category_tags.length > 0 && (
            <div className="flex gap-1 mt-2 flex-wrap">
              {project.category_tags.map((tag: string) => (
                <Badge key={tag} variant="secondary" className="text-xs">
                  {tag}
                </Badge>
              ))}
            </div>
          )}
        </div>
        <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
    </div>
  );
}

// Template Card Component
function TemplateCard({ template }: { template: any }) {
  const navigate = useNavigate();

  return (
    <div
      className="group relative rounded-lg border p-4 hover:bg-accent cursor-pointer transition-colors"
      onClick={() => navigate(`/templates/${template.id}`)}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <h3 className="font-semibold line-clamp-1">{template.name}</h3>
          {template.description && (
            <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
              {template.description}
            </p>
          )}
          {template.category_tags && template.category_tags.length > 0 && (
            <div className="flex gap-1 mt-2 flex-wrap">
              {template.category_tags.map((tag: string) => (
                <Badge key={tag} variant="outline" className="text-xs">
                  {tag}
                </Badge>
              ))}
            </div>
          )}
        </div>
        <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
    </div>
  );
}
