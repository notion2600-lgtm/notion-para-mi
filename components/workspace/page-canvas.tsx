"use client";

import { FileText, Plus, RotateCcw, Settings2, Star, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import type { WorkspacePage, WorkspaceSummary } from "@/lib/types";

export function PageCanvas({
  onCreate,
  onUpdate,
  page,
}: {
  onCreate: () => void;
  onUpdate: (pageId: string, changes: Partial<WorkspacePage>) => void;
  page: WorkspacePage | null;
}) {
  const [title, setTitle] = useState(page?.title ?? "");

  useEffect(() => setTitle(page?.title ?? ""), [page?.id, page?.title]);

  if (!page) {
    return (
      <div className="mx-auto flex min-h-[70vh] max-w-xl flex-col items-center justify-center px-6 text-center">
        <span className="mb-5 grid size-14 place-items-center rounded-2xl bg-indigo-50 text-indigo-600">
          <FileText className="size-6" />
        </span>
        <h1 className="text-2xl font-semibold tracking-tight">Crea tu primera página</h1>
        <p className="mt-2 max-w-md text-sm leading-6 text-zinc-500">
          Las páginas se guardan directamente en tu workspace y pueden contener tantas subpáginas como necesites.
        </p>
        <Button className="mt-6" onClick={onCreate}>
          <Plus className="size-4" />
          Nueva página
        </Button>
      </div>
    );
  }

  function saveTitle() {
    if (!page) return;
    const nextTitle = title.trim() || "Sin título";
    setTitle(nextTitle);
    if (nextTitle !== page.title) onUpdate(page.id, { title: nextTitle });
  }

  return (
    <article className="mx-auto w-full max-w-[900px] px-12 pb-32 pt-20">
      <button
        aria-label="Icono de página"
        className="mb-4 text-5xl leading-none transition-transform hover:scale-105"
        type="button"
      >
        {page.icon || "📄"}
      </button>
      <input
        aria-label="Título de la página"
        className="w-full border-none bg-transparent text-5xl font-bold tracking-[-0.04em] text-zinc-900 outline-none placeholder:text-zinc-300"
        onBlur={saveTitle}
        onChange={(event) => setTitle(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") event.currentTarget.blur();
        }}
        placeholder="Sin título"
        value={title}
      />
      <div className="mt-10 rounded-xl border border-dashed bg-zinc-50/70 px-6 py-8">
        <p className="text-sm font-medium text-zinc-700">Página lista para escribir</p>
        <p className="mt-1 text-sm leading-6 text-zinc-500">
          La estructura, el título y la navegación ya se guardan en Supabase. El editor por bloques se incorpora en la Fase 2.
        </p>
      </div>
    </article>
  );
}

export function TrashView({
  onRestore,
  pages,
}: {
  onRestore: (pageId: string) => void;
  pages: WorkspacePage[];
}) {
  const archivedIds = new Set(pages.filter((page) => page.is_archived).map((page) => page.id));
  const roots = pages.filter(
    (page) => page.is_archived && (!page.parent_page_id || !archivedIds.has(page.parent_page_id)),
  );

  return (
    <div className="mx-auto w-full max-w-[900px] px-12 py-20">
      <div className="flex items-center gap-3">
        <span className="grid size-11 place-items-center rounded-xl bg-zinc-100 text-zinc-600">
          <Trash2 className="size-5" />
        </span>
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Papelera</h1>
          <p className="mt-1 text-sm text-zinc-500">Restaura páginas junto con todas sus subpáginas.</p>
        </div>
      </div>

      {roots.length ? (
        <div className="mt-10 divide-y rounded-xl border bg-white">
          {roots.map((page) => (
            <div className="flex items-center gap-3 px-4 py-3" key={page.id}>
              <span className="text-lg">{page.icon || "📄"}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{page.title}</p>
                <p className="text-xs text-zinc-400">
                  Eliminada {page.archived_at ? new Date(page.archived_at).toLocaleDateString("es-PE") : "recientemente"}
                </p>
              </div>
              <Button onClick={() => onRestore(page.id)} size="sm" variant="outline">
                <RotateCcw className="size-3.5" />
                Restaurar
              </Button>
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-12 rounded-xl border border-dashed py-16 text-center">
          <Trash2 className="mx-auto size-6 text-zinc-300" />
          <p className="mt-3 text-sm text-zinc-500">La papelera está vacía.</p>
        </div>
      )}
    </div>
  );
}

export function SettingsView({
  email,
  workspace,
}: {
  email: string;
  workspace: WorkspaceSummary;
}) {
  return (
    <div className="mx-auto w-full max-w-[900px] px-12 py-20">
      <div className="flex items-center gap-3">
        <span className="grid size-11 place-items-center rounded-xl bg-indigo-50 text-indigo-600">
          <Settings2 className="size-5" />
        </span>
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Ajustes</h1>
          <p className="mt-1 text-sm text-zinc-500">Información del espacio de trabajo.</p>
        </div>
      </div>
      <dl className="mt-10 divide-y rounded-xl border bg-white px-5">
        <SettingRow label="Workspace" value={`${workspace.icon || "✨"} ${workspace.name}`} />
        <SettingRow label="Cuenta" value={email} />
        <SettingRow label="Rol" value={workspace.role} />
        <SettingRow label="Persistencia" value="Supabase conectado" />
      </dl>
    </div>
  );
}

function SettingRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[160px_1fr] gap-5 py-4 text-sm">
      <dt className="text-zinc-500">{label}</dt>
      <dd className="font-medium text-zinc-900">{value}</dd>
    </div>
  );
}

export function FavoriteButton({
  favorite,
  onClick,
}: {
  favorite: boolean;
  onClick: () => void;
}) {
  return (
    <button
      aria-label={favorite ? "Quitar de favoritos" : "Añadir a favoritos"}
      className="grid size-8 place-items-center rounded-md text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900"
      onClick={onClick}
      type="button"
    >
      <Star className={favorite ? "size-4 fill-current text-amber-500" : "size-4"} />
    </button>
  );
}
