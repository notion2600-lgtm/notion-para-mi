import { ArrowRight, Layers3, ShieldCheck, Sparkles } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { getServerSupabase } from "@/lib/supabase/server";

export default async function HomePage() {
  const supabase = await getServerSupabase();
  const { data } = supabase
    ? await supabase.auth.getUser()
    : { data: { user: null } };

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_#eef2ff_0,_transparent_36%),linear-gradient(#fff,#fafafa)]">
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <Link className="flex items-center gap-2 text-sm font-semibold" href="/">
          <span className="grid size-8 place-items-center rounded-lg bg-indigo-600 text-white">
            <Layers3 aria-hidden="true" className="size-4" />
          </span>
          Mi espacio
        </Link>
        <Button asChild variant="ghost">
          <Link href={data.user ? "/workspace" : "/login"}>
            {data.user ? "Abrir mi espacio" : "Iniciar sesión"}
          </Link>
        </Button>
      </nav>

      <section className="mx-auto flex max-w-4xl flex-col items-center px-6 pb-24 pt-24 text-center sm:pt-32">
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-indigo-100 bg-indigo-50 px-3 py-1 text-sm text-indigo-700">
          <Sparkles aria-hidden="true" className="size-4" />
          Tu trabajo, en un solo lugar
        </div>
        <h1 className="max-w-3xl text-balance text-5xl font-semibold tracking-[-0.045em] text-zinc-950 sm:text-7xl">
          Un espacio tranquilo para pensar y crear.
        </h1>
        <p className="mt-7 max-w-2xl text-pretty text-lg leading-8 text-zinc-600">
          Escribe, planifica y organiza tus proyectos en un solo lugar.
          Todo permanece privado hasta que decidas compartirlo.
        </p>
        <div className="mt-9 flex flex-col gap-3 sm:flex-row">
          <Button asChild size="lg">
            <Link href={data.user ? "/workspace" : "/signup"}>
              {data.user ? "Continuar" : "Crear mi espacio"}
              <ArrowRight aria-hidden="true" className="size-4" />
            </Link>
          </Button>
          {!data.user && (
            <Button asChild size="lg" variant="outline">
              <Link href="/login">Ya tengo una cuenta</Link>
            </Button>
          )}
        </div>
        <p className="mt-6 flex items-center gap-2 text-sm text-zinc-500">
          <ShieldCheck aria-hidden="true" className="size-4" />
          Tus páginas y archivos son privados por defecto.
        </p>
      </section>
    </main>
  );
}
