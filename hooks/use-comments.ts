"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";
import { toast } from "sonner";

import { createClient } from "@/lib/supabase/client";
import type { WorkspaceMember } from "@/lib/types";

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

type RawComment = {
  id: string;
  page_id: string;
  block_id: string | null;
  user_id: string;
  body: string;
  resolved: boolean;
  created_at: string;
};

export function useComments(
  pageId: string,
  currentUser?: { id: string; label: string },
  members: WorkspaceMember[] = [],
) {
  const supabase = useMemo(() => createClient(), []);
  const queryClient = useQueryClient();
  const queryKey = ["comments", pageId] as const;

  const query = useQuery({
    queryKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("comments")
        .select("id, page_id, block_id, user_id, body, resolved, created_at")
        .eq("page_id", pageId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as RawComment[];
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

  const comments = useMemo<PageComment[]>(
    () =>
      (query.data ?? []).map((row) => {
        const isCurrentUser = currentUser && row.user_id === currentUser.id;
        const member = members.find((item) => item.user_id === row.user_id);
        return {
          ...row,
          author_avatar: member?.avatar_url ?? null,
          author_name: isCurrentUser
            ? currentUser.label
            : member?.full_name || "Sin nombre",
        };
      }),
    [currentUser, members, query.data],
  );

  return {
    addComment,
    comments,
    deleteComment,
    isLoading: query.isLoading,
    setResolved,
    unresolvedCount: comments.filter((comment) => !comment.resolved).length,
  };
}
