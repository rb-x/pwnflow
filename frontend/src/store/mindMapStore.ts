import { create } from "zustand";
import { persist } from "zustand/middleware";

interface MindMapState {
  selectedNodeId: string | null;
  isDrawerOpen: boolean;
  layoutDirection: "TB" | "BT" | "LR" | "RL";
  activeContexts: string[];
  activeContextsByProject: Record<string, string[]>; // Per-project active contexts

  // Actions
  setSelectedNodeId: (nodeId: string | null) => void;
  setDrawerOpen: (isOpen: boolean) => void;
  setLayoutDirection: (direction: "TB" | "BT" | "LR" | "RL") => void;
  setActiveContexts: (contextIds: string[]) => void;
  setActiveContextsForProject: (projectId: string, contextIds: string[]) => void;
  getActiveContextsForProject: (projectId: string) => string[];
}

export const useMindMapStore = create<MindMapState>()(
  persist(
    (set, get) => ({
      selectedNodeId: null,
      isDrawerOpen: false,
      layoutDirection: "TB",
      activeContexts: [],
      activeContextsByProject: {},

      setSelectedNodeId: (nodeId) => set({ selectedNodeId: nodeId }),
      setDrawerOpen: (isOpen) => set({ isDrawerOpen: isOpen }),
      setLayoutDirection: (direction) => set({ layoutDirection: direction }),
      setActiveContexts: (contextIds) => set({ activeContexts: contextIds }),
      
      setActiveContextsForProject: (projectId, contextIds) => 
        set((state) => ({
          activeContextsByProject: {
            ...state.activeContextsByProject,
            [projectId]: contextIds,
          },
          activeContexts: contextIds, // Also update the current active contexts
        })),
      
      getActiveContextsForProject: (projectId) => {
        const state = get();
        return state.activeContextsByProject[projectId] || [];
      },
    }),
    {
      name: "mindmap-storage",
      partialize: (state) => ({ 
        layoutDirection: state.layoutDirection,
        activeContextsByProject: state.activeContextsByProject,
      }),
    }
  )
);
