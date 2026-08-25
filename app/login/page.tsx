import { Layers3 } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { AuthForm } from "@/components/auth/auth-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = { title: "Iniciar sesión" };

export default function LoginPage() {
  return (
    <main className="grid min-h-screen place-items-center bg-zinc-50 px-5 py-12">
      <div className="w-full max-w-md">
        <Link className="mx-auto mb-7 flex w-fit items-center gap-2 text-sm font-semibold" href="/">
          <span className="grid size-8 place-items-center rounded-lg bg-indigo-600 text-white">
            <Layers3 aria-hidden="true" className="size-4" />
          </span>
          Workspace
        </Link>
        <Card>
          <CardHeader>
            <CardTitle>Qué bueno verte</CardTitle>
            <CardDescription>
              Entra con tu contraseña o recibe un enlace mágico por correo.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Suspense fallback={<p className="text-sm text-zinc-500">Cargando…</p>}>
              <AuthForm mode="login" />
            </Suspense>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
