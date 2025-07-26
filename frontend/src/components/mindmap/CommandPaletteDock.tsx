import { useCallback, useState, useEffect } from "react";
import {
  Download,
  Search,
  FileInput,
  Package,
  MessageSquare,
  GitBranch,
} from "lucide-react";
import { Dock, DockIcon } from "@/components/ui/dock";
import { useMindMapStore } from "@/store/mindMapStore";
import { useNodeTableStore } from "@/store/nodeTableStore";
import { toast } from "sonner";
import { useReactFlow } from "@xyflow/react";
import { ImportTemplateDialog } from "./ImportTemplateDialog";
import { ContextModal } from "./ContextModal";
import { AIChatPopover } from "./AIChatPopover";
import { NodeTableDrawer } from "./NodeTableDrawer";
import { ProjectExportDialog } from "@/components/export/ProjectExportDialog";
import { useProject } from "@/hooks/api/useProjects";
import { StatusTrailsPopover } from "./StatusTrailsPopover";

interface CommandPaletteDockProps {
  projectId: string;
  isTemplate?: boolean;
}

export function CommandPaletteDock({ projectId, isTemplate = false }: CommandPaletteDockProps) {
  const { setDrawerOpen } = useMindMapStore();
  const { toggle: toggleNodeTable } = useNodeTableStore();
  const reactFlowInstance = useReactFlow();
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [showContextModal, setShowContextModal] = useState(false);
  const [showAIChat, setShowAIChat] = useState(false);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [activeStatusTrail, setActiveStatusTrail] = useState<string | null>(null);

  // Detect OS for consistent keyboard shortcuts
  const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
  const modKey = isMac ? 'Cmd' : 'Ctrl';

  // Get project data for export dialog
  const { data: project } = useProject(projectId);

  // Handle status trail selection
  const handleStatusTrailSelect = useCallback((status: string | null) => {
    setActiveStatusTrail(status);
    // Dispatch event to MindMapEditor
    window.dispatchEvent(
      new CustomEvent('statusTrailChange', { detail: { status } })
    );
  }, []);

  // Listen for keyboard shortcut event
  useEffect(() => {
    const handleOpenImportDialog = () => {
      setShowImportDialog(true);
    };

    const handleOpenContextModal = () => {
      setShowContextModal(true);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+S or Cmd+S for Project Explorer (Node Table)
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        toggleNodeTable();
        // Focus search input after a short delay
        setTimeout(() => {
          const searchInput = document.querySelector(
            '[placeholder="Search nodes..."]'
          ) as HTMLInputElement;
          searchInput?.focus();
        }, 100);
      }
      // Ctrl+M or Cmd+M for Context Management
      if ((e.ctrlKey || e.metaKey) && e.key === "m") {
        e.preventDefault();
        setShowContextModal(true);
      }
      // Ctrl+G or Cmd+G for AI Assistant
      if ((e.ctrlKey || e.metaKey) && e.key === "g") {
        e.preventDefault();
        setShowAIChat(true);
      }
      // T for Node Table (keep as alternative)
      if (e.key === "t" && !e.ctrlKey && !e.metaKey && !e.altKey) {
        // Don't trigger if user is typing in an input
        const target = e.target as HTMLElement;
        if (target.tagName !== "INPUT" && target.tagName !== "TEXTAREA") {
          e.preventDefault();
          toggleNodeTable();
        }
      }
    };

    window.addEventListener("openImportDialog", handleOpenImportDialog);
    window.addEventListener("openContextModal", handleOpenContextModal);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("openImportDialog", handleOpenImportDialog);
      window.removeEventListener("openContextModal", handleOpenContextModal);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  const dockItems = [
    {
      icon: Search,
      label: isTemplate ? "Template Explorer" : "Project Explorer",
      onClick: () => {
        // Open node table with search focused
        toggleNodeTable();
        // Focus search input after a short delay
        setTimeout(() => {
          const searchInput = document.querySelector(
            '[placeholder="Search nodes..."]'
          ) as HTMLInputElement;
          searchInput?.focus();
        }, 100);
      },
      shortcut: `${modKey}+S`,
    },
    ...(isTemplate ? [] : [
      {
        icon: FileInput,
        label: "Import Template",
        onClick: () => setShowImportDialog(true),
        shortcut: `${modKey}+I`,
      },
      {
        icon: Package,
        label: "Contexts",
        onClick: () => setShowContextModal(true),
        shortcut: `${modKey}+M`,
      },
      {
        icon: Download,
        label: "Export Project",
        onClick: () => setShowExportDialog(true),
      },
    ]),
  ];

  return (
    <>
      <Dock items={dockItems}>
        {!isTemplate && (
          <>
            <StatusTrailsPopover
              onStatusSelect={handleStatusTrailSelect}
              activeStatus={activeStatusTrail}
            >
              <DockIcon
                icon={GitBranch}
                label="Status Trails"
                isActive={!!activeStatusTrail}
                aria-label="Status Trails"
              />
            </StatusTrailsPopover>
            <AIChatPopover
              open={showAIChat}
              onOpenChange={setShowAIChat}
              projectId={projectId}
            >
              <DockIcon
                icon={MessageSquare}
                label="AI Assistant"
                onClick={() => setShowAIChat(!showAIChat)}
                shortcut={`${modKey}+G`}
              />
            </AIChatPopover>
          </>
        )}
      </Dock>
      <ImportTemplateDialog
        isOpen={showImportDialog}
        onClose={() => setShowImportDialog(false)}
        projectId={projectId}
      />
      <ContextModal
        isOpen={showContextModal}
        onClose={() => setShowContextModal(false)}
        projectId={projectId}
        isTemplate={false}
      />
      <NodeTableDrawer projectId={projectId} isReadOnly={isTemplate} projectName={project?.name} />
      {project && (
        <ProjectExportDialog
          open={showExportDialog}
          onOpenChange={setShowExportDialog}
          projectId={projectId}
          projectName={project.name}
        />
      )}
    </>
  );
}
