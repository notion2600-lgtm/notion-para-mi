import type { WorkspacePage } from "@/lib/types";

export function downloadPageAsMarkdown(root: WorkspacePage, pages: WorkspacePage[]) {
  const markdown = pageTreeToMarkdown(root, pages, 1).trimEnd() + "\n";
  const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${safeFilename(root.title)}.md`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function pageTreeToMarkdown(page: WorkspacePage, pages: WorkspacePage[], depth: number): string {
  const heading = `${"#".repeat(Math.min(6, depth))} ${page.icon ? `${page.icon} ` : ""}${page.title}`;
  const content = page.type === "database"
    ? databasePageToMarkdown(page, pages)
    : blocksToMarkdown(page.content);
  const children = pages
    .filter(
      (candidate) =>
        !candidate.is_archived &&
        (candidate.parent_page_id === page.id || candidate.parent_database_id === page.id),
    )
    .sort((left, right) => Number(left.position) - Number(right.position));
  return [
    heading,
    "",
    content,
    ...children.map((child) => pageTreeToMarkdown(child, pages, depth + 1)),
  ]
    .filter(Boolean)
    .join("\n\n");
}

function databasePageToMarkdown(database: WorkspacePage, pages: WorkspacePage[]) {
  const rows = pages.filter(
    (page) => !page.is_archived && page.parent_database_id === database.id,
  );
  if (!rows.length) return "_Base de datos sin filas._";
  return rows
    .map((row) => {
      const values = Object.entries(row.properties)
        .filter(([key]) => !key.startsWith("_"))
        .map(([, value]) => printableValue(value))
        .filter(Boolean);
      return `- ${row.icon ? `${row.icon} ` : ""}**${row.title}**${values.length ? ` — ${values.join(" · ")}` : ""}`;
    })
    .join("\n");
}

function blocksToMarkdown(content: unknown): string {
  if (!Array.isArray(content)) return "";
  return content.map(blockToMarkdown).filter(Boolean).join("\n\n");
}

function blockToMarkdown(block: unknown): string {
  if (!isRecord(block)) return "";
  const type = typeof block.type === "string" ? block.type : "paragraph";
  const props = isRecord(block.props) ? block.props : {};
  const text = inlineToMarkdown(block.content);
  let line = text;
  if (type === "heading") {
    const level = typeof props.level === "number" ? props.level : 2;
    line = `${"#".repeat(Math.min(6, Math.max(2, level + 1)))} ${text}`;
  } else if (type === "bulletListItem") line = `- ${text}`;
  else if (type === "numberedListItem") line = `1. ${text}`;
  else if (type === "checkListItem") line = `- [${props.checked ? "x" : " "}] ${text}`;
  else if (type === "quote") line = `> ${text}`;
  else if (type === "codeBlock") line = `\`\`\`${typeof props.language === "string" ? props.language : ""}\n${text}\n\`\`\``;
  else if (type === "divider") line = "---";
  else if (type === "callout") line = `> ${typeof props.emoji === "string" ? props.emoji : "💡"} ${text}`;
  else if (type === "columns") {
    line = `${printableValue(props.left)}\n\n${printableValue(props.right)}`;
  } else if (type === "subpage") {
    const title = printableValue(props.title) || "Subpágina";
    const pageId = printableValue(props.pageId);
    line = pageId ? `[${title}](/workspace?page=${pageId})` : title;
  } else if (["image", "video", "audio", "file"].includes(type)) {
    const url = printableValue(props.url);
    const caption = printableValue(props.caption) || type;
    line = url ? `[${caption}](${url})` : caption;
  } else if (type === "table") {
    line = inlineToMarkdown(block.content).replace(/\s*\|\s*/g, " | ");
  }
  const children = Array.isArray(block.children)
    ? block.children.map(blockToMarkdown).filter(Boolean).join("\n")
    : "";
  return [line, children].filter(Boolean).join("\n");
}

function inlineToMarkdown(content: unknown): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return printableValue(content);
  return content
    .map((item) => {
      if (typeof item === "string") return item;
      if (!isRecord(item)) return "";
      if (typeof item.text === "string") return applyStyles(item.text, item.styles);
      if (isRecord(item.props) && typeof item.props.title === "string") {
        const pageId = typeof item.props.pageId === "string" ? item.props.pageId : "";
        return pageId ? `[${item.props.title}](/workspace?page=${pageId})` : item.props.title;
      }
      if (Array.isArray(item.content)) return inlineToMarkdown(item.content);
      return "";
    })
    .join("");
}

function applyStyles(text: string, styles: unknown) {
  if (!isRecord(styles)) return text;
  let result = text;
  if (styles.code) result = `\`${result}\``;
  if (styles.bold) result = `**${result}**`;
  if (styles.italic) result = `*${result}*`;
  if (styles.strike) result = `~~${result}~~`;
  const href = typeof styles.link === "string" ? styles.link : null;
  if (href) result = `[${result}](${href})`;
  return result;
}

function printableValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string" || typeof value === "number") return String(value);
  if (typeof value === "boolean") return value ? "Sí" : "No";
  if (Array.isArray(value)) return value.map(printableValue).filter(Boolean).join(", ");
  if (isRecord(value)) {
    if (typeof value.start === "string") {
      return typeof value.end === "string" ? `${value.start} – ${value.end}` : value.start;
    }
    return Object.values(value).map(printableValue).filter(Boolean).join(", ");
  }
  return "";
}

function safeFilename(title: string) {
  return (
    title
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9-_ ]/g, "")
      .trim()
      .replace(/\s+/g, "-")
      .toLowerCase() || "pagina"
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
