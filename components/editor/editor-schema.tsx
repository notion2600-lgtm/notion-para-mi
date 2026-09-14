"use client";

import { BlockNoteSchema, createCodeBlockSpec, defaultProps } from "@blocknote/core";
import { codeBlockOptions } from "@blocknote/code-block";
import {
  createReactBlockSpec,
  createReactInlineContentSpec,
} from "@blocknote/react";
import { Columns2, FileText, Lightbulb, Plus, X } from "lucide-react";
import { type PointerEvent as ReactPointerEvent, useRef, useState } from "react";

const CalloutBlock = createReactBlockSpec(
  {
    type: "callout",
    propSchema: {
      ...defaultProps,
      emoji: { default: "💡" },
    },
    content: "inline",
  },
  {
    render: ({ block, contentRef }) => (
      <div className="workspace-callout">
        <span aria-hidden className="workspace-callout-icon">
          {block.props.emoji}
        </span>
        <div className="workspace-callout-content" ref={contentRef} />
      </div>
    ),
  },
);

type ColumnData = { text: string; width: number };

const MIN_COLUMNS = 2;
const MAX_COLUMNS = 4;

function defaultColumns(): ColumnData[] {
  return [
    { text: "", width: 1 },
    { text: "", width: 1 },
  ];
}

export function parseColumns(raw: string): ColumnData[] {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed) && parsed.length >= MIN_COLUMNS) {
      return parsed.map((item) => {
        const record = item as Partial<ColumnData> | null;
        return {
          text: typeof record?.text === "string" ? record.text : "",
          width:
            typeof record?.width === "number" && record.width > 0 ? record.width : 1,
        };
      });
    }
  } catch {
    // Los bloques creados antes de este formato guardaban left/right como texto plano.
    if (raw) return [{ text: raw, width: 1 }, { text: "", width: 1 }];
  }
  return defaultColumns();
}

const ColumnsBlock = createReactBlockSpec(
  {
    type: "columns",
    propSchema: {
      columns: { default: JSON.stringify(defaultColumns()) },
    },
    content: "none",
  },
  {
    render: function ColumnsBlockRender({ block, editor }) {
      const columns = parseColumns(block.props.columns);
      const containerRef = useRef<HTMLDivElement>(null);
      const [dragIndex, setDragIndex] = useState<number | null>(null);

      function save(next: ColumnData[]) {
        editor.updateBlock(block, { props: { columns: JSON.stringify(next) } });
      }

      function updateText(index: number, text: string) {
        save(columns.map((column, i) => (i === index ? { ...column, text } : column)));
      }

      function addColumn() {
        if (columns.length >= MAX_COLUMNS) return;
        save([...columns, { text: "", width: 1 }]);
      }

      function removeColumn(index: number) {
        if (columns.length <= MIN_COLUMNS) return;
        save(columns.filter((_, i) => i !== index));
      }

      function onDividerPointerDown(
        index: number,
        event: ReactPointerEvent<HTMLDivElement>,
      ) {
        const container = containerRef.current;
        if (!container) return;
        event.preventDefault();
        const containerWidth = container.getBoundingClientRect().width;
        const startX = event.clientX;
        const startWidths: [number, number] = [
          columns[index].width,
          columns[index + 1].width,
        ];
        const totalWidth = startWidths[0] + startWidths[1];
        const minWidth = totalWidth * 0.2;
        setDragIndex(index);

        function onMove(moveEvent: PointerEvent) {
          const deltaFraction = (moveEvent.clientX - startX) / containerWidth;
          const nextLeft = Math.min(
            totalWidth - minWidth,
            Math.max(minWidth, startWidths[0] + deltaFraction * totalWidth),
          );
          const nextRight = totalWidth - nextLeft;
          save(
            columns.map((column, i) => {
              if (i === index) return { ...column, width: nextLeft };
              if (i === index + 1) return { ...column, width: nextRight };
              return column;
            }),
          );
        }

        function onUp() {
          setDragIndex(null);
          window.removeEventListener("pointermove", onMove);
          window.removeEventListener("pointerup", onUp);
        }

        window.addEventListener("pointermove", onMove);
        window.addEventListener("pointerup", onUp);
      }

      return (
        <div className="workspace-columns" ref={containerRef}>
          {columns.map((column, index) => (
            <div
              className="workspace-columns-item-wrap"
              key={index}
              style={{ flexBasis: 0, flexGrow: column.width }}
            >
              <div className="workspace-columns-item">
                <label>
                  <span className="sr-only">Columna {index + 1}</span>
                  <textarea
                    onChange={(event) => updateText(index, event.target.value)}
                    placeholder={`Columna ${index + 1}…`}
                    rows={3}
                    value={column.text}
                  />
                </label>
                {columns.length > MIN_COLUMNS && (
                  <button
                    aria-label="Eliminar columna"
                    className="workspace-columns-remove"
                    onClick={() => removeColumn(index)}
                    type="button"
                  >
                    <X className="size-3" />
                  </button>
                )}
              </div>
              {index < columns.length - 1 && (
                <div
                  aria-hidden
                  className={`workspace-columns-divider ${dragIndex === index ? "is-dragging" : ""}`}
                  onPointerDown={(event) => onDividerPointerDown(index, event)}
                />
              )}
            </div>
          ))}
          {columns.length < MAX_COLUMNS && (
            <button
              aria-label="Añadir columna"
              className="workspace-columns-add"
              onClick={addColumn}
              type="button"
            >
              <Plus className="size-3.5" />
            </button>
          )}
        </div>
      );
    },
  },
);


const SubpageBlock = createReactBlockSpec(
  {
    type: "subpage",
    propSchema: {
      pageId: { default: "" },
      title: { default: "Sin título" },
      icon: { default: "📄" },
    },
    content: "none",
  },
  {
    render: ({ block }) => (
      <a className="workspace-subpage" href={`/workspace?page=${block.props.pageId}`}>
        <span>{block.props.icon}</span>
        <span>{block.props.title}</span>
      </a>
    ),
  },
);

const PageMention = createReactInlineContentSpec(
  {
    type: "pageMention",
    propSchema: {
      pageId: { default: "" },
      title: { default: "Sin título" },
      icon: { default: "📄" },
    },
    content: "none",
  },
  {
    render: ({ inlineContent }) => (
      <a
        className="workspace-page-mention"
        href={`/workspace?page=${inlineContent.props.pageId}`}
      >
        {inlineContent.props.icon} {inlineContent.props.title}
      </a>
    ),
  },
);

export const workspaceEditorSchema = BlockNoteSchema.create().extend({
  blockSpecs: {
    codeBlock: createCodeBlockSpec({
      ...codeBlockOptions,
      defaultLanguage: "javascript",
      indentLineWithTab: true,
    }),
    callout: CalloutBlock(),
    columns: ColumnsBlock(),
    subpage: SubpageBlock(),
  },
  inlineContentSpecs: {
    pageMention: PageMention,
  },
});

export type WorkspaceEditor = typeof workspaceEditorSchema.BlockNoteEditor;

export const phaseTwoSlashItems = {
  callout: {
    icon: <Lightbulb className="size-4" />,
    title: "Callout",
  },
  columns: {
    icon: <Columns2 className="size-4" />,
    title: "Columnas",
  },
  subpage: {
    icon: <FileText className="size-4" />,
    title: "Subpágina",
  },
};
