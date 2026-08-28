"use client";

import { FileArchive, LayoutTemplate, LoaderCircle, Plus, Trash2, Upload } from "lucide-react";
import { useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import type { PageTemplate, WorkspacePage } from "@/lib/types";

export function TemplatesView({
  isLoading,
  onDelete,
  onImport,
  onUse,
  templates,
}: {
  isLoading: boolean;
  onDelete: (templateId: string) => Promise<boolean>;
  onImport: (file: File) => Promise<boolean>;
  onUse: (template: PageTemplate) => Promise<WorkspacePage | null>;
  templates: PageTemplate[];
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isImporting, setIsImporting] = useState(false);

  async function importFile(file: File | undefined) {
    if (!file || isImporting) return;
    setIsImporting(true);
    try {
      await onImport(file);
    } finally {
      setIsImporting(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="mx-auto w-full max-w-[1000px] px-5 py-12 sm:px-12 sm:py-20">
      <div className="flex items-center gap-3">
        <span className="grid size-11 place-items-center rounded-xl bg-indigo-50 text-indigo-600">
          <LayoutTemplate className="size-5" />
        </span>
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Plantillas</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Empieza rápido con una estructura lista para editar.
          </p>
        </div>
      </div>

      <section className="mt-8 flex flex-col gap-4 rounded-xl border border-dashed bg-zinc-50/80 p-5 sm:flex-row sm:items-center">
        <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-white text-indigo-600 shadow-sm">
          <FileArchive className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold">Importar desde Notion</h2>
          <p className="mt-1 text-xs leading-5 text-zinc-500" id="notion-import-help">
            Selecciona una exportación ZIP con Markdown y CSV, o un archivo individual .md o .csv.
            La importación se convertirá en páginas y bases de datos editables.
          </p>
        </div>
        <input
          accept=".zip,.md,.markdown,.csv,application/zip,text/markdown,text/csv"
          aria-describedby="notion-import-help"
          className="sr-only"
          onChange={(event) => void importFile(event.target.files?.[0])}
          ref={inputRef}
          type="file"
        />
        <Button
          className="shrink-0"
          disabled={isImporting}
          onClick={() => inputRef.current?.click()}
          variant="outline"
        >
          {isImporting ? (
            <LoaderCircle className="size-4 animate-spin" />
          ) : (
            <Upload className="size-4" />
          )}
          {isImporting ? "Importando…" : "Elegir archivo"}
        </Button>
      </section>

      {isLoading ? (
        <div className="mt-10 h-40 animate-pulse rounded-xl bg-zinc-100" />
      ) : (
        <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {templates.map((template) => (
            <article className="flex min-h-52 flex-col rounded-xl border bg-white p-5 shadow-sm" key={template.id}>
              <div className="flex items-start gap-3">
                <span className="text-3xl">{template.icon}</span>
                <div className="min-w-0 flex-1">
                  <h2 className="truncate text-base font-semibold">{template.name}</h2>
                  <span className="mt-1 inline-block rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-medium text-zinc-500">
                    {template.is_builtin ? "Incluida" : "Personal"}
                  </span>
                </div>
              </div>
              <p className="mt-4 flex-1 text-sm leading-6 text-zinc-500">{template.description}</p>
              <div className="mt-5 flex items-center gap-2">
                <Button className="flex-1" onClick={() => void onUse(template)} size="sm">
                  <Plus className="size-3.5" /> Usar plantilla
                </Button>
                {!template.is_builtin && (
                  <button
                    aria-label={`Eliminar plantilla ${template.name}`}
                    className="grid size-8 place-items-center rounded-md text-zinc-400 hover:bg-red-50 hover:text-red-600"
                    onClick={() => {
                      if (window.confirm(`¿Eliminar la plantilla “${template.name}”?`)) {
                        void onDelete(template.id);
                      }
                    }}
                    type="button"
                  >
                    <Trash2 className="size-4" />
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
