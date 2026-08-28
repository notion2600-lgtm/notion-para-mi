"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { toast } from "sonner";

import { createClient } from "@/lib/supabase/client";
import type {
  DatabaseProperty,
  DatabasePropertyConfig,
  DatabasePropertyType,
} from "@/lib/types";

const PROPERTY_NAMES: Record<DatabasePropertyType, string> = {
  text: "Texto",
  number: "Número",
  select: "Selección",
  multi_select: "Selección múltiple",
  status: "Estado",
  date: "Fecha",
  checkbox: "Casilla",
  url: "URL",
  email: "Email",
  phone: "Teléfono",
  person: "Persona",
  relation: "Relación",
  created_time: "Creado",
  last_edited_time: "Última edición",
};

export const DATABASE_PROPERTY_TYPES = Object.entries(PROPERTY_NAMES).map(
  ([value, label]) => ({ label, value: value as DatabasePropertyType }),
);

function defaultConfig(type: DatabasePropertyType): DatabasePropertyConfig {
  const base = { hidden: false, width: 180 };
  if (type === "number") return { ...base, numberFormat: "number" };
  if (type === "select" || type === "multi_select" || type === "status") {
    return { ...base, options: [] };
  }
  if (type === "date") return { ...base, range: false };
  return base;
}

export function useDatabaseProperties(databaseId: string) {
  const supabase = useMemo(() => createClient(), []);
  const queryClient = useQueryClient();
  const queryKey = ["database-properties", databaseId] as const;
  const query = useQuery({
    queryKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("db_properties")
        .select("*")
        .eq("page_id", databaseId)
        .order("position", { ascending: true });
      if (error) throw error;
      return (data ?? []) as DatabaseProperty[];
    },
  });

  function current() {
    return queryClient.getQueryData<DatabaseProperty[]>(queryKey) ?? [];
  }

  function setProperties(properties: DatabaseProperty[]) {
    queryClient.setQueryData(queryKey, properties);
  }

  async function createProperty(
    type: DatabasePropertyType = "text",
    requestedName?: string,
  ) {
    const previous = current();
    const property: DatabaseProperty = {
      config: defaultConfig(type),
      id: crypto.randomUUID(),
      name: requestedName?.trim() || PROPERTY_NAMES[type],
      page_id: databaseId,
      position: previous.length
        ? Math.max(...previous.map((item) => Number(item.position))) + 1000
        : 1000,
      type,
    };
    setProperties([...previous, property]);
    const { error } = await supabase.from("db_properties").insert(property);
    if (error) {
      setProperties(previous);
      toast.error("No se pudo crear la propiedad", { description: error.message });
      return null;
    }
    toast.success("Columna añadida");
    return property;
  }

  async function updateProperty(
    propertyId: string,
    changes: Partial<Pick<DatabaseProperty, "config" | "name" | "position" | "type">>,
  ) {
    const previous = current();
    setProperties(
      previous
        .map((property) =>
          property.id === propertyId ? { ...property, ...changes } : property,
        )
        .sort((a, b) => Number(a.position) - Number(b.position)),
    );
    const { error } = await supabase
      .from("db_properties")
      .update(changes)
      .eq("id", propertyId);
    if (error) {
      setProperties(previous);
      toast.error("No se pudo actualizar la propiedad", {
        description: error.message,
      });
      return false;
    }
    return true;
  }

  async function deleteProperty(propertyId: string) {
    const previous = current();
    setProperties(previous.filter((property) => property.id !== propertyId));
    const { error } = await supabase
      .from("db_properties")
      .delete()
      .eq("id", propertyId);
    if (error) {
      setProperties(previous);
      toast.error("No se pudo eliminar la propiedad", {
        description: error.message,
      });
      return false;
    }
    toast.success("Propiedad eliminada");
    return true;
  }

  async function moveProperty(propertyId: string, direction: -1 | 1) {
    const previous = [...current()].sort(
      (a, b) => Number(a.position) - Number(b.position),
    );
    const index = previous.findIndex((property) => property.id === propertyId);
    const targetIndex = index + direction;
    if (index < 0 || targetIndex < 0 || targetIndex >= previous.length) return false;
    const moving = previous[index];
    const target = previous[targetIndex];
    const next = previous.map((property) => {
      if (property.id === moving.id) return { ...property, position: target.position };
      if (property.id === target.id) return { ...property, position: moving.position };
      return property;
    });
    setProperties(next.sort((a, b) => Number(a.position) - Number(b.position)));

    const [{ error: movingError }, { error: targetError }] = await Promise.all([
      supabase
        .from("db_properties")
        .update({ position: target.position })
        .eq("id", moving.id),
      supabase
        .from("db_properties")
        .update({ position: moving.position })
        .eq("id", target.id),
    ]);
    if (movingError || targetError) {
      setProperties(previous);
      toast.error("No se pudo reordenar la propiedad", {
        description: (movingError || targetError)?.message,
      });
      return false;
    }
    return true;
  }

  return {
    ...query,
    createProperty,
    deleteProperty,
    moveProperty,
    properties: query.data ?? [],
    updateProperty,
  };
}
