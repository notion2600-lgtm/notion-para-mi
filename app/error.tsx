"use client";

import { AlertTriangle, RotateCcw } from "lucide-react";
import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <main className="grid min-h-screen place-items-center bg-zinc-50 px-5" id="main-content">
      <div className="max-w-md rounded-2xl border bg-white p-8 text-center shadow-sm">
        <span className="mx-auto grid size-12 place-items-center rounded-xl bg-red-50 text-red-600">
          <AlertTriangle className="size-5" />
        </span>
        <h1 className="mt-5 text-2xl font-semibold">Algo salió mal</h1>
        <p className="mt-2 text-sm leading-6 text-zinc-500">
          Tus datos siguen guardados. Puedes volver a intentar cargar esta pantalla.
        </p>
        <button className="mt-6 inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500" onClick={reset} type="button">
          <RotateCcw className="size-4" /> Reintentar
        </button>
      </div>
    </main>
  );
}
