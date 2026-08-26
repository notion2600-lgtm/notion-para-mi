"use client";

import { useCreateBlockNote } from "@blocknote/react";
import { BlockNoteView } from "@blocknote/mantine";
import { useTheme } from "next-themes";
import { useCallback, useMemo } from "react";

import { workspaceEditorSchema } from "@/components/editor/editor-schema";
import { createClient } from "@/lib/supabase/client";
import type { DatabaseProperty, WorkspacePage } from "@/lib/types";

import "@blocknote/core/fonts/inter.css";
import "@blocknote/mantine/style.css";

export function PublicPageRenderer({
  coverUrl,
  page,
  pages,
  properties,
}: {
  coverUrl: string | null;
  page: WorkspacePage;
  pages: WorkspacePage[];
  properties: DatabaseProperty[];
}) {
  const descendants = pages
    .filter((candidate) => candidate.id !== page.id)
    .sort((left, right) => Number(left.position) - Number(right.position));
  return (
    <main className="min-h-screen bg-white pb-24 text-zinc-900" id="main-content">
      <header className="border-b px-5 py-3 sm:px-8">
        <div className="mx-auto flex max-w-[1000px] items-center gap-2 text-sm font-semibold">
          <span className="grid size-7 place-items-center rounded-md bg-indigo-600 text-white">W</span>
          Workspace
          <span className="ml-auto rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-medium text-emerald-700">
            Página pública
          </span>
        </div>
      </header>
      {coverUrl && (
        <div
          className="h-52 w-full bg-zinc-100 bg-cover bg-center sm:h-72"
          style={{ backgroundImage: `url(${JSON.stringify(coverUrl)})` }}
        />
      )}
      <article className="mx-auto w-full max-w-[900px] px-5 pt-12 sm:px-12 sm:pt-16">
        <div className="text-5xl">{page.icon || "📄"}</div>
        <h1 className="mt-5 text-4xl font-bold tracking-[-0.04em] sm:text-5xl">{page.title}</h1>
        {page.type === "database" ? (
          <PublicDatabase
            database={page}
            properties={properties.filter((property) => property.page_id === page.id)}
            rows={pages.filter((candidate) => candidate.parent_database_id === page.id)}
          />
        ) : (
          <ReadOnlyDocument content={page.content} />
        )}

        {descendants.filter((child) => child.parent_database_id === null).length > 0 && (
          <section className="mt-14 border-t pt-8">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
              Contenido incluido
            </h2>
            <div className="mt-6 space-y-12">
              {descendants
                .filter((child) => child.parent_database_id === null)
                .map((child) => (
                  <section key={child.id}>
                    <h3 className="text-2xl font-semibold">{child.icon || "📄"} {child.title}</h3>
                    {child.type === "database" ? (
                      <PublicDatabase
                        database={child}
                        properties={properties.filter((property) => property.page_id === child.id)}
                        rows={pages.filter((candidate) => candidate.parent_database_id === child.id)}
                      />
                    ) : (
                      <ReadOnlyDocument content={child.content} />
                    )}
                  </section>
                ))}
            </div>
          </section>
        )}
      </article>
    </main>
  );
}

function ReadOnlyDocument({ content }: { content: unknown }) {
  const supabase = useMemo(() => createClient(), []);
  const { resolvedTheme } = useTheme();
  const resolveFileUrl = useCallback(
    async (path: string) => {
      if (/^(https?:|data:|blob:)/i.test(path)) return path;
      const { data, error } = await supabase.storage
        .from("workspace-files")
        .createSignedUrl(path, 60 * 60);
      if (error) throw error;
      return data.signedUrl;
    },
    [supabase],
  );
  const initialContent = useMemo(
    () => (Array.isArray(content) && content.length ? content : [{ type: "paragraph" }]),
    [content],
  );
  const editor = useCreateBlockNote({
    initialContent: initialContent as never,
    resolveFileUrl,
    schema: workspaceEditorSchema,
  });
  return (
    <div className="workspace-editor-shell mt-7 min-h-0">
      <BlockNoteView
        className="workspace-blocknote"
        editable={false}
        editor={editor}
        theme={resolvedTheme === "dark" ? "dark" : "light"}
      />
    </div>
  );
}

function PublicDatabase({
  database,
  properties,
  rows,
}: {
  database: WorkspacePage;
  properties: DatabaseProperty[];
  rows: WorkspacePage[];
}) {
  return (
    <div className="mt-8 overflow-x-auto rounded-xl border">
      <table className="min-w-full border-collapse text-sm">
        <thead className="bg-zinc-50 text-left text-xs text-zinc-500">
          <tr>
            <th className="border-b px-3 py-3">Nombre</th>
            {properties.filter((property) => !property.config.hidden).map((property) => (
              <th className="border-b px-3 py-3" key={property.id}>{property.name}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td className="border-b px-3 py-3 font-medium">{row.icon || "📄"} {row.title}</td>
              {properties.filter((property) => !property.config.hidden).map((property) => (
                <td className="border-b px-3 py-3 text-zinc-500" key={property.id}>
                  {publicPropertyValue(row, property)}
                </td>
              ))}
            </tr>
          ))}
          {!rows.length && (
            <tr><td className="px-4 py-10 text-center text-zinc-400" colSpan={properties.length + 1}>{database.title} no tiene filas.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function publicPropertyValue(row: WorkspacePage, property: DatabaseProperty) {
  if (property.type === "created_time") return new Date(row.created_at).toLocaleDateString("es-PE");
  if (property.type === "last_edited_time") return new Date(row.updated_at).toLocaleDateString("es-PE");
  const value = row.properties[property.id];
  if (value === null || value === undefined || value === "") return "—";
  if (property.type === "checkbox") return value ? "Sí" : "No";
  if (["select", "status"].includes(property.type)) {
    return property.config.options?.find((option) => option.id === value)?.label ?? "—";
  }
  if (property.type === "multi_select" && Array.isArray(value)) {
    return value.map((id) => property.config.options?.find((option) => option.id === id)?.label).filter(Boolean).join(", ") || "—";
  }
  if (typeof value === "object") {
    const date = value as { start?: string; end?: string };
    return date.start ? `${date.start}${date.end ? ` – ${date.end}` : ""}` : "—";
  }
  return String(value);
}
