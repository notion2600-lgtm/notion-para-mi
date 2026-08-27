"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { toast } from "sonner";

import { createClient } from "@/lib/supabase/client";
import type { PageTemplate } from "@/lib/types";

export function usePageTemplates(workspaceId: string, userId: string) {
  const supabase = useMemo(() => createClient(), []);
  const queryClient = useQueryClient();
  const queryKey = ["page-templates", workspaceId] as const;
  const query = useQuery({
    queryKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("page_templates")
        .select("*")
        .order("is_builtin", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as PageTemplate[];
    },
  });

  async function deleteTemplate(templateId: string) {
    const previous = query.data ?? [];
    const template = previous.find((item) => item.id === templateId);
    if (!template || template.is_builtin) return false;
    queryClient.setQueryData(
      queryKey,
      previous.filter((item) => item.id !== templateId),
    );
    const { error } = await supabase.from("page_templates").delete().eq("id", templateId);
    if (error) {
      queryClient.setQueryData(queryKey, previous);
      toast.error("No se pudo eliminar la plantilla", { description: error.message });
      return false;
    }
    toast.success("Plantilla eliminada");
    return true;
  }

  async function importNotionTemplate(file: File) {
    try {
      const { parseNotionTemplate } = await import("@/lib/notion-import");
      const imported = await parseNotionTemplate(file);
      const template: PageTemplate = {
        created_at: new Date().toISOString(),
        created_by: userId,
        description: imported.description,
        icon: imported.icon,
        id: crypto.randomUUID(),
        is_builtin: false,
        name: imported.name,
        snapshot: imported.snapshot,
        workspace_id: workspaceId,
      };
      const { error } = await supabase.from("page_templates").insert(template);
      if (error) throw error;
      await queryClient.invalidateQueries({ queryKey });
      toast.success(`Plantilla “${template.name}” importada`);
      if (imported.warnings.length) {
        toast.warning("Parte del contenido necesita revisión", {
          description: imported.warnings.join(" "),
        });
      }
      return template;
    } catch (error) {
      toast.error("No se pudo importar la plantilla", {
        description: error instanceof Error ? error.message : "Archivo no compatible.",
      });
      return null;
    }
  }

  return {
    ...query,
    deleteTemplate,
    importNotionTemplate,
    templates: query.data ?? [],
  };
}
