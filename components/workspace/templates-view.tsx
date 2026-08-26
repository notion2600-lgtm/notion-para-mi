"use client";

import { LayoutTemplate, Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { PageTemplate, WorkspacePage } from "@/lib/types";

export function TemplatesView({
  isLoading,
  onDelete,
  onUse,
  templates,
}: {
  isLoading: boolean;
  onDelete: (templateId: string) => Promise<boolean>;
  onUse: (template: PageTemplate) => Promise<WorkspacePage | null>;
  templates: PageTemplate[];
}) {
  return (
    <div className="mx-auto w-full max-w-[1000px] px-12 py-20">
      <div className="flex items-center gap-3">
        <span className="grid size-11 place-items-center rounded-xl bg-indigo-50 text-indigo-600">
          <LayoutTemplate className="size-5" />
        </span>
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Plantillas</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Crea páginas completas y reutiliza estructuras guardadas por tu workspace.
          </p>
        </div>
      </div>

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
                    {template.is_builtin ? "Incluida" : "Tu workspace"}
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
