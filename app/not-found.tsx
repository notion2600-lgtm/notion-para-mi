import { ArrowLeft, FileQuestion } from "lucide-react";
import Link from "next/link";

export default function NotFound() {
  return (
    <main className="grid min-h-screen place-items-center bg-zinc-50 px-5" id="main-content">
      <div className="max-w-md text-center">
        <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-white text-zinc-400 shadow-sm">
          <FileQuestion className="size-6" />
        </span>
        <p className="mt-6 text-xs font-semibold uppercase tracking-[0.2em] text-indigo-500">Error 404</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Esta página no está disponible</h1>
        <p className="mt-3 text-sm leading-6 text-zinc-500">
          Es posible que el enlace haya cambiado, sea privado o ya no exista.
        </p>
        <Link className="mt-7 inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500" href="/">
          <ArrowLeft className="size-4" /> Volver al inicio
        </Link>
      </div>
    </main>
  );
}
