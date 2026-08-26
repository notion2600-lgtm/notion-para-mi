"use client";

import { ChevronRight, Menu, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo } from "react";

import { Button } from "@/components/ui/button";
import {
  FavoriteButton,
  PageCanvas,
  SettingsView,
  TrashView,
} from "@/components/workspace/page-canvas";
import { WorkspaceSidebar } from "@/components/workspace/workspace-sidebar";
import { usePages } from "@/hooks/use-pages";
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
    createPage,
    duplicatePage,
    pages,
    resolveFileUrl,
    restorePage,
    uploadPageFile,
    updatePage,
  } = usePages({ initialPages, userId, workspaceId: workspace.id });
  const {
    selectedPageId,
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

  function selectPage(pageId: string) {
    setSelectedPageId(pageId);
    router.replace(`/workspace?page=${pageId}`, { scroll: false });
  }

  async function createAndSelect(parentPageId: string | null) {
    const page = await createPage(parentPageId);
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
    <div className="flex h-screen overflow-hidden bg-white text-zinc-900">
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
        <header className="flex h-12 shrink-0 items-center border-b px-3">
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
              <FavoriteButton
                favorite={selectedPage.is_favorite}
                onClick={() => updatePage(selectedPage.id, { is_favorite: !selectedPage.is_favorite })}
              />
            )}
            <Button onClick={() => createAndSelect(null)} size="sm" variant="ghost">
              <Plus className="size-4" />
              Nueva
            </Button>
          </div>
        </header>

        <main className="min-h-0 flex-1 overflow-y-auto">
          {view === "trash" ? (
            <TrashView onRestore={restorePage} pages={pages} />
          ) : view === "settings" ? (
            <SettingsView email={email} workspace={workspace} />
          ) : (
            <PageCanvas
              onCreate={() => createAndSelect(null)}
              onCreateSubpage={() =>
                selectedPage ? createPage(selectedPage.id) : Promise.resolve(null)
              }
              onUpdate={updatePage}
              onUploadFile={uploadPageFile}
              page={selectedPage}
              pages={pages}
              resolveFileUrl={resolveFileUrl}
            />
          )}
        </main>
      </div>
    </div>
  );
}
