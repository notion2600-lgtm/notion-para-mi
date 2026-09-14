"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";
import { toast } from "sonner";

import { createClient } from "@/lib/supabase/client";

export type PageComment = {
  id: string;
  page_id: string;
  block_id: string | null;
  user_id: string;
  body: string;
  resolved: boolean;
  created_at: string;
  author_name: string;
  author_avatar: string | null;
};

export function useComments(pageId: string) {
  const supabase = useMemo(() => createClient(), []);
  const queryClient = useQueryClient();
  const queryKey = ["comments", pageId] as const;

  const query = useQuery({
    queryKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("comments")
        .select("id, page_id, block_id, user_id, body, resolved, created_at, profiles(full_name, avatar_url)")
        .eq("page_id", pageId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []).map((row) => {
        const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
        return {
          author_avatar: (profile as { avatar_url: string | null } | null)?.avatar_url ?? null,
          author_name: (profile as { full_name: string | null } | null)?.full_name || "Sin nombre",
          block_id: row.block_id,
          body: row.body,
          created_at: row.created_at,
          id: row.id,
          page_id: row.page_id,
          resolved: row.resolved,
          user_id: row.user_id,
        } satisfies PageComment;
      });
    },
  });

  useEffect(() => {
    if (!pageId) return;
    const channel = supabase
      .channel(`comments:${pageId}`)
      .on(
        "postgres_changes",
        { event: "*", filter: `page_id=eq.${pageId}`, schema: "public", table: "comments" },
        () => void queryClient.invalidateQueries({ queryKey: ["comments", pageId] }),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [pageId, queryClient, supabase]);

  async function addComment(userId: string, body: string, blockId: string | null = null) {
    const trimmed = body.trim();
    if (!trimmed) return false;
    const { error } = await supabase.from("comments").insert({
      block_id: blockId,
      body: trimmed,
      page_id: pageId,
      user_id: userId,
    });
    if (error) {
      toast.error("No se pudo publicar el comentario", { description: error.message });
      return false;
    }
    await queryClient.invalidateQueries({ queryKey });
    return true;
  }

  async function setResolved(commentId: string, resolved: boolean) {
    const { error } = await supabase
      .from("comments")
      .update({ resolved })
      .eq("id", commentId);
    if (error) {
      toast.error("No se pudo actualizar el comentario", { description: error.message });
      return false;
    }
    await queryClient.invalidateQueries({ queryKey });
    return true;
  }

  async function deleteComment(commentId: string) {
    const { error } = await supabase.from("comments").delete().eq("id", commentId);
    if (error) {
      toast.error("No se pudo eliminar el comentario", { description: error.message });
      return false;
    }
    await queryClient.invalidateQueries({ queryKey });
    return true;
  }

  const comments = query.data ?? [];

  return {
    addComment,
    comments,
    deleteComment,
    isLoading: query.isLoading,
    setResolved,
    unresolvedCount: comments.filter((comment) => !comment.resolved).length,
  };
}
