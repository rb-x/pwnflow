import type { RouteObject } from "react-router-dom";
import { MainLayout } from "@/layouts/MainLayout";
import { ProtectedRoute } from "@/components/ProtectedRoute";

// Page imports
import { DashboardPage } from "@/pages/DashboardPage";
import { ProjectsPage } from "@/pages/ProjectsPage";
import { ProjectDetailPage } from "@/pages/ProjectDetailPage";
import { TemplatesPage } from "@/pages/TemplatesPage";
import { TemplateDetailPage } from "@/pages/TemplateDetailPage";
import { ProfilePage } from "@/pages/ProfilePage";
import { LoginPage } from "@/pages/LoginPage";
import { RegisterPage } from "@/pages/RegisterPage";
import { AboutPage } from "@/pages/AboutPage";
import { SupportPage } from "@/pages/SupportPage";

export const routes: RouteObject[] = [
  {
    path: "/login",
    element: <LoginPage />,
  },
  {
    path: "/register",
    element: <RegisterPage />,
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
            path: "profile",
            element: <ProfilePage />,
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
