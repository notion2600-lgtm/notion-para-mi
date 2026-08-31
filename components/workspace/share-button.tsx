"use client";

import { Check, Copy, Globe2, LoaderCircle, Lock, MailPlus, Share2 } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { usePageShare } from "@/hooks/use-page-share";
import { useWorkspaceTeam } from "@/hooks/use-workspace-team";
import type { WorkspaceInvitation, WorkspacePage, WorkspaceSummary } from "@/lib/types";

export function ShareButton({
  onMakeTeam,
  pageId,
  pageVisibility,
  title,
  userId,
  workspace,
}: {
  onMakeTeam: () => Promise<boolean>;
  pageId: string;
  pageVisibility: WorkspacePage["visibility"];
  title: string;
  userId: string;
  workspace: WorkspaceSummary;
}) {
  const { isLoading, publish, share, unpublish } = usePageShare(pageId);
  const { invite } = useWorkspaceTeam({ userId, workspace });
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"editor" | "viewer">("editor");
  const [inviting, setInviting] = useState(false);
  const [invitation, setInvitation] = useState<WorkspaceInvitation | null>(null);
  const publicUrl =
    share?.public_slug && typeof window !== "undefined"
      ? `${window.location.origin}/p/${share.public_slug}`
      : "";

  useEffect(() => {
    function close(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, []);

  async function copyLink() {
    if (!publicUrl) return;
    await navigator.clipboard.writeText(publicUrl);
    setCopied(true);
    toast.success("Enlace público copiado");
    window.setTimeout(() => setCopied(false), 1500);
  }

  function invitationUrl(value: WorkspaceInvitation) {
    return `${window.location.origin}/invite/${value.token}`;
  }

  async function copyInvitation(value: WorkspaceInvitation) {
    await navigator.clipboard.writeText(invitationUrl(value));
    toast.success("Enlace de invitación copiado");
  }

  async function createInvitation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!inviteEmail.trim() || inviting) return;
    setInviting(true);
    if (pageVisibility !== "team") {
      const shared = await onMakeTeam();
      if (!shared) {
        setInviting(false);
        return;
      }
    }
    const created = await invite(inviteEmail, inviteRole);
    setInviting(false);
    if (!created) return;
    setInvitation(created);
    setInviteEmail("");
    await copyInvitation(created);
  }

  return (
    <div className="relative">
      <Button onClick={() => setOpen((value) => !value)} size="sm" variant="ghost">
        <Share2 className="size-4" />
        <span className="hidden sm:inline">Compartir</span>
      </Button>
      {open && (
        <section className="absolute right-0 top-10 z-50 w-[min(25rem,calc(100vw-2rem))] overflow-hidden rounded-xl border bg-white shadow-2xl">
          <div className="p-4">
            <div className="flex items-start gap-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-blue-50 text-blue-600">
                <MailPlus className="size-4" />
              </span>
              <div>
                <h2 className="text-sm font-semibold">Compartir con personas</h2>
                <p className="mt-1 text-xs leading-5 text-zinc-500">
                  Invita mediante su correo electrónico y elige si puede editar o solo leer.
                </p>
              </div>
            </div>

            {workspace.role === "owner" ? (
              <>
                <form className="mt-3 flex gap-2" onSubmit={createInvitation}>
                  <Input
                    aria-label="Correo electrónico de la persona"
                    className="min-w-0 flex-1"
                    onChange={(event) => setInviteEmail(event.target.value)}
                    placeholder="persona@empresa.com"
                    required
                    type="email"
                    value={inviteEmail}
                  />
                  <select
                    aria-label="Permiso de la persona"
                    className="h-10 rounded-md border bg-white px-2 text-xs"
                    onChange={(event) => setInviteRole(event.target.value as "editor" | "viewer")}
                    value={inviteRole}
                  >
                    <option value="editor">Puede editar</option>
                    <option value="viewer">Solo lectura</option>
                  </select>
                  <Button disabled={inviting} size="sm" type="submit">
                    {inviting ? <LoaderCircle className="size-3.5 animate-spin" /> : <MailPlus className="size-3.5" />}
                    Invitar
                  </Button>
                </form>
                {pageVisibility !== "team" && (
                  <p className="mt-2 text-[11px] text-zinc-400">
                    Al invitar, esta página y sus subpáginas pasarán a Espacios de equipo.
                  </p>
                )}
                {invitation && (
                  <div className="mt-3 rounded-lg border bg-zinc-50 p-2.5">
                    <p className="truncate text-xs font-medium text-zinc-700">
                      Invitación lista para {invitation.email}
                    </p>
                    <div className="mt-2 flex gap-2">
                      <input
                        aria-label="Enlace de invitación"
                        className="h-8 min-w-0 flex-1 rounded-md border bg-white px-2 text-[11px]"
                        readOnly
                        value={invitationUrl(invitation)}
                      />
                      <Button onClick={() => void copyInvitation(invitation)} size="sm" type="button" variant="outline">
                        <Copy className="size-3.5" /> Copiar
                      </Button>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <p className="mt-3 rounded-lg bg-zinc-50 px-3 py-2 text-xs text-zinc-500">
                Solo el propietario del espacio puede invitar a nuevas personas.
              </p>
            )}
          </div>

          <div className="border-t p-4">
          <div className="flex items-start gap-3">
            <span className={`grid size-9 shrink-0 place-items-center rounded-lg ${share?.is_public ? "bg-emerald-50 text-emerald-600" : "bg-zinc-100 text-zinc-500"}`}>
              {share?.is_public ? <Globe2 className="size-4" /> : <Lock className="size-4" />}
            </span>
            <div>
              <h2 className="text-sm font-semibold">Publicar en la web</h2>
              <p className="mt-1 text-xs leading-5 text-zinc-500">
                Cualquier persona con el enlace podrá leer esta página y sus subpáginas, sin iniciar sesión.
              </p>
            </div>
          </div>
          {share?.is_public ? (
            <div className="mt-4 space-y-3">
              <div className="flex gap-2">
                <input
                  aria-label="Enlace público"
                  className="h-9 min-w-0 flex-1 rounded-md border bg-zinc-50 px-2 text-xs"
                  readOnly
                  value={publicUrl}
                />
                <Button onClick={() => void copyLink()} size="sm" variant="outline">
                  {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                  Copiar
                </Button>
              </div>
              <button
                className="text-xs font-medium text-red-600 hover:underline"
                onClick={() => void unpublish()}
                type="button"
              >
                Dejar de publicar
              </button>
            </div>
          ) : (
            <Button
              className="mt-4 w-full"
              disabled={isLoading}
              onClick={() => void publish(title)}
              size="sm"
            >
              <Globe2 className="size-3.5" /> Publicar página
            </Button>
          )}
          </div>
        </section>
      )}
    </div>
  );
}
