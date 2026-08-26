"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import { createClient } from "@/lib/supabase/client";
import type { WorkspacePage } from "@/lib/types";

export function useWorkspaceSearch(workspaceId: string, query: string) {
  const supabase = useMemo(() => createClient(), []);
  const normalized = query.trim();
  return useQuery({
    enabled: normalized.length > 0,
    placeholderData: keepPreviousData,
    queryKey: ["workspace-search", workspaceId, normalized],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pages")
        .select("*")
        .eq("workspace_id", workspaceId)
        .eq("is_archived", false)
        .textSearch("search_vector", normalized, {
          config: "simple",
          type: "websearch",
        })
        .limit(30);
      if (error) throw error;
      return (data ?? []) as WorkspacePage[];
    },
  });
}
