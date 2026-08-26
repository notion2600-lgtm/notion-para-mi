"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { toast } from "sonner";

import { getDescendantIds, getNextPosition } from "@/lib/page-tree";
import { createClient } from "@/lib/supabase/client";
import type { WorkspacePage } from "@/lib/types";

export function usePages({
  initialPages,
  userId,
  workspaceId,
}: {
  initialPages: WorkspacePage[];
  userId: string;
  workspaceId: string;
}) {
  const queryClient = useQueryClient();
  const supabase = useMemo(() => createClient(), []);
  const queryKey = ["workspace-pages", workspaceId] as const;
  const query = useQuery({
    queryKey,
    initialData: initialPages,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pages")
        .select("*")
        .eq("workspace_id", workspaceId)
        .order("position", { ascending: true });
      if (error) throw error;
      return (data ?? []) as WorkspacePage[];
    },
  });

  function currentPages() {
    return queryClient.getQueryData<WorkspacePage[]>(queryKey) ?? [];
  }

  function setPages(pages: WorkspacePage[]) {
    queryClient.setQueryData(queryKey, pages);
  }

  async function createPage(parentPageId: string | null = null) {
    const previous = currentPages();
    const now = new Date().toISOString();
    const page: WorkspacePage = {
      id: crypto.randomUUID(),
      workspace_id: workspaceId,
      parent_page_id: parentPageId,
      parent_database_id: null,
      type: "doc",
      title: "Sin título",
      icon: null,
      cover_url: null,
      content: null,
      plain_text: "",
      properties: {},
      position: getNextPosition(previous, parentPageId),
      is_favorite: false,
      is_archived: false,
      archived_at: null,
      created_by: userId,
      created_at: now,
      updated_at: now,
    };
    setPages([...previous, page]);

    const { error } = await supabase.from("pages").insert(page);
    if (error) {
      setPages(previous);
      toast.error("No se pudo crear la página", { description: error.message });
      return null;
    }
    return page;
  }

  async function updatePage(
    pageId: string,
    changes: Partial<WorkspacePage>,
  ) {
    const previous = currentPages();
    const updatedAt = new Date().toISOString();
    setPages(
      previous.map((page) =>
        page.id === pageId ? { ...page, ...changes, updated_at: updatedAt } : page,
      ),
    );

    const { error } = await supabase
      .from("pages")
      .update({ ...changes, updated_at: updatedAt })
      .eq("id", pageId);
    if (error) {
      setPages(previous);
      toast.error("No se pudo guardar el cambio", { description: error.message });
      return false;
    }
    return true;
  }

  async function duplicatePage(pageId: string) {
    const source = currentPages().find((page) => page.id === pageId);
    if (!source) return null;

    const previous = currentPages();
    const now = new Date().toISOString();
    const copy: WorkspacePage = {
      ...source,
      id: crypto.randomUUID(),
      title: `${source.title} copia`,
      position: getNextPosition(previous, source.parent_page_id),
      is_favorite: false,
      created_by: userId,
      created_at: now,
      updated_at: now,
    };
    setPages([...previous, copy]);

    const { error } = await supabase.from("pages").insert(copy);
    if (error) {
      setPages(previous);
      toast.error("No se pudo duplicar la página", { description: error.message });
      return null;
    }
    toast.success("Página duplicada");
    return copy;
  }

  async function setArchived(pageId: string, archived: boolean) {
    const previous = currentPages();
    const ids = getDescendantIds(previous, pageId);
    const archivedAt = archived ? new Date().toISOString() : null;
    setPages(
      previous.map((page) =>
        ids.includes(page.id)
          ? { ...page, is_archived: archived, archived_at: archivedAt }
          : page,
      ),
    );

    const { error } = await supabase
      .from("pages")
      .update({ is_archived: archived, archived_at: archivedAt })
      .in("id", ids);
    if (error) {
      setPages(previous);
      toast.error(archived ? "No se pudo mover a la papelera" : "No se pudo restaurar", {
        description: error.message,
      });
      return false;
    }
    toast.success(archived ? "Página movida a la papelera" : "Página restaurada");
    return true;
  }

  return {
    ...query,
    pages: query.data,
    createPage,
    duplicatePage,
    restorePage: (pageId: string) => setArchived(pageId, false),
    archivePage: (pageId: string) => setArchived(pageId, true),
    updatePage,
  };
}
