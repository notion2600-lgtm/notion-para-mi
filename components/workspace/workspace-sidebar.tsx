"use client";

import {
  closestCenter,
  DndContext,
  DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import {
  ChevronDown,
  ChevronRight,
  Copy,
  FilePlus2,
  FileText,
  LayoutTemplate,
  LockKeyhole,
  LogOut,
  MoreHorizontal,
  PanelLeftClose,
  Pencil,
  Plus,
  Search,
  Settings,
  Star,
  Table2,
  Trash2,
  UserPlus,
  UsersRound,
} from "lucide-react";
import { PointerEvent as ReactPointerEvent, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { PageRow } from "@/components/workspace/page-row";
import {
  flattenPageTree,
  getNextPosition,
  isDescendant,
  positionAfter,
  sortPages,
} from "@/lib/page-tree";
import type { WorkspacePage, WorkspaceSummary } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useWorkspaceUi } from "@/stores/workspace-ui";

type ContextMenuState = { pageId: string; x: number; y: number } | null;

export function WorkspaceSidebar({
  email,
  mobile = false,
  onArchive,
  onCreate,
  onCreateTeam,
  onCreateWorkspace,
  onDuplicate,
  onMove,
  onSelect,
  onSwitchWorkspace,
  onUpdate,
  onSetVisibility,
  pages,
  userId,
  workspace,
  workspaces,
}: {
  email: string;
  mobile?: boolean;
  onArchive: (pageId: string) => void;
  onCreate: (parentPageId: string | null) => Promise<WorkspacePage | null>;
  onCreateTeam: () => Promise<WorkspacePage | null>;
  onCreateWorkspace: (name: string) => Promise<boolean>;
  onDuplicate: (pageId: string) => Promise<WorkspacePage | null>;
  onMove: (pageId: string, parentPageId: string | null, position: number) => void;
  onSelect: (pageId: string) => void;
  onSwitchWorkspace: (workspaceId: string) => void;
  onUpdate: (pageId: string, changes: Partial<WorkspacePage>) => void;
  onSetVisibility: (pageId: string, visibility: WorkspacePage["visibility"]) => Promise<boolean>;
  pages: WorkspacePage[];
  userId: string;
  workspace: WorkspaceSummary;
  workspaces: WorkspaceSummary[];
}) {
  const {
    expanded,
    selectedPageId,
    setExpanded,
    setSearchOpen,
    setSidebarWidth,
    setSidebarVisible,
    setView,
    sidebarWidth,
  } = useWorkspaceUi();
  const [favoritesOpen, setFavoritesOpen] = useState(true);
  const [privateOpen, setPrivateOpen] = useState(true);
  const [teamOpen, setTeamOpen] = useState(true);
  const [contextMenu, setContextMenu] = useState<ContextMenuState>(null);
  const [workspaceMenuOpen, setWorkspaceMenuOpen] = useState(false);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );
  const privatePages = useMemo(
    () => pages.filter((page) => page.visibility !== "team"),
    [pages],
  );
  const teamPages = useMemo(
    () => pages.filter((page) => page.visibility === "team"),
    [pages],
  );
  const privateTree = useMemo(
    () => flattenPageTree(privatePages, expanded),
    [expanded, privatePages],
  );
  const teamTree = useMemo(
    () => flattenPageTree(teamPages, expanded),
    [expanded, teamPages],
  );
  const favorites = useMemo(
    () => sortPages(pages.filter((page) => page.is_favorite && !page.is_archived)),
    [pages],
  );
  const archivedCount = pages.filter((page) => page.is_archived).length;

  useEffect(() => {
    function closeMenu() {
      setContextMenu(null);
      setWorkspaceMenuOpen(false);
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") closeMenu();
    }
    window.addEventListener("click", closeMenu);
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      window.removeEventListener("click", closeMenu);
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, []);

  async function addPage(parentPageId: string | null) {
    const page = await onCreate(parentPageId);
    if (!page) return;
    if (parentPageId) setExpanded(parentPageId, true);
    onSelect(page.id);
  }

  async function addTeamPage() {
    const page = await onCreateTeam();
    if (page) onSelect(page.id);
  }

  function handleDragEnd(event: DragEndEvent) {
    const activeId = String(event.active.id);
    const overId = event.over ? String(event.over.id) : null;
    if (!overId || activeId === overId) return;
    const activePage = pages.find((page) => page.id === activeId);
    const overPage = pages.find((page) => page.id === overId);
    if (!activePage || !overPage || isDescendant(pages, overId, activeId)) return;

    if (event.delta.x > 28) {
      onMove(activeId, overId, getNextPosition(pages, overId));
      setExpanded(overId, true);
      return;
    }

    onMove(activeId, overPage.parent_page_id, positionAfter(pages, overPage, activeId));
  }

  function beginResize(event: ReactPointerEvent<HTMLDivElement>) {
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = sidebarWidth;
    function move(pointerEvent: PointerEvent) {
      setSidebarWidth(startWidth + pointerEvent.clientX - startX);
    }
    function stop() {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", stop);
    }
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", stop);
  }

  const contextPage = contextMenu
    ? pages.find((page) => page.id === contextMenu.pageId)
    : null;

  return (
    <aside
      className="print-hidden relative flex h-screen shrink-0 flex-col border-r bg-[#f7f7f5] text-zinc-700"
      style={{ width: mobile ? "min(88vw, 320px)" : sidebarWidth }}
    >
      <div className="flex h-11 items-center gap-1 px-2 pt-1">
        <div className="relative min-w-0 flex-1">
          <button
            aria-expanded={workspaceMenuOpen}
            className={`flex h-9 w-full min-w-0 items-center gap-2 rounded-lg px-2 text-left ${workspaceMenuOpen ? "bg-zinc-200/80" : "hover:bg-zinc-200/70"}`}
            onClick={(event) => {
              event.stopPropagation();
              setWorkspaceMenuOpen((open) => !open);
            }}
            type="button"
          >
            <span className="grid size-6 shrink-0 place-items-center rounded-md bg-white text-sm shadow-sm">
              {workspace.icon || "✨"}
            </span>
            <span className="min-w-0 flex-1 truncate text-sm font-semibold text-zinc-800">{workspace.name}</span>
            <ChevronDown className="size-3.5 shrink-0 text-zinc-400" />
          </button>
          {workspaceMenuOpen && (
            <div
              className="absolute left-0 top-10 z-50 max-h-[calc(100vh-56px)] w-[min(300px,calc(100vw-16px))] overflow-y-auto rounded-xl border bg-white shadow-[0_12px_32px_rgba(0,0,0,0.16)]"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex items-center gap-3 px-3 py-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-amber-900 text-xl text-white">
                  {workspace.icon || "✨"}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-zinc-900">{workspace.name}</p>
                  <p className="text-xs text-zinc-500">Plan gratuito · {roleLabel(workspace.role)}</p>
                </div>
              </div>
              <div className="border-t p-1.5">
                <button
                  className="flex h-9 w-full items-center gap-2 rounded-md px-2 text-sm hover:bg-zinc-100"
                  onClick={() => {
                    setWorkspaceMenuOpen(false);
                    setView("settings");
                  }}
                  type="button"
                >
                  <Settings className="size-4 text-zinc-500" /> Configuración
                </button>
                {workspace.role === "owner" && <button
                  className="flex h-9 w-full items-center gap-2 rounded-md px-2 text-sm hover:bg-zinc-100"
                  onClick={() => {
                    setWorkspaceMenuOpen(false);
                    setView("settings");
                  }}
                  type="button"
                >
                  <UserPlus className="size-4 text-zinc-500" /> Invitar a miembros
                </button>}
              </div>
              <div className="border-t px-3 py-2">
                <p className="truncate text-xs text-zinc-500">{email}</p>
              </div>
              <div className="p-1.5 pt-0">
              {workspaces.map((item) => (
                <button
                  className={`flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left hover:bg-zinc-100 ${item.id === workspace.id ? "bg-zinc-50" : ""}`}
                  key={item.id}
                  onClick={() => {
                    setWorkspaceMenuOpen(false);
                    if (item.id !== workspace.id) onSwitchWorkspace(item.id);
                  }}
                  type="button"
                >
                  <span className="grid size-8 place-items-center rounded-md bg-zinc-50 text-base">{item.icon || "✨"}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-zinc-800">{item.name}</span>
                    <span className="block text-[11px] text-zinc-400">{roleLabel(item.role)}</span>
                  </span>
                  {item.id === workspace.id && <span className="text-xs text-indigo-600">✓</span>}
                </button>
              ))}
                <button
                  className="flex h-9 w-full items-center gap-2 rounded-md px-2 text-sm text-blue-600 hover:bg-blue-50"
                  onClick={async () => {
                    const name = window.prompt("Nombre del nuevo espacio", "Nuevo espacio de trabajo");
                    if (!name?.trim()) return;
                    setWorkspaceMenuOpen(false);
                    await onCreateWorkspace(name);
                  }}
                  type="button"
                >
                  <Plus className="size-4" /> Nuevo espacio de trabajo
                </button>
              </div>
              <form action="/auth/signout" className="border-t p-1.5" method="post">
                <button className="flex h-9 w-full items-center gap-2 rounded-md px-2 text-sm hover:bg-zinc-100" type="submit">
                  <LogOut className="size-4 text-zinc-500" /> Cerrar sesión
                </button>
              </form>
            </div>
          )}
        </div>
        <button
          aria-label="Ocultar menú lateral"
          className="grid size-8 place-items-center rounded-md hover:bg-zinc-200"
          onClick={() => setSidebarVisible(false)}
          type="button"
        >
          <PanelLeftClose className="size-4 text-zinc-400" />
        </button>
      </div>

      <div className="px-2 pb-3 pt-1">
        <button
          className="flex h-8 w-full items-center gap-2 rounded-md px-2 text-sm hover:bg-zinc-200/80"
          onClick={() => setSearchOpen(true)}
          type="button"
        >
          <Search className="size-4 text-zinc-500" />
          Buscar
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-1 pb-3">
        {favorites.length > 0 && (
          <SidebarSection
            label="Favoritos"
            onToggle={() => setFavoritesOpen(!favoritesOpen)}
            open={favoritesOpen}
          >
            {favorites.map((page) => (
              <SidebarPageButton
                key={page.id}
                onClick={() => onSelect(page.id)}
                page={page}
                selected={selectedPageId === page.id}
              />
            ))}
          </SidebarSection>
        )}

        <SidebarSection
          action={workspace.role !== "viewer" ? (
            <button
              aria-label="Crear página"
              className="grid size-6 place-items-center rounded opacity-0 hover:bg-zinc-200 group-hover/section:opacity-100"
              onClick={() => addPage(null)}
              type="button"
            >
              <Plus className="size-3.5" />
            </button>
          ) : undefined}
          label="Privado"
          onToggle={() => setPrivateOpen(!privateOpen)}
          open={privateOpen}
        >
          <>
          {privateOpen && privateTree.length > 0 ? (
            <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd} sensors={sensors}>
              <SortableContext items={privateTree.map((page) => page.id)} strategy={verticalListSortingStrategy}>
                {privateTree.map((page) => (
                  <PageRow
                    expanded={Boolean(expanded[page.id])}
                    key={page.id}
                    onAddChild={addPage}
                    onMenu={(pageId, x, y) => {
                      if (workspace.role !== "viewer") setContextMenu({ pageId, x, y });
                    }}
                    onSelect={onSelect}
                    onToggle={(pageId) => setExpanded(pageId, !expanded[pageId])}
                    page={page}
                    selected={selectedPageId === page.id}
                  />
                ))}
              </SortableContext>
            </DndContext>
          ) : privateOpen && workspace.role !== "viewer" ? (
            <button
              className="mx-2 flex w-[calc(100%-1rem)] items-center gap-2 rounded-md border border-dashed px-3 py-2 text-left text-xs text-zinc-500 hover:border-zinc-400 hover:bg-white"
              onClick={() => addPage(null)}
              type="button"
            >
              <Plus className="size-3.5" />
              Crear la primera página
            </button>
          ) : null}
          {privateOpen && privateTree.length > 0 && workspace.role !== "viewer" && (
            <button
              className="mx-2 mt-1 flex h-8 w-[calc(100%-1rem)] items-center gap-2 rounded-md px-2 text-left text-sm text-zinc-400 hover:bg-zinc-200/80 hover:text-zinc-700"
              onClick={() => void addPage(null)}
              type="button"
            >
              <Plus className="size-4" /> Añadir nueva
            </button>
          )}
          </>
        </SidebarSection>

        <SidebarSection
          action={workspace.role !== "viewer" ? (
            <button
              aria-label="Crear página de equipo"
              className="grid size-6 place-items-center rounded opacity-0 hover:bg-zinc-200 group-hover/section:opacity-100"
              onClick={() => void addTeamPage()}
              type="button"
            >
              <Plus className="size-3.5" />
            </button>
          ) : undefined}
          label="Espacios de equipo"
          onToggle={() => setTeamOpen(!teamOpen)}
          open={teamOpen}
        >
          <>
          {teamOpen && teamTree.length > 0 ? (
            <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd} sensors={sensors}>
              <SortableContext items={teamTree.map((page) => page.id)} strategy={verticalListSortingStrategy}>
                {teamTree.map((page) => (
                  <PageRow
                    expanded={Boolean(expanded[page.id])}
                    key={page.id}
                    onAddChild={addPage}
                    onMenu={(pageId, x, y) => {
                      if (workspace.role !== "viewer") setContextMenu({ pageId, x, y });
                    }}
                    onSelect={onSelect}
                    onToggle={(pageId) => setExpanded(pageId, !expanded[pageId])}
                    page={page}
                    selected={selectedPageId === page.id}
                  />
                ))}
              </SortableContext>
            </DndContext>
          ) : teamOpen && workspace.role !== "viewer" ? (
            <button
              className="mx-2 flex w-[calc(100%-1rem)] items-center gap-2 rounded-md border border-dashed px-3 py-2 text-left text-xs text-zinc-500 hover:border-zinc-400 hover:bg-white"
              onClick={() => void addTeamPage()}
              type="button"
            >
              <UsersRound className="size-3.5" />
              Crear una página para el equipo
            </button>
          ) : null}
          {teamOpen && teamTree.length > 0 && workspace.role !== "viewer" && (
            <button
              className="mx-2 mt-1 flex h-8 w-[calc(100%-1rem)] items-center gap-2 rounded-md px-2 text-left text-sm text-zinc-400 hover:bg-zinc-200/80 hover:text-zinc-700"
              onClick={() => void addTeamPage()}
              type="button"
            >
              <Plus className="size-4" /> Añadir nueva
            </button>
          )}
          </>
        </SidebarSection>
      </div>

      <div className="border-t px-2 py-2">
        <button
          className="flex h-8 w-full items-center gap-2 rounded-md px-2 text-sm hover:bg-zinc-200/80"
          onClick={() => setView("templates")}
          type="button"
        >
          <LayoutTemplate className="size-4 text-zinc-500" />
          Plantillas
        </button>
        <button
          className="flex h-8 w-full items-center gap-2 rounded-md px-2 text-sm hover:bg-zinc-200/80"
          onClick={() => setView("trash")}
          type="button"
        >
          <Trash2 className="size-4 text-zinc-500" />
          Papelera
          {archivedCount > 0 && (
            <span className="ml-auto rounded-full bg-zinc-200 px-2 py-0.5 text-[10px]">{archivedCount}</span>
          )}
        </button>
        <button
          className="flex h-8 w-full items-center gap-2 rounded-md px-2 text-sm hover:bg-zinc-200/80"
          onClick={() => setView("settings")}
          type="button"
        >
          <Settings className="size-4 text-zinc-500" />
          Personas y equipo
        </button>
        {workspace.role !== "viewer" && (
          <button
            className="mt-2 flex h-9 w-full items-center justify-center gap-2 rounded-lg border bg-white text-sm font-medium shadow-sm hover:bg-zinc-50"
            onClick={() => void addPage(null)}
            type="button"
          >
            <FilePlus2 className="size-4 text-zinc-500" /> Nueva página
          </button>
        )}
      </div>

      {!mobile && (
        <div
          aria-label="Redimensionar sidebar"
          className="absolute inset-y-0 right-0 w-1 cursor-col-resize hover:bg-indigo-400/50"
          onPointerDown={beginResize}
          role="separator"
        />
      )}

      {contextMenu && contextPage && (
        <div
          className="fixed z-50 w-56 rounded-lg border bg-white p-1 text-sm shadow-xl"
          onClick={(event) => event.stopPropagation()}
          style={{ left: Math.min(contextMenu.x, window.innerWidth - 240), top: Math.min(contextMenu.y, window.innerHeight - 280) }}
        >
          <MenuButton
            icon={Pencil}
            label="Renombrar"
            onClick={() => {
              const title = window.prompt("Nuevo nombre", contextPage.title);
              if (title?.trim()) onUpdate(contextPage.id, { title: title.trim() });
              setContextMenu(null);
            }}
          />
          <MenuButton icon={Plus} label="Crear subpágina" onClick={() => addPage(contextPage.id)} />
          <MenuButton
            icon={Copy}
            label="Duplicar"
            onClick={async () => {
              const copy = await onDuplicate(contextPage.id);
              if (copy) onSelect(copy.id);
              setContextMenu(null);
            }}
          />
          <MenuButton
            icon={Star}
            label={contextPage.is_favorite ? "Quitar de favoritos" : "Añadir a favoritos"}
            onClick={() => {
              onUpdate(contextPage.id, { is_favorite: !contextPage.is_favorite });
              setContextMenu(null);
            }}
          />
          {contextPage.visibility !== "team" ? (
            <MenuButton
              icon={UsersRound}
              label="Compartir con el equipo"
              onClick={async () => {
                await onSetVisibility(contextPage.id, "team");
                setContextMenu(null);
              }}
            />
          ) : contextPage.created_by === userId ? (
            <MenuButton
              icon={LockKeyhole}
              label="Mover a Privado"
              onClick={async () => {
                await onSetVisibility(contextPage.id, "private");
                setContextMenu(null);
              }}
            />
          ) : null}
          <MenuButton
            icon={FileText}
            label="Copiar enlace"
            onClick={async () => {
              await navigator.clipboard.writeText(
                `${window.location.origin}/workspace?workspace=${workspace.id}&page=${contextPage.id}`,
              );
              toast.success("Enlace copiado");
              setContextMenu(null);
            }}
          />
          <div className="my-1 border-t" />
          <MenuButton
            danger
            icon={Trash2}
            label="Mover a papelera"
            onClick={() => {
              onArchive(contextPage.id);
              setContextMenu(null);
            }}
          />
        </div>
      )}
    </aside>
  );
}

function SidebarSection({
  action,
  children,
  label,
  onToggle,
  open,
}: {
  action?: React.ReactNode;
  children: React.ReactNode;
  label: string;
  onToggle: () => void;
  open: boolean;
}) {
  return (
    <section className="group/section mb-3">
      <div className="flex h-7 items-center px-2">
        <button
          className="flex flex-1 items-center gap-1 text-[11px] font-medium text-zinc-400"
          onClick={onToggle}
          type="button"
        >
          {open ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
          {label}
        </button>
        {action}
      </div>
      {open && children}
    </section>
  );
}

function SidebarPageButton({
  onClick,
  page,
  selected,
}: {
  onClick: () => void;
  page: WorkspacePage;
  selected?: boolean;
}) {
  return (
    <button
      className={cn(
        "mx-1 flex h-8 w-[calc(100%-0.5rem)] items-center gap-2 rounded-md px-3 text-left text-sm hover:bg-zinc-200/80",
        selected && "bg-zinc-200/80 text-zinc-950",
      )}
      onClick={onClick}
      type="button"
    >
      <span>
        {page.icon ||
          (page.type === "database" ? (
            <Table2 className="size-4 text-zinc-400" />
          ) : (
            <FileText className="size-4 text-zinc-400" />
          ))}
      </span>
      <span className="truncate">{page.title}</span>
      {page.is_favorite && <Star className="ml-auto size-3 fill-current text-amber-500" />}
    </button>
  );
}

function MenuButton({
  danger,
  icon: Icon,
  label,
  onClick,
}: {
  danger?: boolean;
  icon: typeof MoreHorizontal;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      className={cn(
        "flex h-8 w-full items-center gap-2 rounded-md px-2 text-left hover:bg-zinc-100",
        danger && "text-red-600 hover:bg-red-50",
      )}
      onClick={onClick}
      type="button"
    >
      <Icon className="size-4" />
      {label}
    </button>
  );
}

function roleLabel(role: WorkspaceSummary["role"]) {
  if (role === "owner") return "Propietario";
  if (role === "editor") return "Puede editar";
  return "Solo lectura";
}
