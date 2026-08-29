import { redirect } from "next/navigation";

import { AcceptInvitation } from "@/components/workspace/accept-invitation";
import { getServerSupabase } from "@/lib/supabase/server";
import type { WorkspaceInvitationPreview } from "@/lib/types";

export default async function InvitationPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const supabase = await getServerSupabase();
  if (!supabase) redirect("/login");

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect(`/login?next=${encodeURIComponent(`/invite/${token}`)}`);
  }

  const { data, error } = await supabase.rpc("get_workspace_invitation", {
    invitation_token: token,
  });
  const invitation = (Array.isArray(data) ? data[0] : data) as
    | WorkspaceInvitationPreview
    | undefined;

  if (error || !invitation) {
    return <InvitationState title="Invitación no disponible" detail="El enlace no existe o ya no está disponible." />;
  }
  if (invitation.accepted_at) {
    return <InvitationState title="Invitación utilizada" detail="Esta invitación ya fue aceptada." />;
  }
  if (new Date(invitation.expires_at).getTime() <= Date.now()) {
    return <InvitationState title="Invitación vencida" detail="Pide al propietario que genere una invitación nueva." />;
  }
  if (user.email?.toLowerCase() !== invitation.invited_email.toLowerCase()) {
    return (
      <InvitationState
        title="Cuenta incorrecta"
        detail={`Esta invitación corresponde a ${invitation.invited_email}. Cierra sesión e ingresa con ese correo.`}
      />
    );
  }

  return (
    <main className="grid min-h-screen place-items-center bg-zinc-50 px-5 py-12">
      <AcceptInvitation invitation={invitation} token={token} />
    </main>
  );
}

function InvitationState({ detail, title }: { detail: string; title: string }) {
  return (
    <main className="grid min-h-screen place-items-center bg-zinc-50 px-5 py-12">
      <div className="w-full max-w-md rounded-2xl border bg-white p-7 text-center shadow-sm">
        <h1 className="text-xl font-semibold">{title}</h1>
        <p className="mt-2 text-sm leading-6 text-zinc-500">{detail}</p>
        <a className="mt-5 inline-flex h-10 items-center rounded-md bg-zinc-900 px-4 text-sm font-medium text-white" href="/workspace">
          Ir a mis espacios
        </a>
      </div>
    </main>
  );
}
