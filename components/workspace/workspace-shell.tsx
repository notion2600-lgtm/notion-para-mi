"use client";

import {
  ChevronDown,
  ChevronRight,
  Copy,
  Download,
  FileText,
  LayoutTemplate,
  Menu,
  MoreHorizontal,
  Moon,
  Plus,
  Printer,
  Sun,
  Table2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { DatabaseCanvas } from "@/components/database/database-canvas";
import {
  FavoriteButton,
  PageCanvas,
  TrashView,
} from "@/components/workspace/page-canvas";
import { WorkspaceSidebar } from "@/components/workspace/workspace-sidebar";
import { SearchDialog } from "@/components/workspace/search-dialog";
import { ShareButton } from "@/components/workspace/share-button";
import { TeamSettings } from "@/components/workspace/team-settings";
import { TemplatesView } from "@/components/workspace/templates-view";
import { usePageTemplates } from "@/hooks/use-page-templates";
import { usePages } from "@/hooks/use-pages";
import {
  useWorkspacePresence,
  type OnlineCollaborator,
} from "@/hooks/use-workspace-presence";
import { downloadPageAsMarkdown } from "@/lib/export-page";
import { getBacklinks } from "@/lib/page-links";
import { getDescendantIds, getPagePath } from "@/lib/page-tree";
import { createClient } from "@/lib/supabase/client";
import type { WorkspacePage, WorkspaceSummary } from "@/lib/types";
import { useWorkspaceUi } from "@/stores/workspace-ui";

export function WorkspaceShell({
  email,
  initialPages,
  initialSelectedPageId,
  userId,
  workspace,
  workspaces,
}: {
  email: string;
  initialPages: WorkspacePage[];
  initialSelectedPageId: string | null;
  userId: string;
  workspace: WorkspaceSummary;
  workspaces: WorkspaceSummary[];
}) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const { resolvedTheme, setTheme, theme } = useTheme();
  const {
    archivePage,
    archiveRows,
    createDatabase,
    createDatabaseRow,
    createFromTemplate,
    createPage,
    createTeamPage,
    deletePagePermanently,
    duplicatePage,
    emptyTrash,
    pages,
    resolveFileUrl,
    restorePage,
    saveAsTemplate,
    setPageVisibility,
    uploadPageFile,
    updatePage,
  } = usePages({ initialPages, userId, workspaceId: workspace.id });
  const {
    deleteTemplate,
    importNotionTemplate,
    isLoading: templatesLoading,
    templates,
  } = usePageTemplates(workspace.id, userId);
  const [newMenuOpen, setNewMenuOpen] = useState(false);
  const [actionsOpen, setActionsOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const online = useWorkspacePresence({
    label: email,
    userId,
    workspaceId: workspace.id,
  });
  const {
    searchOpen,
    selectedPageId,
    setSearchOpen,
    setSelectedPageId,
    setSidebarVisible,
    sidebarVisible,
    view,
  } = useWorkspaceUi();
  const selectedPage = useMemo(
    () => pages.find((page) => page.id === selectedPageId && !page.is_archived) ?? null,
    [pages, selectedPageId],
  );
  const breadcrumbs = selectedPage ? getPagePath(pages, selectedPage.id) : [];
  const backlinks = useMemo(
    () => (selectedPage ? getBacklinks(pages, selectedPage.id) : []),
    [pages, selectedPage],
  );
  const databaseRows = useMemo(
    () =>
      selectedPage?.type === "database"
        ? pages.filter(
            (page) =>
              page.parent_database_id === selectedPage.id && !page.is_archived,
          )
        : [],
    [pages, selectedPage],
  );

  const selectPage = useCallback((pageId: string) => {
    setSearchOpen(false);
    setSelectedPageId(pageId);
    router.replace(`/workspace?workspace=${workspace.id}&page=${pageId}`, { scroll: false });
    if (isMobile) setSidebarVisible(false);
  }, [isMobile, router, setSearchOpen, setSelectedPageId, setSidebarVisible, workspace.id]);

  const createAndSelect = useCallback(async (parentPageId: string | null) => {
    const page = await createPage(parentPageId);
    if (page) selectPage(page.id);
    return page;
  }, [createPage, selectPage]);

  useEffect(() => {
    const requested = initialSelectedPageId
      ? pages.find((page) => page.id === initialSelectedPageId && !page.is_archived)
      : null;
    if (requested) {
      setSelectedPageId(requested.id);
      return;
    }
    if (!selectedPageId || !pages.some((page) => page.id === selectedPageId && !page.is_archived)) {
      const firstPage = pages.find((page) => !page.is_archived && page.parent_database_id === null);
      setSelectedPageId(firstPage?.id ?? null);
    }
  }, [initialSelectedPageId, pages, selectedPageId, setSelectedPageId]);

  useEffect(() => {
    function handleShortcuts(event: KeyboardEvent) {
      const command = event.ctrlKey || event.metaKey;
      const key = event.key.toLocaleLowerCase();
      if (command && key === "k") {
        event.preventDefault();
        setSearchOpen(true);
      }
      if (command && key === "p") {
        event.preventDefault();
        setSearchOpen(true);
      }
      if (command && key === "n") {
        event.preventDefault();
        void createAndSelect(null);
      }
      if (command && event.key === "\\") {
        event.preventDefault();
        setSidebarVisible(!useWorkspaceUi.getState().sidebarVisible);
      }
      if (command && event.shiftKey && key === "l") {
        event.preventDefault();
        setTheme(resolvedTheme === "dark" ? "light" : "dark");
      }
      if (event.key === "Escape") {
        setSearchOpen(false);
        setActionsOpen(false);
        setNewMenuOpen(false);
        if (isMobile) setSidebarVisible(false);
      }
    }
    window.addEventListener("keydown", handleShortcuts);
    return () => window.removeEventListener("keydown", handleShortcuts);
  }, [createAndSelect, isMobile, resolvedTheme, setSearchOpen, setSidebarVisible, setTheme]);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 768px)");
    function applyViewport() {
      const mobile = media.matches;
      setIsMobile(mobile);
      setSidebarVisible(!mobile);
    }
    applyViewport();
    media.addEventListener("change", applyViewport);
    return () => media.removeEventListener("change", applyViewport);
  }, [setSidebarVisible]);

  async function createDatabaseAndSelect() {
    const database = await createDatabase(null);
    if (database) selectPage(database.id);
    setNewMenuOpen(false);
  }

  async function createTeamPageAndSelect() {
    const page = await createTeamPage();
    if (page) selectPage(page.id);
    return page;
  }

  async function createWorkspace(name: string) {
    const workspaceId = crypto.randomUUID();
    const normalizedName = name.trim() || "Nuevo espacio";
    const { error: workspaceError } = await supabase.from("workspaces").insert({
      icon: "✨",
      id: workspaceId,
      name: normalizedName,
      owner_id: userId,
    });
    if (workspaceError) {
      toast.error("No se pudo crear el espacio", { description: workspaceError.message });
      return false;
    }
    const { error: memberError } = await supabase.from("workspace_members").insert({
      role: "owner",
      user_id: userId,
      workspace_id: workspaceId,
    });
    if (memberError) {
      await supabase.from("workspaces").delete().eq("id", workspaceId);
      toast.error("No se pudo completar el espacio", { description: memberError.message });
      return false;
    }
    toast.success("Espacio de trabajo creado");
    router.push(`/workspace?workspace=${workspaceId}`);
    router.refresh();
    return true;
  }

  async function duplicateAndSelect(pageId: string) {
    const copy = await duplicatePage(pageId);
    if (copy) selectPage(copy.id);
    return copy;
  }

  async function createFromTemplateAndSelect(template: (typeof templates)[number]) {
    const page = await createFromTemplate(template);
    if (page) selectPage(page.id);
    return page;
  }

  async function archive(pageId: string) {
    const archivedIds = getDescendantIds(pages, pageId);
    const success = await archivePage(pageId);
    if (success && selectedPageId && archivedIds.includes(selectedPageId)) {
      const next = pages.find((page) => !page.is_archived && !archivedIds.includes(page.id));
      if (next) selectPage(next.id);
      else {
        setSelectedPageId(null);
        router.replace(`/workspace?workspace=${workspace.id}`, { scroll: false });
      }
    }
  }

  return (
    <div className="workspace-root flex h-screen overflow-hidden bg-white text-zinc-900">
      {isMobile && sidebarVisible && (
        <button
          aria-label="Cerrar navegación"
          className="fixed inset-0 z-40 bg-black/35"
          onClick={() => setSidebarVisible(false)}
          type="button"
        />
      )}
      {sidebarVisible && (
        <div className={isMobile ? "fixed inset-y-0 left-0 z-50" : "shrink-0"}>
          <WorkspaceSidebar
            email={email}
            mobile={isMobile}
            onArchive={archive}
            onCreate={createAndSelect}
            onCreateTeam={createTeamPageAndSelect}
            onCreateWorkspace={createWorkspace}
            onDuplicate={duplicatePage}
            onMove={(pageId, parentPageId, position) =>
              updatePage(pageId, { parent_page_id: parentPageId, position })
            }
            onSelect={selectPage}
            onSwitchWorkspace={(workspaceId) => {
              setSelectedPageId(null);
              useWorkspaceUi.getState().setView("page");
              router.push(`/workspace?workspace=${workspaceId}`);
            }}
            onSetVisibility={setPageVisibility}
            onUpdate={updatePage}
            pages={pages}
            userId={userId}
            workspace={workspace}
            workspaces={workspaces}
          />
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="print-hidden flex h-12 shrink-0 items-center border-b px-3">
          <button
            aria-label={sidebarVisible ? "Ocultar sidebar" : "Mostrar sidebar"}
            className="mr-2 grid size-8 place-items-center rounded-md text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900"
            onClick={() => setSidebarVisible(!sidebarVisible)}
            type="button"
          >
            <Menu className="size-4" />
          </button>
          <nav aria-label="Breadcrumbs" className="flex min-w-0 items-center text-sm text-zinc-500">
            {view === "trash" ? (
              <span className="font-medium text-zinc-800">Papelera</span>
            ) : view === "templates" ? (
              <span className="font-medium text-zinc-800">Plantillas</span>
            ) : view === "settings" ? (
              <span className="font-medium text-zinc-800">Personas y equipo</span>
            ) : breadcrumbs.length ? (
              breadcrumbs.map((page, index) => (
                <span className="flex min-w-0 items-center" key={page.id}>
                  {index > 0 && <ChevronRight className="mx-1 size-3.5 shrink-0 text-zinc-300" />}
                  <button
                    className="max-w-44 truncate rounded px-1.5 py-1 hover:bg-zinc-100 hover:text-zinc-900"
                    onClick={() => selectPage(page.id)}
                    type="button"
                  >
                    {page.icon || "📄"} {page.title}
                  </button>
                </span>
              ))
            ) : (
              <span className="font-medium text-zinc-800">{workspace.name}</span>
            )}
          </nav>
          <div className="ml-auto flex items-center gap-1">
            <PresenceList online={online} />
            {workspace.role === "viewer" && (
              <span className="mr-1 rounded-md bg-zinc-100 px-2 py-1 text-[11px] font-medium text-zinc-500">
                Solo lectura
              </span>
            )}
            <button
              aria-label={`Tema actual: ${theme === "system" ? "automático" : theme}. Cambiar tema`}
              className="grid size-8 place-items-center rounded-md text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900"
              onClick={() =>
                setTheme(theme === "system" ? "light" : theme === "light" ? "dark" : "system")
              }
              title="Cambiar tema (Ctrl+Shift+L)"
              type="button"
            >
              {resolvedTheme === "dark" ? <Moon className="size-4" /> : <Sun className="size-4" />}
            </button>
            {view === "page" && selectedPage && (
              <>
                <ShareButton pageId={selectedPage.id} title={selectedPage.title} />
                <FavoriteButton
                  favorite={selectedPage.is_favorite}
                  onClick={() => updatePage(selectedPage.id, { is_favorite: !selectedPage.is_favorite })}
                />
                <div className="relative">
                  <button
                    aria-label="Acciones de página"
                    className="grid size-8 place-items-center rounded-md text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900"
                    onClick={() => setActionsOpen((open) => !open)}
                    type="button"
                  >
                    <MoreHorizontal className="size-4" />
                  </button>
                  {actionsOpen && (
                    <div className="absolute right-0 top-9 z-50 w-56 rounded-lg border bg-white p-1 text-sm shadow-xl">
                      <HeaderMenuButton
                        icon={Copy}
                        label="Duplicar con subpáginas"
                        onClick={() => {
                          void duplicateAndSelect(selectedPage.id);
                          setActionsOpen(false);
                        }}
                      />
                      <HeaderMenuButton
                        icon={LayoutTemplate}
                        label="Guardar como plantilla"
                        onClick={() => {
                          const name = window.prompt("Nombre de la plantilla", selectedPage.title);
                          if (name !== null) void saveAsTemplate(selectedPage.id, name);
                          setActionsOpen(false);
                        }}
                      />
                      <HeaderMenuButton
                        icon={Download}
                        label="Exportar a Markdown"
                        onClick={() => {
                          downloadPageAsMarkdown(selectedPage, pages);
                          setActionsOpen(false);
                        }}
                      />
                      <HeaderMenuButton
                        icon={Printer}
                        label="Imprimir o guardar PDF"
                        onClick={() => {
                          setActionsOpen(false);
                          window.setTimeout(() => window.print(), 50);
                        }}
                      />
                    </div>
                  )}
                </div>
              </>
            )}
            {workspace.role !== "viewer" && <div className="relative">
              <Button
                aria-expanded={newMenuOpen}
                onClick={() => setNewMenuOpen((open) => !open)}
                size="sm"
                variant="ghost"
              >
                <Plus className="size-4" />
                Nueva
                <ChevronDown className="size-3" />
              </Button>
              {newMenuOpen && (
                <div className="absolute right-0 top-9 z-40 w-48 rounded-lg border bg-white p-1 text-sm shadow-xl">
                  <button
                    className="flex h-9 w-full items-center gap-2 rounded-md px-2 hover:bg-zinc-100"
                    onClick={() => {
                      void createAndSelect(null);
                      setNewMenuOpen(false);
                    }}
                    type="button"
                  >
                    <FileText className="size-4" /> Página
                  </button>
                  <button
                    className="flex h-9 w-full items-center gap-2 rounded-md px-2 hover:bg-zinc-100"
                    onClick={() => {
                      useWorkspaceUi.getState().setView("templates");
                      setNewMenuOpen(false);
                    }}
                    type="button"
                  >
                    <LayoutTemplate className="size-4" /> Desde plantilla
                  </button>
                  <button
                    className="flex h-9 w-full items-center gap-2 rounded-md px-2 hover:bg-zinc-100"
                    onClick={() => void createDatabaseAndSelect()}
                    type="button"
                  >
                    <Table2 className="size-4" /> Base de datos
                  </button>
                </div>
              )}
            </div>}
          </div>
        </header>

        <main className="workspace-main min-h-0 flex-1 overflow-y-auto" id="main-content" tabIndex={-1}>
          {view === "trash" ? (
            <TrashView
              onDelete={deletePagePermanently}
              onEmpty={emptyTrash}
              onRestore={restorePage}
              pages={pages}
            />
          ) : view === "templates" ? (
            <TemplatesView
              isLoading={templatesLoading}
              onDelete={deleteTemplate}
              onImport={async (file) => Boolean(await importNotionTemplate(file))}
              onUse={createFromTemplateAndSelect}
              templates={templates}
            />
          ) : view === "settings" ? (
            <TeamSettings email={email} userId={userId} workspace={workspace} />
          ) : selectedPage?.type === "database" ? (
            <DatabaseCanvas
              currentUser={{ id: userId, label: email }}
              database={selectedPage}
              backlinks={backlinks}
              onArchiveRows={archiveRows}
              onCreateRow={() => createDatabaseRow(selectedPage.id)}
              onOpenRow={selectPage}
              onOpenPage={selectPage}
              onResolveFileUrl={resolveFileUrl}
              onUpdatePage={updatePage}
              pages={pages}
              rows={databaseRows}
            />
          ) : (
            <PageCanvas
              onCreate={() => createAndSelect(null)}
              onCreateSubpage={() =>
                selectedPage ? createPage(selectedPage.id) : Promise.resolve(null)
              }
              backlinks={backlinks}
              onOpenPage={selectPage}
              onUpdate={updatePage}
              onUploadFile={uploadPageFile}
              page={selectedPage}
              pages={pages}
              readOnly={workspace.role === "viewer"}
              resolveFileUrl={resolveFileUrl}
            />
          )}
        </main>
      </div>
      <SearchDialog
        onClose={() => setSearchOpen(false)}
        onSelect={selectPage}
        open={searchOpen}
        pages={pages}
        workspaceId={workspace.id}
      />
    </div>
  );
}

function HeaderMenuButton({
  icon: Icon,
  label,
  onClick,
}: {
  icon: typeof MoreHorizontal;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      className="flex h-9 w-full items-center gap-2 rounded-md px-2 text-left hover:bg-zinc-100"
      onClick={onClick}
      type="button"
    >
      <Icon className="size-4 text-zinc-500" /> {label}
    </button>
  );
}

function PresenceList({ online }: { online: OnlineCollaborator[] }) {
  if (!online.length) return null;
  const visible = online.slice(0, 3);
  return (
    <div className="mr-1 flex -space-x-1.5" title={`${online.length} en línea`}>
      {visible.map((collaborator) => (
        <span
          aria-label={`${collaborator.label} está en línea`}
          className="grid size-7 place-items-center rounded-full border-2 border-white bg-indigo-100 text-[10px] font-semibold text-indigo-700"
          key={collaborator.userId}
          title={`${collaborator.label} · en línea`}
        >
          {collaborator.label.slice(0, 2).toUpperCase()}
        </span>
      ))}
      {online.length > visible.length && (
        <span className="grid size-7 place-items-center rounded-full border-2 border-white bg-zinc-100 text-[10px] font-medium text-zinc-600">
          +{online.length - visible.length}
        </span>
      )}
    </div>
  );
}
