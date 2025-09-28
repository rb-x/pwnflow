import type { RouteObject } from "react-router-dom";
import { MainLayout } from "@/layouts/MainLayout";
import { ProtectedRoute } from "@/components/ProtectedRoute";

// Page imports
import { DashboardPage } from "@/pages/DashboardPage";
import { ProjectsPage } from "@/pages/ProjectsPage";
import { ProjectDetailPage } from "@/pages/ProjectDetailPage";
import { TemplatesPage } from "@/pages/TemplatesPage";
import { TemplateDetailPage } from "@/pages/TemplateDetailPage";
import { Navigate } from "react-router-dom";
import { LoginPage } from "@/pages/LoginPage";
import { AboutPage } from "@/pages/AboutPage";
import { SupportPage } from "@/pages/SupportPage";
import { ProjectEventRoutesPage } from "@/pages/ProjectEventRoutesPage";
import { SettingsPage } from "@/pages/SettingsPage";

export const routes: RouteObject[] = [
  {
    path: "/login",
    element: <LoginPage />,
  },
  {
    path: "/",
    element: <ProtectedRoute />,
    children: [
      {
        element: <MainLayout />,
        children: [
          {
            index: true,
            element: <DashboardPage />,
          },
          {
            path: "projects",
            children: [
              {
                index: true,
                element: <ProjectsPage />,
              },
              {
                path: ":projectId",
                element: <ProjectDetailPage />,
              },
            ],
          },
          {
            path: "templates",
            children: [
              {
                index: true,
                element: <TemplatesPage />,
              },
              {
                path: ":templateId",
                element: <TemplateDetailPage />,
              },
            ],
          },
          {
            path: "projects/:projectId/settings/event-routing",
            element: <ProjectEventRoutesPage />,
          },
          {
            path: "settings",
            element: <SettingsPage />,
          },
          {
            path: "profile",
            element: <Navigate to="/settings?tab=profile" replace />,
          },
          {
            path: "about",
            element: <AboutPage />,
          },
          {
            path: "support",
            element: <SupportPage />,
          },
        ],
      },
    ],
  },
];
