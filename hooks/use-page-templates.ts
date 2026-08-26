"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { toast } from "sonner";

import { createClient } from "@/lib/supabase/client";
import type { PageTemplate } from "@/lib/types";

export function usePageTemplates(workspaceId: string) {
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

  return {
    ...query,
    deleteTemplate,
    templates: query.data ?? [],
  };
}
