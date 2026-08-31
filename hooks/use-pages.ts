"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";
import { toast } from "sonner";

import { getDescendantIds, getNextPosition } from "@/lib/page-tree";
import { createClient } from "@/lib/supabase/client";
import type {
  DatabaseProperty,
  DatabaseView,
  PageTemplate,
  PageType,
  TemplateSnapshot,
  WorkspacePage,
} from "@/lib/types";

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
  const signedUrlCache = useMemo(
    () => new Map<string, { expiresAt: number; url: string }>(),
    [],
  );
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

  useEffect(() => {
    const channel = supabase
      .channel(`workspace-pages:${workspaceId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "pages" },
        (payload) => {
          queryClient.setQueryData<WorkspacePage[]>(
            ["workspace-pages", workspaceId],
            (current = []) => {
              if (payload.eventType === "DELETE") {
                const deletedId = (payload.old as { id?: string }).id;
                return deletedId
                  ? current.filter((page) => page.id !== deletedId)
                  : current;
              }
              const page = payload.new as WorkspacePage;
              if (page.workspace_id !== workspaceId) return current;
              const exists = current.some((item) => item.id === page.id);
              const next = exists
                ? current.map((item) => (item.id === page.id ? page : item))
                : [...current, page];
              return next.sort(
                (a, b) => Number(a.position) - Number(b.position),
              );
            },
          );
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [queryClient, supabase, workspaceId]);

  function currentPages() {
    return queryClient.getQueryData<WorkspacePage[]>(queryKey) ?? [];
  }

  function setPages(pages: WorkspacePage[]) {
    queryClient.setQueryData(queryKey, pages);
  }

  async function createPage(
    parentPageId: string | null = null,
    type: PageType = "doc",
    visibility: WorkspacePage["visibility"] = "private",
  ) {
    const previous = currentPages();
    const parent = parentPageId
      ? previous.find((page) => page.id === parentPageId)
      : null;
    const now = new Date().toISOString();
    const page: WorkspacePage = {
      id: crypto.randomUUID(),
      workspace_id: workspaceId,
      parent_page_id: parentPageId,
      parent_database_id: null,
      type,
      title: type === "database" ? "Base de datos" : "Sin título",
      icon: type === "database" ? "📊" : null,
      cover_url: null,
      content: null,
      plain_text: "",
      properties: {},
      position: getNextPosition(previous, parentPageId),
      is_favorite: false,
      is_archived: false,
      visibility: parent?.visibility ?? visibility,
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

  async function createDatabaseRow(databaseId: string) {
    const previous = currentPages();
    const database = previous.find(
      (page) => page.id === databaseId && page.type === "database",
    );
    if (!database) return null;
    const rows = previous.filter(
      (page) => !page.is_archived && page.parent_database_id === databaseId,
    );
    const now = new Date().toISOString();
    const row: WorkspacePage = {
      id: crypto.randomUUID(),
      workspace_id: workspaceId,
      parent_page_id: null,
      parent_database_id: databaseId,
      type: "doc",
      title: "Sin título",
      icon: null,
      cover_url: null,
      content: null,
      plain_text: "",
      properties: {},
      position: rows.length
        ? Math.max(...rows.map((page) => Number(page.position))) + 1000
        : 1000,
      is_favorite: false,
      is_archived: false,
      visibility: database.visibility,
      archived_at: null,
      created_by: userId,
      created_at: now,
      updated_at: now,
    };
    setPages([...previous, row]);

    const { error } = await supabase.from("pages").insert(row);
    if (error) {
      setPages(previous);
      toast.error("No se pudo crear la fila", { description: error.message });
      return null;
    }
    return row;
  }

  async function archiveRows(rowIds: string[]) {
    if (!rowIds.length) return true;
    const previous = currentPages();
    const archivedAt = new Date().toISOString();
    setPages(
      previous.map((page) =>
        rowIds.includes(page.id)
          ? { ...page, is_archived: true, archived_at: archivedAt }
          : page,
      ),
    );
    const { error } = await supabase
      .from("pages")
      .update({ archived_at: archivedAt, is_archived: true })
      .in("id", rowIds);
    if (error) {
      setPages(previous);
      toast.error("No se pudieron archivar las filas", { description: error.message });
      return false;
    }
    toast.success(`${rowIds.length} ${rowIds.length === 1 ? "fila archivada" : "filas archivadas"}`);
    return true;
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

  async function setPageVisibility(
    pageId: string,
    visibility: WorkspacePage["visibility"],
  ) {
    const previous = currentPages();
    const ids = getDescendantIds(previous, pageId);
    const updatedAt = new Date().toISOString();
    setPages(
      previous.map((page) =>
        ids.includes(page.id)
          ? { ...page, visibility, updated_at: updatedAt }
          : page,
      ),
    );

    const { error } = await supabase
      .from("pages")
      .update({ visibility, updated_at: updatedAt })
      .in("id", ids);
    if (error) {
      setPages(previous);
      toast.error("No se pudo mover la página", { description: error.message });
      return false;
    }
    toast.success(
      visibility === "team"
        ? "Página compartida con el equipo"
        : "Página movida a Privado",
    );
    return true;
  }

  async function snapshotPageTree(pageId: string): Promise<TemplateSnapshot | null> {
    const allPages = currentPages();
    const root = allPages.find((page) => page.id === pageId);
    if (!root) return null;
    const ids = new Set(getDescendantIds(allPages, pageId));
    const scopedPages = allPages.filter((page) => ids.has(page.id));
    const databaseIds = scopedPages
      .filter((page) => page.type === "database")
      .map((page) => page.id);
    let databaseProperties: DatabaseProperty[] = [];
    let databaseViews: DatabaseView[] = [];
    if (databaseIds.length) {
      const [{ data: propertyData, error: propertyError }, { data: viewData, error: viewError }] =
        await Promise.all([
          supabase.from("db_properties").select("*").in("page_id", databaseIds),
          supabase.from("db_views").select("*").in("page_id", databaseIds),
        ]);
      if (propertyError || viewError) {
        toast.error("No se pudo leer toda la estructura", {
          description: (propertyError || viewError)?.message,
        });
        return null;
      }
      databaseProperties = (propertyData ?? []) as DatabaseProperty[];
      databaseViews = (viewData ?? []) as DatabaseView[];
    }

    return {
      pages: scopedPages.map((page) => ({
        content: page.content,
        cover_url: page.cover_url,
        icon: page.icon,
        parent_database_source_id:
          page.id !== root.id && page.parent_database_id && ids.has(page.parent_database_id)
            ? page.parent_database_id
            : null,
        parent_source_id:
          page.id !== root.id && page.parent_page_id && ids.has(page.parent_page_id)
            ? page.parent_page_id
            : null,
        plain_text: page.plain_text,
        position: Number(page.position),
        properties: page.properties,
        source_id: page.id,
        title: page.title,
        type: page.type,
      })),
      properties: databaseProperties.map((property) => ({
        config: property.config,
        name: property.name,
        page_source_id: property.page_id,
        position: Number(property.position),
        source_id: property.id,
        type: property.type,
      })),
      views: databaseViews.map((view) => ({
        filters: view.filters,
        group_by_source_id: view.group_by,
        name: view.name,
        page_source_id: view.page_id,
        position: Number(view.position),
        sorts: view.sorts,
        source_id: view.id,
        type: view.type,
        visible_property_source_ids: view.visible_properties,
      })),
    };
  }

  async function cloneSnapshot(
    snapshot: TemplateSnapshot,
    options: {
      rootParentDatabaseId?: string | null;
      rootParentPageId?: string | null;
      rootTitle?: string;
      successMessage: string;
      visibility?: WorkspacePage["visibility"];
    },
  ) {
    const previous = currentPages();
    const rootSnapshot = snapshot.pages.find(
      (page) => !page.parent_source_id && !page.parent_database_source_id,
    );
    if (!rootSnapshot) {
      toast.error("La plantilla no contiene una página principal válida");
      return null;
    }
    const pageIdMap = new Map(
      snapshot.pages.map((page) => [page.source_id, crypto.randomUUID()]),
    );
    const propertyIdMap = new Map(
      snapshot.properties.map((property) => [property.source_id, crypto.randomUUID()]),
    );
    const now = new Date().toISOString();
    const rootPosition = options.rootParentDatabaseId
      ? nextDatabaseRowPosition(previous, options.rootParentDatabaseId)
      : getNextPosition(previous, options.rootParentPageId ?? null);
    const targetParent = previous.find(
      (page) =>
        page.id === options.rootParentDatabaseId ||
        page.id === options.rootParentPageId,
    );
    const cloneVisibility = targetParent?.visibility ?? options.visibility ?? "private";
    const clonedPages: WorkspacePage[] = snapshot.pages.map((page) => {
      const isRoot = page.source_id === rootSnapshot.source_id;
      return {
        archived_at: null,
        content: remapSnapshotValue(page.content, pageIdMap, propertyIdMap),
        cover_url: page.cover_url,
        created_at: now,
        created_by: userId,
        icon: page.icon,
        id: pageIdMap.get(page.source_id)!,
        is_archived: false,
        is_favorite: false,
        parent_database_id: isRoot
          ? (options.rootParentDatabaseId ?? null)
          : page.parent_database_source_id
            ? (pageIdMap.get(page.parent_database_source_id) ?? null)
            : null,
        parent_page_id: isRoot
          ? (options.rootParentPageId ?? null)
          : page.parent_source_id
            ? (pageIdMap.get(page.parent_source_id) ?? null)
            : null,
        plain_text: page.plain_text,
        position: isRoot ? rootPosition : Number(page.position),
        properties: remapProperties(page.properties, pageIdMap, propertyIdMap),
        title: isRoot && options.rootTitle ? options.rootTitle : page.title,
        type: page.type,
        updated_at: now,
        visibility: cloneVisibility,
        workspace_id: workspaceId,
      };
    });
    const clonedProperties = snapshot.properties.map((property) => ({
      config: property.config,
      id: propertyIdMap.get(property.source_id)!,
      name: property.name,
      page_id: pageIdMap.get(property.page_source_id)!,
      position: Number(property.position),
      type: property.type,
    }));
    const clonedViews = snapshot.views.map((view) => ({
      filters: remapViewFilters(view.filters, propertyIdMap, pageIdMap),
      group_by: view.group_by_source_id
        ? (propertyIdMap.get(view.group_by_source_id) ?? null)
        : null,
      id: crypto.randomUUID(),
      name: view.name,
      page_id: pageIdMap.get(view.page_source_id)!,
      position: Number(view.position),
      sorts: view.sorts.map((sort) => ({
        ...sort,
        id: crypto.randomUUID(),
        property_id:
          sort.property_id === "__title"
            ? "__title"
            : (propertyIdMap.get(sort.property_id) ?? sort.property_id),
      })),
      type: view.type,
      visible_properties: view.visible_property_source_ids.map(
        (propertyId) => propertyIdMap.get(propertyId) ?? propertyId,
      ),
    }));

    const { error: pageError } = await supabase.from("pages").insert(clonedPages);
    if (pageError) {
      toast.error("No se pudo crear la copia", { description: pageError.message });
      return null;
    }
    const propertyResult = clonedProperties.length
      ? await supabase.from("db_properties").insert(clonedProperties)
      : { error: null };
    const viewResult = clonedViews.length
      ? await supabase.from("db_views").insert(clonedViews)
      : { error: null };
    if (propertyResult.error || viewResult.error) {
      await supabase.from("pages").delete().in("id", clonedPages.map((page) => page.id));
      toast.error("No se pudo copiar la configuración completa", {
        description: (propertyResult.error || viewResult.error)?.message,
      });
      return null;
    }

    setPages([...previous, ...clonedPages]);
    toast.success(options.successMessage);
    return clonedPages.find((page) => page.id === pageIdMap.get(rootSnapshot.source_id)) ?? null;
  }

  async function duplicatePage(pageId: string) {
    const source = currentPages().find((page) => page.id === pageId);
    if (!source) return null;
    const snapshot = await snapshotPageTree(pageId);
    if (!snapshot) return null;
    return cloneSnapshot(snapshot, {
      rootParentDatabaseId: source.parent_database_id,
      rootParentPageId: source.parent_page_id,
      rootTitle: `${source.title} copia`,
      successMessage: "Página y subpáginas duplicadas",
      visibility: source.visibility,
    });
  }

  async function saveAsTemplate(pageId: string, requestedName?: string) {
    const page = currentPages().find((candidate) => candidate.id === pageId);
    if (!page) return null;
    const snapshot = await snapshotPageTree(pageId);
    if (!snapshot) return null;
    const template: PageTemplate = {
      created_at: new Date().toISOString(),
      created_by: userId,
      description: `Creada desde “${page.title}” con todas sus subpáginas.`,
      icon: page.icon || "📄",
      id: crypto.randomUUID(),
      is_builtin: false,
      name: requestedName?.trim() || page.title,
      snapshot,
      workspace_id: workspaceId,
    };
    const { error } = await supabase.from("page_templates").insert(template);
    if (error) {
      toast.error("No se pudo guardar la plantilla", { description: error.message });
      return null;
    }
    await queryClient.invalidateQueries({ queryKey: ["page-templates", workspaceId] });
    toast.success("Plantilla guardada");
    return template;
  }

  async function createFromTemplate(template: PageTemplate) {
    return cloneSnapshot(template.snapshot, {
      successMessage: `Página creada desde “${template.name}”`,
    });
  }

  async function deletePagesPermanently(pageIds: string[]) {
    if (!pageIds.length) return true;
    const allPages = currentPages();
    const ids = [...new Set(pageIds.flatMap((pageId) => getDescendantIds(allPages, pageId)))];
    const { data: fileRows, error: fileReadError } = await supabase
      .from("files")
      .select("storage_path")
      .in("page_id", ids);
    if (fileReadError) {
      toast.error("No se pudieron revisar los archivos", { description: fileReadError.message });
      return false;
    }
    const storagePaths = (fileRows ?? [])
      .map((file) => file.storage_path)
      .filter((path): path is string => typeof path === "string");
    if (storagePaths.length) {
      const { error: storageError } = await supabase.storage
        .from("workspace-files")
        .remove(storagePaths);
      if (storageError) {
        toast.error("No se pudieron borrar los archivos", { description: storageError.message });
        return false;
      }
      const { error: fileError } = await supabase.from("files").delete().in("page_id", ids);
      if (fileError) {
        toast.error("No se pudieron borrar los registros de archivos", {
          description: fileError.message,
        });
        return false;
      }
    }
    const { error } = await supabase.from("pages").delete().in("id", ids);
    if (error) {
      toast.error("No se pudo eliminar definitivamente", { description: error.message });
      return false;
    }
    setPages(allPages.filter((page) => !ids.includes(page.id)));
    toast.success(ids.length === 1 ? "Página eliminada definitivamente" : "Páginas eliminadas definitivamente");
    return true;
  }

  async function emptyTrash() {
    const archivedIds = currentPages().filter((page) => page.is_archived).map((page) => page.id);
    return deletePagesPermanently(archivedIds);
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

  async function uploadPageFile(pageId: string, file: File) {
    const safeName = file.name
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9._-]/g, "-")
      .replace(/-+/g, "-")
      .toLowerCase();
    const storagePath = `${workspaceId}/${pageId}/${crypto.randomUUID()}-${safeName || "archivo"}`;
    const { error: uploadError } = await supabase.storage
      .from("workspace-files")
      .upload(storagePath, file, {
        cacheControl: "3600",
        contentType: file.type || "application/octet-stream",
        upsert: false,
      });

    if (uploadError) {
      toast.error("No se pudo subir el archivo", { description: uploadError.message });
      throw uploadError;
    }

    const { error: metadataError } = await supabase.from("files").insert({
      mime: file.type || "application/octet-stream",
      name: file.name,
      page_id: pageId,
      size: file.size,
      storage_path: storagePath,
      workspace_id: workspaceId,
    });
    if (metadataError) {
      await supabase.storage.from("workspace-files").remove([storagePath]);
      toast.error("No se pudo registrar el archivo", {
        description: metadataError.message,
      });
      throw metadataError;
    }

    return storagePath;
  }

  async function resolveFileUrl(path: string) {
    if (/^(https?:|data:|blob:)/i.test(path)) return path;
    const cached = signedUrlCache.get(path);
    if (cached && cached.expiresAt > Date.now()) return cached.url;

    const { data, error } = await supabase.storage
      .from("workspace-files")
      .createSignedUrl(path, 60 * 60);
    if (error) throw error;
    signedUrlCache.set(path, {
      expiresAt: Date.now() + 55 * 60 * 1000,
      url: data.signedUrl,
    });
    return data.signedUrl;
  }

  return {
    ...query,
    pages: query.data,
    archiveRows,
    createPage,
    createDatabase: (parentPageId: string | null = null) =>
      createPage(parentPageId, "database"),
    createTeamPage: () => createPage(null, "doc", "team"),
    createDatabaseRow,
    createFromTemplate,
    deletePagePermanently: (pageId: string) => deletePagesPermanently([pageId]),
    duplicatePage,
    emptyTrash,
    restorePage: (pageId: string) => setArchived(pageId, false),
    archivePage: (pageId: string) => setArchived(pageId, true),
    resolveFileUrl,
    saveAsTemplate,
    setPageVisibility,
    uploadPageFile,
    updatePage,
  };
}

function nextDatabaseRowPosition(pages: WorkspacePage[], databaseId: string) {
  const rows = pages.filter(
    (page) => !page.is_archived && page.parent_database_id === databaseId,
  );
  return rows.length
    ? Math.max(...rows.map((page) => Number(page.position))) + 1000
    : 1000;
}

function remapProperties(
  properties: Record<string, unknown>,
  pageIdMap: Map<string, string>,
  propertyIdMap: Map<string, string>,
) {
  return Object.fromEntries(
    Object.entries(properties).map(([key, value]) => [
      propertyIdMap.get(key) ?? key,
      remapSnapshotValue(value, pageIdMap, propertyIdMap),
    ]),
  );
}

function remapSnapshotValue(
  value: unknown,
  pageIdMap: Map<string, string>,
  propertyIdMap: Map<string, string>,
): unknown {
  if (typeof value === "string") {
    return pageIdMap.get(value) ?? propertyIdMap.get(value) ?? value;
  }
  if (Array.isArray(value)) {
    return value.map((item) => remapSnapshotValue(item, pageIdMap, propertyIdMap));
  }
  if (typeof value === "object" && value !== null) {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        remapSnapshotValue(item, pageIdMap, propertyIdMap),
      ]),
    );
  }
  return value;
}

function remapViewFilters(
  filters: DatabaseView["filters"],
  propertyIdMap: Map<string, string>,
  pageIdMap: Map<string, string>,
) {
  return {
    ...filters,
    mode: filters?.mode === "or" ? "or" as const : "and" as const,
    rules: Array.isArray(filters?.rules)
      ? filters.rules.map((rule) => ({
          ...rule,
          id: crypto.randomUUID(),
          property_id:
            rule.property_id === "__title"
              ? "__title"
              : (propertyIdMap.get(rule.property_id) ?? rule.property_id),
          value: remapSnapshotValue(rule.value, pageIdMap, propertyIdMap),
        }))
      : [],
  };
}
