"use client";

import {
  FileText,
  Link2,
  Plus,
  RotateCcw,
  Settings2,
  Star,
  Trash2,
} from "lucide-react";
import dynamic from "next/dynamic";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { PageHero } from "@/components/workspace/page-hero";
import { PageIcon } from "@/components/workspace/page-icon";
import type { WorkspacePage, WorkspaceSummary } from "@/lib/types";

const BlockEditor = dynamic(
  () => import("@/components/editor/block-editor").then((module) => module.BlockEditor),
  {
    loading: () => <div className="mt-8 h-32 animate-pulse rounded-xl bg-zinc-50" />,
    ssr: false,
  },
);

export function PageCanvas({
  backlinks,
  onCreate,
  onCreateSubpage,
  onOpenPage,
  onUpdate,
  onUploadFile,
  page,
  pages,
  propertiesPanel,
  readOnly = false,
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
  propertiesPanel?: ReactNode;
  readOnly?: boolean;
  resolveFileUrl: (path: string) => Promise<string>;
}) {
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

  return (
    <div className="pb-32">
      <PageHero
        coverPath={page.cover_url}
        icon={page.icon}
        onUpdate={(changes) => onUpdate(page.id, changes)}
        onUploadFile={(file) => onUploadFile(page.id, file)}
        properties={page.properties}
        readOnly={readOnly}
        resolveFileUrl={resolveFileUrl}
        title={page.title}
        titleAriaLabel="Título de la página"
      />
      <article className="mx-auto w-full max-w-[900px] px-5 sm:px-12">
        {propertiesPanel}
        <BlockEditor
          key={page.id}
          onCreateSubpage={onCreateSubpage}
          onSave={(content, plainText) =>
            onUpdate(page.id, { content, plain_text: plainText })
          }
          onUploadFile={(file) => onUploadFile(page.id, file)}
          page={page}
          pages={pages}
          readOnly={readOnly}
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
              <span className="text-lg"><PageIcon icon={page.icon} /></span>
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
            <PageIcon icon={page.icon} /> {page.title}
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
