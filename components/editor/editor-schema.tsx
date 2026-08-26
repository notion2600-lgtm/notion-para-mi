"use client";

import { BlockNoteSchema, createCodeBlockSpec, defaultProps } from "@blocknote/core";
import { codeBlockOptions } from "@blocknote/code-block";
import {
  createReactBlockSpec,
  createReactInlineContentSpec,
} from "@blocknote/react";
import { Columns2, FileText, Lightbulb } from "lucide-react";

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

const ColumnsBlock = createReactBlockSpec(
  {
    type: "columns",
    propSchema: {
      left: { default: "Columna izquierda" },
      right: { default: "Columna derecha" },
    },
    content: "none",
  },
  {
    render: ({ block, editor }) => (
      <div className="workspace-columns">
        <label>
          <span className="sr-only">Columna izquierda</span>
          <textarea
            onChange={(event) =>
              editor.updateBlock(block, { props: { left: event.target.value } })
            }
            placeholder="Escribe en la columna izquierda…"
            rows={3}
            value={block.props.left}
          />
        </label>
        <label>
          <span className="sr-only">Columna derecha</span>
          <textarea
            onChange={(event) =>
              editor.updateBlock(block, { props: { right: event.target.value } })
            }
            placeholder="Escribe en la columna derecha…"
            rows={3}
            value={block.props.right}
          />
        </label>
      </div>
    ),
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
    title: "2 columnas",
  },
  subpage: {
    icon: <FileText className="size-4" />,
    title: "Subpágina",
  },
};
