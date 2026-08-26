import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { QueryProvider } from "@/components/providers/query-provider";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { WorkspaceShell } from "@/components/workspace/workspace-shell";
import { getServerSupabase } from "@/lib/supabase/server";
import type { WorkspacePage, WorkspaceSummary } from "@/lib/types";

export const metadata: Metadata = { title: "Workspace" };

export default async function WorkspacePage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
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

  const { data: membership, error: membershipError } = await supabase
    .from("workspace_members")
    .select("role, workspaces(id, name, icon)")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();
  const workspaceData = Array.isArray(membership?.workspaces)
    ? membership.workspaces[0]
    : membership?.workspaces;

  if (!membership || !workspaceData || membershipError) {
    return (
      <main className="grid min-h-screen place-items-center bg-zinc-50 px-5">
        <Card className="max-w-lg border-red-200">
          <CardHeader>
            <CardTitle>No encontramos tu workspace</CardTitle>
            <CardDescription>
              {membershipError?.message ?? "La membresía inicial no está disponible."}
            </CardDescription>
          </CardHeader>
        </Card>
      </main>
    );
  }

  const { data: pages, error: pagesError } = await supabase
    .from("pages")
    .select("*")
    .eq("workspace_id", workspaceData.id)
    .order("position", { ascending: true });

  if (pagesError) {
    return (
      <main className="grid min-h-screen place-items-center bg-zinc-50 px-5">
        <Card className="max-w-lg border-red-200">
          <CardHeader>
            <CardTitle>No pudimos cargar las páginas</CardTitle>
            <CardDescription>{pagesError.message}</CardDescription>
          </CardHeader>
        </Card>
      </main>
    );
  }

  const requested = await searchParams;
  const workspace: WorkspaceSummary = {
    id: workspaceData.id,
    name: workspaceData.name,
    icon: workspaceData.icon,
    role: membership.role as WorkspaceSummary["role"],
  };

  return (
    <QueryProvider>
      <WorkspaceShell
        email={user.email ?? "Cuenta"}
        initialPages={(pages ?? []) as WorkspacePage[]}
        initialSelectedPageId={requested.page ?? null}
        userId={user.id}
        workspace={workspace}
      />
    </QueryProvider>
  );
}
