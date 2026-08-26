"use client";

import {
  filterSuggestionItems,
  insertOrUpdateBlockForSlashMenu,
} from "@blocknote/core/extensions";
import { es } from "@blocknote/core/locales";
import { syntaxHighlighter } from "@blocknote/code-block";
import { BlockNoteView } from "@blocknote/mantine";
import {
  getDefaultReactSlashMenuItems,
  SuggestionMenuController,
  useCreateBlockNote,
  type DefaultReactSuggestionItem,
} from "@blocknote/react";
import { useCallback, useEffect, useRef, useState } from "react";

import {
  phaseTwoSlashItems,
  workspaceEditorSchema,
  type WorkspaceEditor,
} from "@/components/editor/editor-schema";
import type { WorkspacePage } from "@/lib/types";

import "@blocknote/core/fonts/inter.css";
import "@blocknote/mantine/style.css";

type SaveState = "idle" | "pending" | "saving" | "saved" | "error";

export function BlockEditor({
  onCreateSubpage,
  onSave,
  onUploadFile,
  page,
  pages,
  resolveFileUrl,
}: {
  onCreateSubpage: () => Promise<WorkspacePage | null>;
  onSave: (content: unknown, plainText: string) => Promise<boolean>;
  onUploadFile: (file: File) => Promise<string>;
  page: WorkspacePage;
  pages: WorkspacePage[];
  resolveFileUrl: (path: string) => Promise<string>;
}) {
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const revision = useRef(0);
  const savedRevision = useRef(0);
  const mounted = useRef(true);
  const onSaveRef = useRef(onSave);
  const initialContent = useRef(
    Array.isArray(page.content) && page.content.length
      ? page.content
      : [{ type: "paragraph" }],
  ).current;

  const editor = useCreateBlockNote(
    {
      dictionary: {
        ...es,
        placeholders: {
          ...es.placeholders,
          default: "Escribe '/' para insertar un bloque",
          emptyDocument: "Escribe '/' para empezar",
        },
      },
      extensions: [syntaxHighlighter],
      initialContent: initialContent as never,
      resolveFileUrl,
      schema: workspaceEditorSchema,
      uploadFile: onUploadFile,
    },
    [page.id],
  );

  const persist = useCallback(
    async (editorInstance: WorkspaceEditor, targetRevision: number) => {
      if (mounted.current) setSaveState("saving");
      const content = editorInstance.document;
      const success = await onSaveRef.current(content, blocksToPlainText(content));
      if (success) savedRevision.current = targetRevision;
      if (!mounted.current || revision.current !== targetRevision) return;
      setSaveState(success ? "saved" : "error");
    },
    [],
  );

  useEffect(() => {
    onSaveRef.current = onSave;
  }, [onSave]);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (saveTimer.current) clearTimeout(saveTimer.current);
      if (savedRevision.current < revision.current) {
        void onSaveRef.current(editor.document, blocksToPlainText(editor.document));
      }
    };
  }, [editor]);

  const handleChange = useCallback(
    (editorInstance: WorkspaceEditor) => {
      revision.current += 1;
      const targetRevision = revision.current;
      setSaveState("pending");
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        void persist(editorInstance, targetRevision);
      }, 600);
    },
    [persist],
  );

  const slashItems = useCallback(
    (editorInstance: WorkspaceEditor): DefaultReactSuggestionItem[] => [
      ...getDefaultReactSlashMenuItems(editorInstance),
      {
        ...phaseTwoSlashItems.callout,
        aliases: ["aviso", "nota", "callout"],
        group: "Workspace",
        subtext: "Destaca una idea o advertencia",
        onItemClick: () =>
          insertOrUpdateBlockForSlashMenu(editorInstance, {
            type: "callout",
            props: { emoji: "💡" },
          }),
      },
      {
        ...phaseTwoSlashItems.columns,
        aliases: ["columnas", "dos columnas", "columns"],
        group: "Workspace",
        subtext: "Organiza texto en paralelo",
        onItemClick: () =>
          insertOrUpdateBlockForSlashMenu(editorInstance, {
            type: "columns",
          }),
      },
      {
        ...phaseTwoSlashItems.subpage,
        aliases: ["subpagina", "página", "page"],
        group: "Workspace",
        subtext: "Crea una página dentro de esta página",
        onItemClick: () => {
          const currentBlock = editorInstance.getTextCursorPosition().block;
          editorInstance.updateBlock(currentBlock, {
            type: "subpage",
            props: { icon: "📄", pageId: "", title: "Creando subpágina…" },
          });
          void onCreateSubpage().then((subpage) => {
            if (!subpage) {
              editorInstance.updateBlock(currentBlock.id, {
                type: "paragraph",
                content: "No se pudo crear la subpágina",
              });
              return;
            }
            editorInstance.updateBlock(currentBlock.id, {
              type: "subpage",
              props: {
                icon: subpage.icon || "📄",
                pageId: subpage.id,
                title: subpage.title,
              },
            });
          });
        },
      },
    ],
    [onCreateSubpage],
  );

  const mentionItems = useCallback(
    (editorInstance: WorkspaceEditor): DefaultReactSuggestionItem[] =>
      pages
        .filter((candidate) => !candidate.is_archived && candidate.id !== page.id)
        .map((candidate) => ({
          icon: <span className="text-sm">{candidate.icon || "📄"}</span>,
          title: candidate.title,
          subtext: "Página del workspace",
          onItemClick: () => {
            editorInstance.insertInlineContent([
              {
                type: "pageMention",
                props: {
                  icon: candidate.icon || "📄",
                  pageId: candidate.id,
                  title: candidate.title,
                },
              },
              " ",
            ]);
          },
        })),
    [page.id, pages],
  );

  return (
    <div className="workspace-editor-shell">
      <div aria-live="polite" className="workspace-save-state">
        {saveState === "pending" || saveState === "saving"
          ? "Guardando…"
          : saveState === "error"
            ? "Error al guardar"
            : saveState === "saved"
              ? "Guardado"
              : ""}
      </div>
      <BlockNoteView
        className="workspace-blocknote"
        editor={editor}
        onChange={handleChange}
        slashMenu={false}
        theme="light"
      >
        <SuggestionMenuController
          getItems={async (query) =>
            filterSuggestionItems(slashItems(editor), query)
          }
          triggerCharacter="/"
        />
        <SuggestionMenuController
          getItems={async (query) =>
            filterSuggestionItems(mentionItems(editor), query)
          }
          triggerCharacter="@"
        />
      </BlockNoteView>
    </div>
  );
}

function blocksToPlainText(blocks: readonly unknown[]): string {
  const lines: string[] = [];

  for (const block of blocks) {
    if (!isRecord(block)) continue;
    const contentText = inlineContentToText(block.content);
    const props = isRecord(block.props) ? block.props : null;
    const type = typeof block.type === "string" ? block.type : "";

    if (contentText) lines.push(contentText);
    if (type === "columns" && props) {
      if (typeof props.left === "string") lines.push(props.left);
      if (typeof props.right === "string") lines.push(props.right);
    }
    if (type === "subpage" && props && typeof props.title === "string") {
      lines.push(props.title);
    }
    if (Array.isArray(block.children)) {
      const childText = blocksToPlainText(block.children);
      if (childText) lines.push(childText);
    }
  }

  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

function inlineContentToText(content: unknown): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";

  return content
    .map((item) => {
      if (typeof item === "string") return item;
      if (!isRecord(item)) return "";
      if (typeof item.text === "string") return item.text;
      if (Array.isArray(item.content)) return inlineContentToText(item.content);
      if (isRecord(item.props) && typeof item.props.title === "string") {
        return item.props.title;
      }
      return "";
    })
    .join("");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
