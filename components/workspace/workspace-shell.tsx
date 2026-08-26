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
  Plus,
  Printer,
  Table2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { DatabaseCanvas } from "@/components/database/database-canvas";
import {
  FavoriteButton,
  PageCanvas,
  SettingsView,
  TrashView,
} from "@/components/workspace/page-canvas";
import { WorkspaceSidebar } from "@/components/workspace/workspace-sidebar";
import { SearchDialog } from "@/components/workspace/search-dialog";
import { TemplatesView } from "@/components/workspace/templates-view";
import { usePageTemplates } from "@/hooks/use-page-templates";
import { usePages } from "@/hooks/use-pages";
import { downloadPageAsMarkdown } from "@/lib/export-page";
import { getBacklinks } from "@/lib/page-links";
import { getDescendantIds, getPagePath } from "@/lib/page-tree";
import type { WorkspacePage, WorkspaceSummary } from "@/lib/types";
import { useWorkspaceUi } from "@/stores/workspace-ui";

export function WorkspaceShell({
  email,
  initialPages,
  initialSelectedPageId,
  userId,
  workspace,
}: {
  email: string;
  initialPages: WorkspacePage[];
  initialSelectedPageId: string | null;
  userId: string;
  workspace: WorkspaceSummary;
}) {
  const router = useRouter();
  const {
    archivePage,
    archiveRows,
    createDatabase,
    createDatabaseRow,
    createFromTemplate,
    createPage,
    deletePagePermanently,
    duplicatePage,
    emptyTrash,
    pages,
    resolveFileUrl,
    restorePage,
    saveAsTemplate,
    uploadPageFile,
    updatePage,
  } = usePages({ initialPages, userId, workspaceId: workspace.id });
  const {
    deleteTemplate,
    isLoading: templatesLoading,
    templates,
  } = usePageTemplates(workspace.id);
  const [newMenuOpen, setNewMenuOpen] = useState(false);
  const [actionsOpen, setActionsOpen] = useState(false);
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
    function openSearch(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLocaleLowerCase() === "k") {
        event.preventDefault();
        setSearchOpen(true);
      }
    }
    window.addEventListener("keydown", openSearch);
    return () => window.removeEventListener("keydown", openSearch);
  }, [setSearchOpen]);

  function selectPage(pageId: string) {
    setSearchOpen(false);
    setSelectedPageId(pageId);
    router.replace(`/workspace?page=${pageId}`, { scroll: false });
  }

  async function createAndSelect(parentPageId: string | null) {
    const page = await createPage(parentPageId);
    if (page) selectPage(page.id);
    return page;
  }

  async function createDatabaseAndSelect() {
    const database = await createDatabase(null);
    if (database) selectPage(database.id);
    setNewMenuOpen(false);
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
        router.replace("/workspace", { scroll: false });
      }
    }
  }

  return (
    <div className="workspace-root flex h-screen overflow-hidden bg-white text-zinc-900">
      {sidebarVisible && (
        <WorkspaceSidebar
          email={email}
          onArchive={archive}
          onCreate={createAndSelect}
          onDuplicate={duplicatePage}
          onMove={(pageId, parentPageId, position) =>
            updatePage(pageId, { parent_page_id: parentPageId, position })
          }
          onSelect={selectPage}
          onUpdate={updatePage}
          pages={pages}
          workspace={workspace}
        />
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
              <span className="font-medium text-zinc-800">Ajustes</span>
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
            {view === "page" && selectedPage && (
              <>
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
            <div className="relative">
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
            </div>
          </div>
        </header>

        <main className="workspace-main min-h-0 flex-1 overflow-y-auto">
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
              onUse={createFromTemplateAndSelect}
              templates={templates}
            />
          ) : view === "settings" ? (
            <SettingsView email={email} workspace={workspace} />
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
