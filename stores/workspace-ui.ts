import { create } from "zustand";

type WorkspaceView = "page" | "templates" | "trash" | "settings";

type WorkspaceUiState = {
  expanded: Record<string, boolean>;
  searchOpen: boolean;
  selectedPageId: string | null;
  sidebarVisible: boolean;
  sidebarWidth: number;
  view: WorkspaceView;
  setExpanded: (pageId: string, value: boolean) => void;
  setSearchOpen: (value: boolean) => void;
  setSelectedPageId: (pageId: string | null) => void;
  setSidebarVisible: (value: boolean) => void;
  setSidebarWidth: (width: number) => void;
  setView: (view: WorkspaceView) => void;
};

export const useWorkspaceUi = create<WorkspaceUiState>((set) => ({
  expanded: {},
  searchOpen: false,
  selectedPageId: null,
  sidebarVisible: true,
  sidebarWidth: 280,
  view: "page",
  setExpanded: (pageId, value) =>
    set((state) => ({ expanded: { ...state.expanded, [pageId]: value } })),
  setSearchOpen: (searchOpen) => set({ searchOpen }),
  setSelectedPageId: (selectedPageId) => set({ selectedPageId, view: "page" }),
  setSidebarVisible: (sidebarVisible) => set({ sidebarVisible }),
  setSidebarWidth: (sidebarWidth) =>
    set({ sidebarWidth: Math.min(420, Math.max(220, sidebarWidth)) }),
  setView: (view) => set({ view }),
}));
