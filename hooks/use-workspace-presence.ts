"use client";

import { useEffect, useMemo, useState } from "react";

import { createClient } from "@/lib/supabase/client";

export type OnlineCollaborator = {
  userId: string;
  label: string;
};

export function useWorkspacePresence({
  label,
  userId,
  workspaceId,
}: {
  label: string;
  userId: string;
  workspaceId: string;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [online, setOnline] = useState<OnlineCollaborator[]>([
    { label, userId },
  ]);

  useEffect(() => {
    const channel = supabase.channel(`workspace-presence:${workspaceId}`, {
      config: { presence: { key: userId } },
    });

    function syncPresence() {
      const state = channel.presenceState() as Record<
        string,
        Array<{ label?: string; userId?: string }>
      >;
      const collaborators = Object.values(state)
        .flat()
        .filter(
          (entry): entry is { label: string; userId: string } =>
            typeof entry.label === "string" && typeof entry.userId === "string",
        );
      const unique = new Map(
        collaborators.map((collaborator) => [collaborator.userId, collaborator]),
      );
      setOnline([...unique.values()]);
    }

    channel
      .on("presence", { event: "sync" }, syncPresence)
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          void channel.track({
            label,
            onlineAt: new Date().toISOString(),
            userId,
          });
        }
      });

    return () => {
      void channel.untrack();
      void supabase.removeChannel(channel);
    };
  }, [label, supabase, userId, workspaceId]);

  return online;
}
