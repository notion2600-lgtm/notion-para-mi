"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";
import { toast } from "sonner";

import { createClient } from "@/lib/supabase/client";
import type { DatabaseView, DatabaseViewType } from "@/lib/types";

export const DATABASE_VIEW_TYPES: Array<{
  label: string;
  value: DatabaseViewType;
}> = [
  { label: "Tabla", value: "table" },
  { label: "Tablero", value: "board" },
  { label: "Lista", value: "list" },
  { label: "Calendario", value: "calendar" },
  { label: "Galería", value: "gallery" },
];

function viewName(type: DatabaseViewType) {
  return DATABASE_VIEW_TYPES.find((view) => view.value === type)?.label ?? "Vista";
}

function newView(databaseId: string, type: DatabaseViewType, position: number): DatabaseView {
  return {
    filters: { mode: "and", rules: [] },
    group_by: null,
    id: crypto.randomUUID(),
    name: viewName(type),
    page_id: databaseId,
    position,
    sorts: [],
    type,
    visible_properties: [],
  };
}

export function useDatabaseViews(databaseId: string) {
  const supabase = useMemo(() => createClient(), []);
  const queryClient = useQueryClient();
  const queryKey = ["database-views", databaseId] as const;
  const query = useQuery({
    queryKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("db_views")
        .select("*")
        .eq("page_id", databaseId)
        .order("position", { ascending: true });
      if (error) throw error;
      if (data?.length) {
        return (data as DatabaseView[]).map((view): DatabaseView => ({
          ...view,
          filters: {
            calendarMode: view.filters?.calendarMode === "week" ? "week" : "month",
            mode: view.filters?.mode === "or" ? "or" : "and",
            rules: Array.isArray(view.filters?.rules) ? view.filters.rules : [],
          },
          sorts: Array.isArray(view.sorts) ? view.sorts : [],
          visible_properties: Array.isArray(view.visible_properties)
            ? view.visible_properties
            : [],
        }));
      }

      const initialView = newView(databaseId, "table", 1000);
      const { error: insertError } = await supabase.from("db_views").insert(initialView);
      if (insertError) throw insertError;
      return [initialView];
    },
  });

  useEffect(() => {
    const channel = supabase
      .channel(`database-views:${databaseId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          filter: `page_id=eq.${databaseId}`,
          schema: "public",
          table: "db_views",
        },
        () =>
          void queryClient.invalidateQueries({
            queryKey: ["database-views", databaseId],
          }),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [databaseId, queryClient, supabase]);

  function current() {
    return queryClient.getQueryData<DatabaseView[]>(queryKey) ?? [];
  }

  function setViews(views: DatabaseView[]) {
    queryClient.setQueryData(queryKey, views);
  }

  async function createView(type: DatabaseViewType) {
    const previous = current();
    const view = newView(
      databaseId,
      type,
      previous.length
        ? Math.max(...previous.map((item) => Number(item.position))) + 1000
        : 1000,
    );
    const duplicateCount = previous.filter((item) => item.type === type).length;
    if (duplicateCount) view.name = `${view.name} ${duplicateCount + 1}`;
    setViews([...previous, view]);
    const { error } = await supabase.from("db_views").insert(view);
    if (error) {
      setViews(previous);
      toast.error("No se pudo crear la vista", { description: error.message });
      return null;
    }
    return view;
  }

  async function updateView(
    viewId: string,
    changes: Partial<
      Pick<
        DatabaseView,
        | "filters"
        | "group_by"
        | "name"
        | "position"
        | "sorts"
        | "type"
        | "visible_properties"
      >
    >,
  ) {
    const previous = current();
    setViews(
      previous.map((view) => (view.id === viewId ? { ...view, ...changes } : view)),
    );
    const { error } = await supabase.from("db_views").update(changes).eq("id", viewId);
    if (error) {
      setViews(previous);
      toast.error("No se pudo guardar la vista", { description: error.message });
      return false;
    }
    return true;
  }

  async function deleteView(viewId: string) {
    const previous = current();
    if (previous.length <= 1) {
      toast.error("La base de datos debe conservar al menos una vista");
      return false;
    }
    setViews(previous.filter((view) => view.id !== viewId));
    const { error } = await supabase.from("db_views").delete().eq("id", viewId);
    if (error) {
      setViews(previous);
      toast.error("No se pudo eliminar la vista", { description: error.message });
      return false;
    }
    toast.success("Vista eliminada");
    return true;
  }

  return {
    ...query,
    createView,
    deleteView,
    updateView,
    views: query.data ?? [],
  };
}
