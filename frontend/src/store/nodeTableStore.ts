import { create } from "zustand";

interface NodeTableState {
  isOpen: boolean;
  searchTerm: string;
  statusFilter: string;
  selectedTags: string[];
  sortBy: "title" | "status" | "created" | "updated" | null;
  sortDirection: "asc" | "desc";
  setOpen: (open: boolean) => void;
  toggle: () => void;
  setSearchTerm: (term: string) => void;
  setStatusFilter: (status: string) => void;
  setSelectedTags: (tags: string[]) => void;
  toggleTag: (tag: string) => void;
  setSorting: (sortBy: string | null, direction?: "asc" | "desc") => void;
  reset: () => void;
}

export const useNodeTableStore = create<NodeTableState>((set) => ({
  isOpen: false,
  searchTerm: "",
  statusFilter: "all",
  selectedTags: [],
  sortBy: null,
  sortDirection: "asc",

  setOpen: (open) => set({ isOpen: open }),
  toggle: () => set((state) => ({ isOpen: !state.isOpen })),
  setSearchTerm: (term: string) => set({ searchTerm: term }),
  setStatusFilter: (status: string) => set({ statusFilter: status }),
  setSelectedTags: (tags: string[]) => set({ selectedTags: tags }),

  toggleTag: (tag: string) =>
    set((state) => ({
      selectedTags: state.selectedTags.includes(tag)
        ? state.selectedTags.filter((t) => t !== tag)
        : [...state.selectedTags, tag],
    })),

  setSorting: (sortBy, direction) =>
    set((state) => ({
      sortBy: sortBy as any,
      sortDirection:
        direction ||
        (state.sortBy === sortBy && state.sortDirection === "asc"
          ? "desc"
          : "asc"),
    })),

  reset: () =>
    set({
      searchTerm: "",
      statusFilter: "all",
      selectedTags: [],
      sortBy: null,
      sortDirection: "asc",
    }),
}));
