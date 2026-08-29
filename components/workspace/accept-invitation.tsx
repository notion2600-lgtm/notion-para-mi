"use client";

import { LoaderCircle, UsersRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import type { WorkspaceInvitationPreview } from "@/lib/types";

export function AcceptInvitation({
  invitation,
  token,
}: {
  invitation: WorkspaceInvitationPreview;
  token: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function accept() {
    setPending(true);
    setError(null);
    const { data, error: acceptError } = await createClient().rpc(
      "accept_workspace_invitation",
      { invitation_token: token },
    );
    if (acceptError) {
      setError(acceptError.message);
      setPending(false);
      return;
    }
    router.replace(`/workspace?workspace=${data || invitation.workspace_id}`);
    router.refresh();
  }

  return (
    <div className="w-full max-w-md rounded-2xl border bg-white p-7 shadow-sm">
      <span className="grid size-12 place-items-center rounded-xl bg-indigo-50 text-indigo-600">
        <UsersRound className="size-5" />
      </span>
      <p className="mt-5 text-sm text-zinc-500">Te invitaron a colaborar en</p>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight">
        {invitation.workspace_icon || "✨"} {invitation.workspace_name}
      </h1>
      <div className="mt-5 rounded-xl bg-zinc-50 px-4 py-3 text-sm text-zinc-600">
        <p><span className="font-medium text-zinc-800">Cuenta:</span> {invitation.invited_email}</p>
        <p className="mt-1">
          <span className="font-medium text-zinc-800">Permiso:</span>{" "}
          {invitation.invited_role === "editor" ? "Puede editar" : "Solo lectura"}
        </p>
      </div>
      {error && <p className="mt-4 text-sm text-red-600" role="alert">{error}</p>}
      <Button className="mt-5 w-full" disabled={pending} onClick={() => void accept()}>
        {pending && <LoaderCircle className="size-4 animate-spin" />}
        Unirme al espacio
      </Button>
      <p className="mt-3 text-center text-xs text-zinc-400">
        La invitación vence el {formatDate(invitation.expires_at)}.
      </p>
    </div>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("es-PE", {
    dateStyle: "long",
    timeStyle: "short",
  }).format(new Date(value));
}
