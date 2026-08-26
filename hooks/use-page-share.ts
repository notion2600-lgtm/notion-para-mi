"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { toast } from "sonner";

import { createClient } from "@/lib/supabase/client";
import type { PageShare } from "@/lib/types";

export function usePageShare(pageId: string | null) {
  const supabase = useMemo(() => createClient(), []);
  const queryClient = useQueryClient();
  const queryKey = ["page-share", pageId] as const;
  const query = useQuery({
    enabled: Boolean(pageId),
    queryKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("page_shares")
        .select("*")
        .eq("page_id", pageId!)
        .maybeSingle();
      if (error) throw error;
      return (data as PageShare | null) ?? null;
    },
  });

  async function publish(title: string) {
    if (!pageId) return null;
    const current = query.data;
    const publicSlug = current?.public_slug || `${slugify(title)}-${crypto.randomUUID().slice(0, 8)}`;
    const share: PageShare = {
      created_at: current?.created_at ?? new Date().toISOString(),
      is_public: true,
      page_id: pageId,
      public_slug: publicSlug,
    };
    queryClient.setQueryData(queryKey, share);
    const { error } = await supabase.from("page_shares").upsert(share, {
      onConflict: "page_id",
    });
    if (error) {
      queryClient.setQueryData(queryKey, current ?? null);
      toast.error("No se pudo publicar la página", { description: error.message });
      return null;
    }
    toast.success("Página publicada");
    return share;
  }

  async function unpublish() {
    if (!pageId || !query.data) return true;
    const previous = query.data;
    queryClient.setQueryData(queryKey, { ...previous, is_public: false });
    const { error } = await supabase
      .from("page_shares")
      .update({ is_public: false })
      .eq("page_id", pageId);
    if (error) {
      queryClient.setQueryData(queryKey, previous);
      toast.error("No se pudo despublicar", { description: error.message });
      return false;
    }
    toast.success("La página volvió a ser privada");
    return true;
  }

  return {
    ...query,
    publish,
    share: query.data ?? null,
    unpublish,
  };
}

function slugify(title: string) {
  return (
    title
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLocaleLowerCase("es")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "pagina"
  );
}
