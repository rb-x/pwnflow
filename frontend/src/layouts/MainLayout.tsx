import React from "react";
import { Outlet, useLocation, Link, useParams } from "react-router-dom";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { AppSidebar } from "@/components/app-sidebar";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { useProject } from "@/hooks/api/useProjects";
import { useTemplate } from "@/hooks/api/useTemplates";

export function MainLayout() {
  const location = useLocation();

  // Generate breadcrumbs based on current path
  const pathSegments = location.pathname.split("/").filter(Boolean);

  // Check if we're on a project detail page
  const isProjectDetail =
    pathSegments.length >= 2 &&
    pathSegments[0] === "projects" &&
    pathSegments[1].match(/^[a-f0-9-]{36}$/i);
  const projectId = isProjectDetail ? pathSegments[1] : null;

  // Check if we're on a template detail page
  const isTemplateDetail =
    pathSegments.length >= 2 &&
    pathSegments[0] === "templates" &&
    pathSegments[1].match(/^[a-f0-9-]{36}$/i);
  const templateId = isTemplateDetail ? pathSegments[1] : null;

  // Fetch project data if we're on a project detail page
  const { data: project } = useProject(projectId || "");

  // Fetch template data if we're on a template detail page
  const { data: template } = useTemplate(templateId || "");

  // Map path segments to readable names
  const getSegmentName = (segment: string, index: number) => {
    // Handle special cases
    if (segment.match(/^[a-f0-9-]{36}$/i)) {
      // This is likely a UUID
      if (pathSegments[index - 1] === "projects" && project?.name) {
        return project.name;
      }
      if (pathSegments[index - 1] === "templates" && template?.name) {
        return template.name;
      }
      return "Detail";
    }

    // Capitalize and format segment names
    const nameMap: Record<string, string> = {
      projects: "Projects",
      templates: "Templates",
      settings: "Settings",
      search: "Search",
      dashboard: "Dashboard",
    };

    return (
      nameMap[segment] || segment.charAt(0).toUpperCase() + segment.slice(1)
    );
  };

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset className="relative">
        <SidebarEdgeToggle />
        <header className="flex h-16 shrink-0 items-center gap-2">
          <div className="flex items-center gap-2 px-9">
            <SidebarTrigger className="-ml-1" />

            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem>
                  <BreadcrumbLink asChild>
                    <Link to="/">Home</Link>
                  </BreadcrumbLink>
                </BreadcrumbItem>
                {pathSegments.map((segment, index) => {
                  const isLast = index === pathSegments.length - 1;
                  const path = "/" + pathSegments.slice(0, index + 1).join("/");
                  const name = getSegmentName(segment, index);

                  return (
                    <React.Fragment key={path}>
                      <BreadcrumbSeparator />
                      <BreadcrumbItem>
                        {isLast ? (
                          <BreadcrumbPage>{name}</BreadcrumbPage>
                        ) : (
                          <BreadcrumbLink asChild>
                            <Link to={path}>{name}</Link>
                          </BreadcrumbLink>
                        )}
                      </BreadcrumbItem>
                    </React.Fragment>
                  );
                })}
              </BreadcrumbList>
            </Breadcrumb>
          </div>
        </header>
        <Separator orientation="horizontal" className="" />
        <div className="flex flex-1 flex-col overflow-hidden">
          <Outlet />
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}

function SidebarEdgeToggle() {
  const { state, toggleSidebar } = useSidebar();
  const Icon = state === "collapsed" ? ChevronRight : ChevronLeft;

  return (
    <button
      type="button"
      onClick={toggleSidebar}
      className="absolute top-1/2 -left-2.5 z-40 hidden h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full border border-white/10 bg-sidebar/85 text-white/80 shadow-[0_2px_10px_rgba(15,15,15,0.45)] transition hover:border-white/20 hover:bg-sidebar/95 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 md:flex"
      aria-label={state === "collapsed" ? "Expand sidebar" : "Collapse sidebar"}
    >
      <Icon className="h-3.5 w-3.5" />
    </button>
  );
}
