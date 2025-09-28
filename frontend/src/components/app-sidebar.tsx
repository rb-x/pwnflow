import * as React from "react";
import {
  Home,
  FolderOpen,
  FileText,
  Workflow,
  Book,
  Info,
  Heart,
  Settings,
} from "lucide-react";
import { DiscordIcon } from "@/components/icons/DiscordIcon";

import { NavMain } from "@/components/nav-main";
import { NavProjects } from "@/components/nav-projects";
import { NavSecondary } from "@/components/nav-secondary";
import { NavUser } from "@/components/nav-user";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
} from "@/components/ui/sidebar";

import { useAuthStore } from "@/store/authStore";
import { useProjects } from "@/hooks/api/useProjects";

const data = {
  navMain: [
    {
      title: "Dashboard",
      url: "/",
      icon: Home,
      isActive: true,
    },
    {
      title: "Projects",
      url: "/projects",
      icon: FolderOpen,
    },
    {
      title: "Templates",
      url: "/templates",
      icon: FileText,
    },
    {
      title: "Settings",
      url: "/settings",
      icon: Settings,
    },
  ],
  navSecondary: [
    {
      title: "Discord",
      url: "https://discord.gg/hVw33XrRhY",
      icon: DiscordIcon,
    },
    {
      title: "Documentation",
      url: "https://docs.pwnflow.sh/",
      icon: Book,
    },
    {
      title: "Support",
      url: "/support",
      icon: Heart,
    },
    {
      title: "About",
      url: "/about",
      icon: Info,
    },
  ],
};

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { user } = useAuthStore();

  // Fetch projects for the sidebar
  const { data: projects } = useProjects();

  // Get recent projects (last 6)
  const recentProjects = React.useMemo(() => {
    if (!projects) return [];

    // Sort by name for now since we don't have timestamps
    // In the future, this should be sorted by updated_at
    return projects.slice(0, 6).map((project: any) => ({
      name: project.name,
      url: `/projects/${project.id}`,
      icon: Workflow,
    }));
  }, [projects]);

  const userData = {
    name: user?.username || "User",
    email: user?.email || "user@example.com",
    avatar: "/avatars/user.jpg",
  };

  return (
    <Sidebar variant="inset" {...props}>
      <SidebarHeader>
        <div className="flex items-center gap-2 px-2 py-4">
          <svg
            className="h-7 w-7"
            width="32"
            height="32"
            viewBox="0 0 32 32"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <defs>
              <linearGradient
                id="sidebarLogoGradient"
                x1="0%"
                y1="100%"
                x2="100%"
                y2="0%"
              >
                <stop offset="0%" stopColor="#f5f5f5" />
                <stop offset="33%" stopColor="#d4d4d4" />
                <stop offset="66%" stopColor="#a3a3a3" />
                <stop offset="100%" stopColor="#737373" />
              </linearGradient>
            </defs>
            <g
              className="stroke-[url(#sidebarLogoGradient)]"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M16 2L2 8L16 14L30 8L16 2Z" />
              <path d="M2 16L16 22L30 16" />
              <path d="M2 24L16 30L30 24" />
            </g>
          </svg>
          <span className="text-md mt-0.5 font-bold tracking-wide text-white/90">
            Pwnflow
          </span>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={data.navMain} />
        {recentProjects.length > 0 && <NavProjects projects={recentProjects} />}
        <NavSecondary items={data.navSecondary} className="mt-auto" />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={userData} />
      </SidebarFooter>
    </Sidebar>
  );
}
