"use client";

import {
  FileImage,
  FileText,
  ImagePlus,
  Link2,
  Plus,
  RotateCcw,
  Settings2,
  Star,
  Trash2,
  X,
} from "lucide-react";
import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import type { WorkspacePage, WorkspaceSummary } from "@/lib/types";

const BlockEditor = dynamic(
  () => import("@/components/editor/block-editor").then((module) => module.BlockEditor),
  {
    loading: () => <div className="mt-8 h-32 animate-pulse rounded-xl bg-zinc-50" />,
    ssr: false,
  },
);

const PAGE_EMOJIS = [
  "📄",
  "✨",
  "💡",
  "✅",
  "🚀",
  "🎯",
  "📌",
  "🧠",
  "📚",
  "💼",
  "📊",
  "🗓️",
  "❤️",
  "🔥",
  "🌱",
  "🧩",
];

export function PageCanvas({
  backlinks,
  onCreate,
  onCreateSubpage,
  onOpenPage,
  onUpdate,
  onUploadFile,
  page,
  pages,
  resolveFileUrl,
}: {
  backlinks: WorkspacePage[];
  onCreate: () => void;
  onCreateSubpage: () => Promise<WorkspacePage | null>;
  onOpenPage: (pageId: string) => void;
  onUpdate: (pageId: string, changes: Partial<WorkspacePage>) => Promise<boolean>;
  onUploadFile: (pageId: string, file: File) => Promise<string>;
  page: WorkspacePage | null;
  pages: WorkspacePage[];
  resolveFileUrl: (path: string) => Promise<string>;
}) {
  const [title, setTitle] = useState(page?.title ?? "");
  const [iconOpen, setIconOpen] = useState(false);
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [coverPosition, setCoverPosition] = useState(50);
  const [coverUploading, setCoverUploading] = useState(false);
  const coverInput = useRef<HTMLInputElement>(null);

  useEffect(() => setTitle(page?.title ?? ""), [page?.id, page?.title]);

  useEffect(() => {
    let active = true;
    const storedPosition = page?.properties?._cover_position;
    setCoverPosition(typeof storedPosition === "number" ? storedPosition : 50);
    if (!page?.cover_url) {
      setCoverUrl(null);
      return;
    }
    void resolveFileUrl(page.cover_url)
      .then((url) => {
        if (active) setCoverUrl(url);
      })
      .catch(() => {
        if (active) setCoverUrl(null);
      });
    return () => {
      active = false;
    };
  }, [page?.cover_url, page?.id, page?.properties?._cover_position, resolveFileUrl]);

  if (!page) {
    return (
      <div className="mx-auto flex min-h-[70vh] max-w-xl flex-col items-center justify-center px-6 text-center">
        <span className="mb-5 grid size-14 place-items-center rounded-2xl bg-indigo-50 text-indigo-600">
          <FileText className="size-6" />
        </span>
        <h1 className="text-2xl font-semibold tracking-tight">Empieza con una página</h1>
        <p className="mt-2 max-w-md text-sm leading-6 text-zinc-500">
          Escribe una nota, organiza un proyecto o crea una base de conocimiento.
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

  async function uploadCover(file: File | undefined) {
    if (!file || !page) return;
    setCoverUploading(true);
    try {
      const path = await onUploadFile(page.id, file);
      await onUpdate(page.id, { cover_url: path });
    } catch {
      // El hook de archivos ya muestra el detalle del error al usuario.
    } finally {
      setCoverUploading(false);
      if (coverInput.current) coverInput.current.value = "";
    }
  }

  function saveCoverPosition(value = coverPosition) {
    if (!page) return;
    void onUpdate(page.id, {
      properties: { ...page.properties, _cover_position: value },
    });
  }

  return (
    <div className="pb-32">
      {coverUrl && (
        <div className="group relative h-56 w-full overflow-hidden bg-zinc-100">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            alt="Portada de la página"
            className="h-full w-full object-cover"
            src={coverUrl}
            style={{ objectPosition: `center ${coverPosition}%` }}
          />
          <div className="absolute bottom-3 right-4 flex items-center gap-2 rounded-lg bg-white/95 p-2 opacity-0 shadow-sm backdrop-blur transition-opacity group-hover:opacity-100 focus-within:opacity-100">
            <label className="flex items-center gap-2 text-xs font-medium text-zinc-600">
              Posición
              <input
                aria-label="Posición vertical de la portada"
                className="w-28 accent-indigo-600"
                max="100"
                min="0"
                onChange={(event) => setCoverPosition(Number(event.target.value))}
                onMouseUp={() => saveCoverPosition()}
                onTouchEnd={() => saveCoverPosition()}
                type="range"
                value={coverPosition}
              />
            </label>
            <button
              aria-label="Quitar portada"
              className="grid size-7 place-items-center rounded-md hover:bg-zinc-100"
              onClick={() => void onUpdate(page.id, { cover_url: null })}
              type="button"
            >
              <X className="size-3.5" />
            </button>
          </div>
        </div>
      )}

      <article className={`mx-auto w-full max-w-[900px] px-5 sm:px-12 ${coverUrl ? "pt-8 sm:pt-10" : "pt-12 sm:pt-20"}`}>
        <div className="relative mb-4 w-fit">
          <button
            aria-expanded={iconOpen}
            aria-label="Cambiar icono de página"
            className="text-5xl leading-none transition-transform hover:scale-105"
            onClick={() => setIconOpen((open) => !open)}
            type="button"
          >
            {page.icon || "📄"}
          </button>
          {iconOpen && (
            <div className="absolute left-0 top-14 z-30 grid w-64 grid-cols-8 gap-1 rounded-xl border bg-white p-3 shadow-xl">
              {PAGE_EMOJIS.map((emoji) => (
                <button
                  className="grid size-7 place-items-center rounded-md text-lg hover:bg-zinc-100"
                  key={emoji}
                  onClick={() => {
                    void onUpdate(page.id, { icon: emoji });
                    setIconOpen(false);
                  }}
                  type="button"
                >
                  {emoji}
                </button>
              ))}
            </div>
          )}
        </div>

        {!coverUrl && (
          <button
            className="mb-3 flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
            disabled={coverUploading}
            onClick={() => coverInput.current?.click()}
            type="button"
          >
            {coverUploading ? <FileImage className="size-3.5 animate-pulse" /> : <ImagePlus className="size-3.5" />}
            {coverUploading ? "Subiendo portada…" : "Añadir portada"}
          </button>
        )}
        <input
          accept="image/*"
          className="hidden"
          onChange={(event) => void uploadCover(event.target.files?.[0])}
          ref={coverInput}
          type="file"
        />

        <input
          aria-label="Título de la página"
          className="w-full border-none bg-transparent text-3xl font-bold tracking-[-0.035em] text-zinc-900 outline-none placeholder:text-zinc-300 sm:text-[40px] sm:leading-[1.2]"
          onBlur={saveTitle}
          onChange={(event) => setTitle(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") event.currentTarget.blur();
          }}
          placeholder="Sin título"
          value={title}
        />
        <BlockEditor
          key={page.id}
          onCreateSubpage={onCreateSubpage}
          onSave={(content, plainText) =>
            onUpdate(page.id, { content, plain_text: plainText })
          }
          onUploadFile={(file) => onUploadFile(page.id, file)}
          page={page}
          pages={pages}
          resolveFileUrl={resolveFileUrl}
        />
        <Backlinks backlinks={backlinks} onOpenPage={onOpenPage} />
      </article>
    </div>
  );
}

export function TrashView({
  onDelete,
  onEmpty,
  onRestore,
  pages,
}: {
  onDelete: (pageId: string) => Promise<boolean>;
  onEmpty: () => Promise<boolean>;
  onRestore: (pageId: string) => void;
  pages: WorkspacePage[];
}) {
  const archivedIds = new Set(pages.filter((page) => page.is_archived).map((page) => page.id));
  const roots = pages.filter(
    (page) => {
      const parentId = page.parent_page_id ?? page.parent_database_id;
      return page.is_archived && (!parentId || !archivedIds.has(parentId));
    },
  );

  return (
    <div className="mx-auto w-full max-w-[900px] px-5 py-12 sm:px-12 sm:py-20">
      <div className="flex flex-wrap items-center gap-3">
        <span className="grid size-11 place-items-center rounded-xl bg-zinc-100 text-zinc-600">
          <Trash2 className="size-5" />
        </span>
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Papelera</h1>
          <p className="mt-1 text-sm text-zinc-500">Restaura páginas junto con todas sus subpáginas.</p>
        </div>
        {roots.length > 0 && (
          <Button
            className="ml-auto"
            onClick={() => {
              if (window.confirm("¿Vaciar definitivamente toda la papelera? Esta acción no se puede deshacer.")) {
                void onEmpty();
              }
            }}
            size="sm"
            variant="destructive"
          >
            <Trash2 className="size-3.5" /> Vaciar papelera
          </Button>
        )}
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
              <button
                className="grid size-8 place-items-center rounded-md text-zinc-400 hover:bg-red-50 hover:text-red-600"
                onClick={() => {
                  if (window.confirm(`¿Eliminar definitivamente “${page.title}” y sus subpáginas?`)) {
                    void onDelete(page.id);
                  }
                }}
                title="Eliminar definitivamente"
                type="button"
              >
                <Trash2 className="size-4" />
              </button>
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

export function Backlinks({
  backlinks,
  onOpenPage,
}: {
  backlinks: WorkspacePage[];
  onOpenPage: (pageId: string) => void;
}) {
  if (!backlinks.length) return null;
  return (
    <section className="mt-16 border-t pt-6">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-zinc-400">
        <Link2 className="size-3.5" /> Enlazada desde
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {backlinks.map((page) => (
          <button
            className="flex items-center gap-2 rounded-lg border bg-white px-3 py-2 text-sm hover:bg-zinc-50"
            key={page.id}
            onClick={() => onOpenPage(page.id)}
            type="button"
          >
            <span>{page.icon || "📄"}</span> {page.title}
          </button>
        ))}
      </div>
    </section>
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
    <div className="mx-auto w-full max-w-[900px] px-5 py-12 sm:px-12 sm:py-20">
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
        <SettingRow label="Espacio" value={`${workspace.icon || "✨"} ${workspace.name}`} />
        <SettingRow label="Cuenta" value={email} />
        <SettingRow label="Rol" value={workspace.role} />
        <SettingRow label="Estado" value="Todo sincronizado" />
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
