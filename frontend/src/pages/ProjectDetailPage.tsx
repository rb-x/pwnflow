import { useParams, Navigate, useLocation } from "react-router-dom";
import { ReactFlowProvider } from "@xyflow/react";
import { useProject } from "@/hooks/api/useProjects";
import { useTemplate } from "@/hooks/api/useTemplates";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { MindMapEditor } from "@/components/mindmap/MindMapEditor";
import { FolderOpen, GitBranch, FileJson } from "lucide-react";
import { useEffect } from "react";

interface ProjectDetailPageProps {
  isTemplate?: boolean;
  templateId?: string;
}

export function ProjectDetailPage({
  isTemplate = false,
  templateId,
}: ProjectDetailPageProps) {
  const { projectId: routeProjectId } = useParams<{ projectId: string }>();
  const location = useLocation();

  // Use either the passed templateId or the route projectId
  const projectId = isTemplate ? templateId : routeProjectId;

  // Extract node ID from hash (e.g., #node-123)
  const targetNodeId = location.hash.slice(1); // Remove the # symbol

  // Use appropriate hook based on whether it's a template or project
  const {
    data: project,
    isLoading: projectLoading,
    error: projectError,
  } = useProject(!isTemplate ? projectId! : "");
  const {
    data: template,
    isLoading: templateLoading,
    error: templateError,
  } = useTemplate(isTemplate ? projectId! : "");

  // Combine the data
  const data = isTemplate ? template : project;
  const isLoading = isTemplate ? templateLoading : projectLoading;
  const error = isTemplate ? templateError : projectError;

  // Update breadcrumb when project/template loads
  useEffect(() => {
    if (data?.name) {
      // Update the document title to reflect the project/template name
      document.title = `${data.name} - Pwnflow ${
        isTemplate ? "Template" : "Project"
      }`;

      // If you have a breadcrumb context or global state, update it here
      // For now, we'll handle it in the layout component
    }
  }, [data, isTemplate]);

  if (!projectId) {
    return <Navigate to={isTemplate ? "/templates" : "/projects"} replace />;
  }

  if (isLoading) {
    return (
      <div className="space-y-4 p-8">
        <div className="space-y-2">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-96" />
        </div>
        <Skeleton className="h-[600px] w-full rounded-xl" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-[600px] flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">
            {isTemplate ? "Template" : "Project"} not found
          </h2>
          <p className="text-muted-foreground mb-4">
            The {isTemplate ? "template" : "project"} you're looking for doesn't
            exist or you don't have access to it.
          </p>
          <Button onClick={() => window.history.back()} variant="outline">
            Go Back
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full w-full">
      <ReactFlowProvider>
        <MindMapEditor
          projectId={projectId}
          isTemplate={isTemplate}
          initialLayoutDirection={!isTemplate && data ? (data as any).layout_direction : undefined}
          targetNodeId={targetNodeId}
        />
      </ReactFlowProvider>
    </div>
  );
}
