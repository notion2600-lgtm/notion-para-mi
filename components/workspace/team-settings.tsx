"use client";

import {
  Check,
  Copy,
  LoaderCircle,
  MailPlus,
  ShieldCheck,
  Trash2,
  UserRound,
  UsersRound,
} from "lucide-react";
import { FormEvent, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useWorkspaceTeam } from "@/hooks/use-workspace-team";
import type { WorkspaceInvitation, WorkspaceSummary } from "@/lib/types";

export function TeamSettings({
  email,
  userId,
  workspace,
}: {
  email: string;
  userId: string;
  workspace: WorkspaceSummary;
}) {
  const {
    invitations,
    invite,
    isLoading,
    members,
    removeMember,
    revokeInvitation,
    updateMemberRole,
  } = useWorkspaceTeam({ userId, workspace });
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"editor" | "viewer">("editor");
  const [pending, setPending] = useState(false);

  async function copyInvitation(invitation: WorkspaceInvitation) {
    await navigator.clipboard.writeText(
      `${window.location.origin}/invite/${invitation.token}`,
    );
    toast.success("Enlace de invitación copiado");
  }

  async function createInvitation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!inviteEmail.trim()) return;
    setPending(true);
    const invitation = await invite(inviteEmail, inviteRole);
    setPending(false);
    if (!invitation) return;
    setInviteEmail("");
    await copyInvitation(invitation);
  }

  return (
    <div className="mx-auto w-full max-w-[900px] px-5 py-12 sm:px-12 sm:py-16">
      <div className="flex items-center gap-3">
        <span className="grid size-11 place-items-center rounded-xl bg-indigo-50 text-indigo-600">
          <UsersRound className="size-5" />
        </span>
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Personas y equipo</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Administra quién puede acceder a {workspace.name}.
          </p>
        </div>
      </div>

      <section className="mt-8 rounded-xl border bg-white p-5">
        <div className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-lg bg-zinc-100 text-xl">
            {workspace.icon || "✨"}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold">{workspace.name}</p>
            <p className="text-xs text-zinc-500">{email} · {roleLabel(workspace.role)}</p>
          </div>
          <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs text-zinc-600">
            {members.length} {members.length === 1 ? "miembro" : "miembros"}
          </span>
        </div>
      </section>

      {workspace.role === "owner" && (
        <section className="mt-5 rounded-xl border bg-white p-5">
          <div className="mb-4 flex items-center gap-2">
            <MailPlus className="size-4 text-indigo-600" />
            <div>
              <h2 className="font-semibold">Invitar a una persona</h2>
              <p className="text-xs text-zinc-500">
                El enlace funcionará únicamente con el correo indicado y vencerá en 7 días.
              </p>
            </div>
          </div>
          <form className="flex flex-col gap-2 sm:flex-row" onSubmit={createInvitation}>
            <Input
              aria-label="Correo de la persona invitada"
              className="flex-1"
              onChange={(event) => setInviteEmail(event.target.value)}
              placeholder="persona@empresa.com"
              required
              type="email"
              value={inviteEmail}
            />
            <select
              aria-label="Rol de la invitación"
              className="h-10 rounded-md border bg-white px-3 text-sm"
              onChange={(event) => setInviteRole(event.target.value as "editor" | "viewer")}
              value={inviteRole}
            >
              <option value="editor">Puede editar</option>
              <option value="viewer">Solo lectura</option>
            </select>
            <Button disabled={pending} type="submit">
              {pending ? <LoaderCircle className="size-4 animate-spin" /> : <MailPlus className="size-4" />}
              Enviar invitación
            </Button>
          </form>
        </section>
      )}

      <section className="mt-5 overflow-hidden rounded-xl border bg-white">
        <div className="border-b px-5 py-4">
          <h2 className="font-semibold">Miembros</h2>
          <p className="text-xs text-zinc-500">Los cambios de permisos se aplican inmediatamente.</p>
        </div>
        {isLoading ? (
          <div className="flex items-center gap-2 px-5 py-8 text-sm text-zinc-500">
            <LoaderCircle className="size-4 animate-spin" /> Cargando equipo…
          </div>
        ) : (
          <div className="divide-y">
            {members.map((member) => (
              <div className="flex items-center gap-3 px-5 py-3" key={member.user_id}>
                <span className="grid size-9 shrink-0 place-items-center overflow-hidden rounded-full bg-indigo-50 text-sm font-semibold text-indigo-700">
                  {member.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img alt="" className="size-full object-cover" src={member.avatar_url} />
                  ) : (
                    initials(member.full_name)
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {member.full_name || "Miembro"}
                    {member.user_id === userId && <span className="ml-1 text-xs text-zinc-400">(tú)</span>}
                  </p>
                  <p className="text-xs text-zinc-500">{roleLabel(member.role)}</p>
                </div>
                {workspace.role === "owner" && member.role !== "owner" ? (
                  <>
                    <select
                      aria-label={`Rol de ${member.full_name}`}
                      className="h-8 rounded-md border bg-white px-2 text-xs"
                      onChange={(event) =>
                        void updateMemberRole(
                          member.user_id,
                          event.target.value as "editor" | "viewer",
                        )
                      }
                      value={member.role}
                    >
                      <option value="editor">Puede editar</option>
                      <option value="viewer">Solo lectura</option>
                    </select>
                    <button
                      aria-label={`Retirar a ${member.full_name}`}
                      className="grid size-8 place-items-center rounded-md text-zinc-400 hover:bg-red-50 hover:text-red-600"
                      onClick={() => {
                        if (window.confirm(`¿Retirar a ${member.full_name} del espacio?`)) {
                          void removeMember(member.user_id);
                        }
                      }}
                      type="button"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </>
                ) : member.role === "owner" ? (
                  <span className="flex items-center gap-1 text-xs text-zinc-500">
                    <ShieldCheck className="size-3.5" /> Propietario
                  </span>
                ) : (
                  <span className="text-xs text-zinc-500">{roleLabel(member.role)}</span>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {workspace.role === "owner" && invitations.length > 0 && (
        <section className="mt-5 overflow-hidden rounded-xl border bg-white">
          <div className="border-b px-5 py-4">
            <h2 className="font-semibold">Invitaciones pendientes</h2>
          </div>
          <div className="divide-y">
            {invitations.map((invitation) => {
              const expired = new Date(invitation.expires_at).getTime() <= Date.now();
              return (
                <div className="flex items-center gap-3 px-5 py-3" key={invitation.id}>
                  <span className="grid size-9 place-items-center rounded-full bg-zinc-100 text-zinc-500">
                    {expired ? <UserRound className="size-4" /> : <Check className="size-4" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{invitation.email}</p>
                    <p className="text-xs text-zinc-500">
                      {expired ? "Invitación vencida" : `${roleLabel(invitation.role)} · vence ${formatDate(invitation.expires_at)}`}
                    </p>
                  </div>
                  {!expired && (
                    <button
                      className="flex h-8 items-center gap-1.5 rounded-md px-2 text-xs text-zinc-600 hover:bg-zinc-100"
                      onClick={() => void copyInvitation(invitation)}
                      type="button"
                    >
                      <Copy className="size-3.5" /> Copiar enlace
                    </button>
                  )}
                  <button
                    aria-label={`Cancelar invitación de ${invitation.email}`}
                    className="grid size-8 place-items-center rounded-md text-zinc-400 hover:bg-red-50 hover:text-red-600"
                    onClick={() => void revokeInvitation(invitation.id)}
                    type="button"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "?";
}

function roleLabel(role: WorkspaceSummary["role"]) {
  if (role === "owner") return "Propietario";
  if (role === "editor") return "Puede editar";
  return "Solo lectura";
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("es-PE", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}
