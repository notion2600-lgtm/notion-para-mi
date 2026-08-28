"use client";

import { CornerDownLeft, FileText, Search, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { useWorkspaceSearch } from "@/hooks/use-workspace-search";
import { getPagePath } from "@/lib/page-tree";
import type { WorkspacePage } from "@/lib/types";

export function SearchDialog({
  onClose,
  onSelect,
  open,
  pages,
  workspaceId,
}: {
  onClose: () => void;
  onSelect: (pageId: string) => void;
  open: boolean;
  pages: WorkspacePage[];
  workspaceId: string;
}) {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const search = useWorkspaceSearch(workspaceId, debouncedQuery);
  const quickPages = useMemo(
    () =>
      [...pages]
        .filter((page) => !page.is_archived)
        .sort((left, right) => right.updated_at.localeCompare(left.updated_at))
        .slice(0, 12),
    [pages],
  );
  const results = debouncedQuery ? (search.data ?? []) : quickPages;

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuery(query.trim()), 180);
    return () => window.clearTimeout(timer);
  }, [query]);

  useEffect(() => setActiveIndex(0), [debouncedQuery, open]);
  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  if (!open) return null;

  function choose(pageId: string) {
    onSelect(pageId);
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-[80] flex items-start justify-center bg-black/20 px-4 pt-[12vh] backdrop-blur-[1px]"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      role="presentation"
    >
      <section
        aria-label="Búsqueda global"
        aria-modal="true"
        className="w-full max-w-2xl overflow-hidden rounded-xl border bg-white shadow-2xl"
        role="dialog"
      >
        <div className="flex h-14 items-center gap-3 border-b px-4">
          <Search className="size-5 text-zinc-400" />
          <input
            autoFocus
            className="min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-zinc-400"
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "ArrowDown") {
                event.preventDefault();
                setActiveIndex((index) => Math.min(results.length - 1, index + 1));
              }
              if (event.key === "ArrowUp") {
                event.preventDefault();
                setActiveIndex((index) => Math.max(0, index - 1));
              }
              if (event.key === "Enter" && results[activeIndex]) {
                event.preventDefault();
                choose(results[activeIndex].id);
              }
              if (event.key === "Escape") onClose();
            }}
            placeholder="Buscar en tu espacio…"
            value={query}
          />
          <button
            aria-label="Cerrar búsqueda"
            className="grid size-8 place-items-center rounded-md text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
            onClick={onClose}
            type="button"
          >
            <X className="size-4" />
          </button>
        </div>
        <div className="max-h-[58vh] overflow-y-auto p-2">
          <p className="px-2 pb-2 pt-1 text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
            {debouncedQuery ? "Resultados" : "Páginas recientes"}
          </p>
          {search.isFetching && debouncedQuery && (
            <p className="px-3 py-5 text-sm text-zinc-400">Buscando…</p>
          )}
          {!search.isFetching && results.length === 0 && (
            <p className="px-3 py-10 text-center text-sm text-zinc-500">
              No hay resultados para esta búsqueda.
            </p>
          )}
          {results.map((page, index) => {
            const path = getPagePath(pages, page.id)
              .slice(0, -1)
              .map((item) => item.title)
              .join(" / ");
            return (
              <button
                className={`flex w-full items-start gap-3 rounded-md px-3 py-3 text-left ${
                  index === activeIndex ? "bg-zinc-100" : "hover:bg-zinc-50"
                }`}
                key={page.id}
                onClick={() => choose(page.id)}
                onMouseEnter={() => setActiveIndex(index)}
                type="button"
              >
                <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg bg-white shadow-sm">
                  {page.icon || <FileText className="size-4 text-zinc-400" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-zinc-900">{page.title}</span>
                  {path && <span className="mt-0.5 block truncate text-xs text-zinc-400">{path}</span>}
                  {debouncedQuery && (
                    <span className="mt-1 block truncate text-xs text-zinc-500">
                      {searchSnippet(page.plain_text, debouncedQuery)}
                    </span>
                  )}
                </span>
                {index === activeIndex && <CornerDownLeft className="mt-2 size-3.5 text-zinc-500" />}
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-4 border-t bg-zinc-50 px-4 py-2 text-[11px] text-zinc-400">
          <span>↑↓ navegar</span><span>↵ abrir</span><span>Esc cerrar</span>
        </div>
      </section>
    </div>
  );
}

function searchSnippet(text: string, query: string) {
  if (!text) return "Página sin texto adicional";
  const terms = query.toLocaleLowerCase("es").split(/\s+/).filter(Boolean);
  const lower = text.toLocaleLowerCase("es");
  const found = terms.map((term) => lower.indexOf(term)).find((index) => index >= 0) ?? 0;
  const start = Math.max(0, found - 55);
  const snippet = text.slice(start, start + 170).replace(/\s+/g, " ").trim();
  return `${start > 0 ? "…" : ""}${snippet}${start + 170 < text.length ? "…" : ""}`;
}
