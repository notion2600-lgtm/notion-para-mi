import { CheckCircle2, Database, Layers3 } from "lucide-react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { SignOutButton } from "@/components/auth/sign-out-button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getServerSupabase } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Workspace" };

export default async function WorkspacePage() {
  const supabase = await getServerSupabase();

  if (!supabase) {
    return (
      <main className="grid min-h-screen place-items-center bg-zinc-50 px-5">
        <Card className="max-w-lg">
          <CardHeader>
            <CardTitle>Conecta Supabase para continuar</CardTitle>
            <CardDescription>
              Completa las variables de <code>.env.local</code> y aplica la migración SQL.
            </CardDescription>
          </CardHeader>
        </Card>
      </main>
    );
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: membership, error } = await supabase
    .from("workspace_members")
    .select("role, workspaces(id, name, icon)")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  const workspace = Array.isArray(membership?.workspaces)
    ? membership.workspaces[0]
    : membership?.workspaces;

  return (
    <main className="min-h-screen bg-zinc-50">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="grid size-9 place-items-center rounded-lg bg-indigo-600 text-white">
              <Layers3 aria-hidden="true" className="size-4" />
            </span>
            <div>
              <p className="font-semibold">{workspace?.name ?? "Workspace"}</p>
              <p className="text-xs text-zinc-500">{user.email}</p>
            </div>
          </div>
          <SignOutButton />
        </div>
      </header>

      <section className="mx-auto max-w-5xl px-6 py-16">
        {workspace ? (
          <>
            <div className="mb-8 flex items-start gap-4">
              <span className="text-4xl" role="img" aria-label="Workspace">
                {workspace.icon || "✨"}
              </span>
              <div>
                <h1 className="text-3xl font-semibold tracking-tight">{workspace.name}</h1>
                <p className="mt-2 text-zinc-500">Tu espacio privado está listo.</p>
              </div>
            </div>
            <Card className="max-w-2xl">
              <CardHeader>
                <div className="mb-2 grid size-10 place-items-center rounded-lg bg-emerald-50 text-emerald-700">
                  <CheckCircle2 aria-hidden="true" className="size-5" />
                </div>
                <CardTitle>Fase 0 conectada</CardTitle>
                <CardDescription>
                  Tu sesión, perfil y membresía se cargaron desde la base de datos real.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex items-center gap-2 text-sm text-zinc-600">
                <Database aria-hidden="true" className="size-4" />
                Rol: {membership?.role}
              </CardContent>
            </Card>
          </>
        ) : (
          <Card className="max-w-lg border-red-200">
            <CardHeader>
              <CardTitle>No encontramos el workspace inicial</CardTitle>
              <CardDescription>
                {error?.message ?? "Aplica la migración y vuelve a registrar el usuario."}
              </CardDescription>
            </CardHeader>
          </Card>
        )}
      </section>
    </main>
  );
}
