"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";
import { toast } from "sonner";

import { createClient } from "@/lib/supabase/client";
import type {
  WorkspaceInvitation,
  WorkspaceMember,
  WorkspaceSummary,
} from "@/lib/types";

export function useWorkspaceTeam({
  userId,
  workspace,
}: {
  userId: string;
  workspace: WorkspaceSummary;
}) {
  const supabase = useMemo(() => createClient(), []);
  const queryClient = useQueryClient();
  const queryKey = ["workspace-team", workspace.id] as const;
  const query = useQuery({
    queryKey,
    queryFn: async () => {
      const [{ data: memberData, error: memberError }, invitationResult] =
        await Promise.all([
          supabase.rpc("list_workspace_members", {
            target_workspace_id: workspace.id,
          }),
          workspace.role === "owner"
            ? supabase
                .from("workspace_invitations")
                .select("*")
                .eq("workspace_id", workspace.id)
                .is("accepted_at", null)
                .order("created_at", { ascending: false })
            : Promise.resolve({ data: [], error: null }),
        ]);
      if (memberError) throw memberError;
      if (invitationResult.error) throw invitationResult.error;
      return {
        invitations: (invitationResult.data ?? []) as WorkspaceInvitation[],
        members: (memberData ?? []) as WorkspaceMember[],
      };
    },
  });

  useEffect(() => {
    const channel = supabase
      .channel(`workspace-team:${workspace.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          filter: `workspace_id=eq.${workspace.id}`,
          schema: "public",
          table: "workspace_members",
        },
        () =>
          void queryClient.invalidateQueries({
            queryKey: ["workspace-team", workspace.id],
          }),
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          filter: `workspace_id=eq.${workspace.id}`,
          schema: "public",
          table: "workspace_invitations",
        },
        () =>
          void queryClient.invalidateQueries({
            queryKey: ["workspace-team", workspace.id],
          }),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [queryClient, supabase, workspace.id]);

  async function invite(email: string, role: "editor" | "viewer") {
    const normalizedEmail = email.trim().toLowerCase();
    const { data, error } = await supabase
      .from("workspace_invitations")
      .insert({
        email: normalizedEmail,
        invited_by: userId,
        role,
        workspace_id: workspace.id,
      })
      .select("*")
      .single();
    if (error) {
      toast.error("No se pudo crear la invitación", {
        description: error.code === "23505" ? "Ya existe una invitación pendiente para este correo." : error.message,
      });
      return null;
    }
    const invitation = data as WorkspaceInvitation;
    const next = `/invite/${invitation.token}`;
    const callbackUrl = `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;
    const { error: emailError } = await supabase.auth.signInWithOtp({
      email: normalizedEmail,
      options: {
        emailRedirectTo: callbackUrl,
        shouldCreateUser: true,
      },
    });
    await queryClient.invalidateQueries({ queryKey });
    if (emailError) {
      toast.warning("Invitación creada; comparte el enlace manualmente", {
        description: emailError.message,
      });
    } else {
      toast.success("Invitación enviada por correo");
    }
    return invitation;
  }

  async function updateMemberRole(
    memberId: string,
    role: "editor" | "viewer",
  ) {
    const { error } = await supabase
      .from("workspace_members")
      .update({ role })
      .eq("workspace_id", workspace.id)
      .eq("user_id", memberId);
    if (error) {
      toast.error("No se pudo cambiar el rol", { description: error.message });
      return false;
    }
    await queryClient.invalidateQueries({ queryKey });
    toast.success("Rol actualizado");
    return true;
  }

  async function removeMember(memberId: string) {
    const { error } = await supabase
      .from("workspace_members")
      .delete()
      .eq("workspace_id", workspace.id)
      .eq("user_id", memberId);
    if (error) {
      toast.error("No se pudo retirar al miembro", { description: error.message });
      return false;
    }
    await queryClient.invalidateQueries({ queryKey });
    toast.success("Miembro retirado");
    return true;
  }

  async function revokeInvitation(invitationId: string) {
    const { error } = await supabase
      .from("workspace_invitations")
      .delete()
      .eq("id", invitationId)
      .eq("workspace_id", workspace.id);
    if (error) {
      toast.error("No se pudo cancelar la invitación", { description: error.message });
      return false;
    }
    await queryClient.invalidateQueries({ queryKey });
    toast.success("Invitación cancelada");
    return true;
  }

  return {
    ...query,
    invitations: query.data?.invitations ?? [],
    invite,
    members: query.data?.members ?? [],
    removeMember,
    revokeInvitation,
    updateMemberRole,
  };
}
