import { strFromU8, unzipSync } from "fflate";

import type {
  DatabasePropertyConfig,
  DatabasePropertyType,
  TemplatePageSnapshot,
  TemplatePropertySnapshot,
  TemplateSnapshot,
  TemplateViewSnapshot,
} from "@/lib/types";

const MAX_ARCHIVE_BYTES = 20 * 1024 * 1024;
const MAX_UNCOMPRESSED_BYTES = 50 * 1024 * 1024;
const MAX_ENTRIES = 500;
const MAX_PAGES = 750;
const MAX_CSV_ROWS = 500;
const MAX_CSV_COLUMNS = 50;
const SUPPORTED_EXTENSIONS = new Set(["csv", "md", "markdown"]);

type SourceFile = {
  extension: "csv" | "md";
  key: string;
  parentKey: string | null;
  path: string;
  text: string;
  title: string;
};

type MutablePage = TemplatePageSnapshot & {
  key: string;
  parent_key: string | null;
};

export type ImportedTemplateDraft = {
  description: string;
  icon: string;
  name: string;
  snapshot: TemplateSnapshot;
  warnings: string[];
};

export async function parseNotionTemplate(file: File): Promise<ImportedTemplateDraft> {
  if (file.size > MAX_ARCHIVE_BYTES) {
    throw new Error("El archivo supera el límite de 20 MB.");
  }

  const extension = file.name.split(".").pop()?.toLocaleLowerCase("es") ?? "";
  const parsed = extension === "zip"
    ? parseZip(new Uint8Array(await file.arrayBuffer()))
    : { files: parseStandalone(file.name, await file.text()), ignoredAssets: 0 };
  const sourceFiles = parsed.files;

  if (!sourceFiles.length) {
    throw new Error("No encontramos archivos Markdown o CSV dentro de la exportación.");
  }

  const importedName = cleanTitle(file.name.replace(/\.(zip|md|markdown|csv)$/i, ""));
  const imported = buildTemplate(sourceFiles, importedName || "Plantilla importada");
  if (parsed.ignoredAssets) {
    imported.warnings.push(
      `${parsed.ignoredAssets} imágenes o archivos adjuntos quedaron como referencias de texto.`,
    );
  }
  return imported;
}

function parseZip(bytes: Uint8Array) {
  let archive: Record<string, Uint8Array>;
  try {
    archive = unzipSync(bytes);
  } catch {
    throw new Error("No pudimos abrir el ZIP. Vuelve a exportarlo desde Notion.");
  }

  const allFiles = Object.entries(archive).filter(([path]) => {
    const normalized = normalizePath(path);
    return normalized && !normalized.endsWith("/") && !normalized.startsWith("__MACOSX/");
  });
  const entries = allFiles.filter(([path]) => isUsefulPath(path));
  if (entries.length > MAX_ENTRIES) {
    throw new Error(`La exportación contiene más de ${MAX_ENTRIES} archivos compatibles.`);
  }
  const totalBytes = entries.reduce((total, [, data]) => total + data.byteLength, 0);
  if (totalBytes > MAX_UNCOMPRESSED_BYTES) {
    throw new Error("El contenido descomprimido supera el límite de 50 MB.");
  }

  return {
    files: entries.map(([path, data]) => sourceFileFromText(path, strFromU8(data))),
    ignoredAssets: allFiles.length - entries.length,
  };
}

function parseStandalone(name: string, text: string) {
  const normalized = normalizePath(name);
  if (!isUsefulPath(normalized)) {
    throw new Error("Usa un archivo .zip, .md, .markdown o .csv.");
  }
  return [sourceFileFromText(normalized, text)];
}

function sourceFileFromText(path: string, text: string): SourceFile {
  const normalizedPath = normalizePath(path);
  const rawExtension = normalizedPath.split(".").pop()?.toLocaleLowerCase("es");
  const extension = rawExtension === "csv" ? "csv" : "md";
  const key = normalizedPath.replace(/\.(csv|md|markdown)$/i, "");
  const segments = key.split("/");
  return {
    extension,
    key,
    parentKey: segments.length > 1 ? segments.slice(0, -1).join("/") : null,
    path: normalizedPath,
    text: text.replace(/^\uFEFF/, ""),
    title: cleanTitle(segments.at(-1) ?? "Sin título"),
  };
}

function buildTemplate(files: SourceFile[], requestedName: string): ImportedTemplateDraft {
  const pages: MutablePage[] = [];
  const properties: TemplatePropertySnapshot[] = [];
  const views: TemplateViewSnapshot[] = [];
  const warnings: string[] = [];
  const keyToSourceId = new Map<string, string>();
  const consumedMarkdown = new Set<string>();
  const sortedFiles = [...files].sort((left, right) => left.path.localeCompare(right.path, "es"));

  for (const file of sortedFiles.filter((item) => item.extension === "csv")) {
    const databaseSourceId = sourceId("database", file.key);
    keyToSourceId.set(file.key, databaseSourceId);
    const parsed = buildCsvDatabase(file, databaseSourceId);
    pages.push(parsed.database, ...parsed.rows);
    properties.push(...parsed.properties);
    views.push(parsed.view);
    warnings.push(...parsed.warnings);

    const markdownChildren = sortedFiles.filter(
      (candidate) => candidate.extension === "md" && candidate.parentKey === file.key,
    );
    const rowsByTitle = new Map<string, MutablePage[]>();
    for (const row of parsed.rows) {
      const key = normalizeTitle(row.title);
      rowsByTitle.set(key, [...(rowsByTitle.get(key) ?? []), row]);
    }
    for (const markdown of markdownChildren) {
      const candidates = rowsByTitle.get(normalizeTitle(markdown.title));
      const row = candidates?.shift();
      if (!row) continue;
      const document = markdownToBlocks(markdown.text, markdown.title);
      row.content = document.blocks;
      row.plain_text = [row.plain_text, document.plainText].filter(Boolean).join(" ");
      keyToSourceId.set(markdown.key, row.source_id);
      consumedMarkdown.add(markdown.key);
    }
  }

  for (const file of sortedFiles.filter(
    (item) => item.extension === "md" && !consumedMarkdown.has(item.key),
  )) {
    const document = markdownToBlocks(file.text, file.title);
    const page = createPage({
      content: document.blocks,
      key: file.key,
      parentKey: file.parentKey,
      plainText: document.plainText,
      sourceId: sourceId("page", file.key),
      title: file.title,
      type: "doc",
    });
    pages.push(page);
    keyToSourceId.set(file.key, page.source_id);
  }

  const directoryKeys = new Set<string>();
  for (const file of sortedFiles) {
    const segments = file.key.split("/");
    for (let index = 1; index < segments.length; index += 1) {
      directoryKeys.add(segments.slice(0, index).join("/"));
    }
  }
  for (const key of [...directoryKeys].sort((a, b) => a.split("/").length - b.split("/").length)) {
    if (keyToSourceId.has(key)) continue;
    const segments = key.split("/");
    const page = createPage({
      content: [{ type: "paragraph", content: "" }],
      key,
      parentKey: segments.length > 1 ? segments.slice(0, -1).join("/") : null,
      plainText: "",
      sourceId: sourceId("folder", key),
      title: cleanTitle(segments.at(-1) ?? "Carpeta"),
      type: "doc",
    });
    pages.push(page);
    keyToSourceId.set(key, page.source_id);
  }

  for (const page of pages) {
    if (!page.parent_key) continue;
    const parentSourceId = keyToSourceId.get(page.parent_key);
    if (!parentSourceId) continue;
    const parent = pages.find((candidate) => candidate.source_id === parentSourceId);
    if (parent?.type === "database") page.parent_database_source_id = parentSourceId;
    else page.parent_source_id = parentSourceId;
  }

  const roots = pages.filter(
    (page) => !page.parent_source_id && !page.parent_database_source_id,
  );
  if (roots.length > 1) {
    const wrapper = createPage({
      content: [{ type: "paragraph", content: "Contenido importado desde Notion." }],
      key: "__import_root__",
      parentKey: null,
      plainText: "Contenido importado desde Notion.",
      sourceId: sourceId("root", requestedName),
      title: requestedName,
      type: "doc",
    });
    for (const root of roots) root.parent_source_id = wrapper.source_id;
    pages.push(wrapper);
  }

  if (pages.length > MAX_PAGES) {
    throw new Error(`La plantilla supera el límite de ${MAX_PAGES} páginas y filas.`);
  }

  assignPositions(pages);
  const root = pages.find((page) => !page.parent_source_id && !page.parent_database_source_id);
  if (!root) throw new Error("No pudimos identificar la página principal de la plantilla.");

  const databaseCount = pages.filter((page) => page.type === "database").length;
  const importedRows = pages.filter((page) => page.parent_database_source_id).length;
  const finalPages = pages.map(toTemplatePage);

  return {
    description: [
      `Importada desde Notion: ${finalPages.length - importedRows} páginas`,
      databaseCount ? `${databaseCount} bases de datos` : null,
      importedRows ? `${importedRows} filas` : null,
    ].filter(Boolean).join(", ") + ".",
    icon: databaseCount === 1 && finalPages.length === importedRows + 1 ? "📊" : "📦",
    name: root.title || requestedName,
    snapshot: { pages: finalPages, properties, views },
    warnings,
  };
}

function toTemplatePage(page: MutablePage): TemplatePageSnapshot {
  return {
    content: page.content,
    cover_url: page.cover_url,
    icon: page.icon,
    parent_database_source_id: page.parent_database_source_id,
    parent_source_id: page.parent_source_id,
    plain_text: page.plain_text,
    position: page.position,
    properties: page.properties,
    source_id: page.source_id,
    title: page.title,
    type: page.type,
  };
}

function buildCsvDatabase(file: SourceFile, databaseSourceId: string) {
  const table = parseCsv(file.text);
  if (!table.length) throw new Error(`El CSV “${file.title}” está vacío.`);
  const warnings: string[] = [];
  if (table[0].length > MAX_CSV_COLUMNS) {
    warnings.push(`“${file.title}” se limitó a ${MAX_CSV_COLUMNS} columnas.`);
  }
  if (table.length - 1 > MAX_CSV_ROWS) {
    warnings.push(`“${file.title}” se limitó a ${MAX_CSV_ROWS} filas.`);
  }
  const rawHeaders = table[0].slice(0, MAX_CSV_COLUMNS);
  const headers = uniqueHeaders(rawHeaders);
  if (!headers.length) throw new Error(`El CSV “${file.title}” no tiene columnas.`);
  const records = table.slice(1, MAX_CSV_ROWS + 1).filter((row) => row.some((cell) => cell.trim()));
  const titleIndex = findTitleColumn(headers);
  const propertyColumns = headers
    .map((name, index) => ({ index, name, values: records.map((row) => row[index] ?? "") }))
    .filter((column) => column.index !== titleIndex);
  const inferred = propertyColumns.map((column, index) => ({
    ...column,
    position: (index + 1) * 1000,
    sourceId: sourceId("property", `${file.key}:${column.index}`),
    type: inferPropertyType(column.name, column.values),
  }));
  const properties: TemplatePropertySnapshot[] = inferred.map((property) => ({
    config: propertyConfig(property.type),
    name: property.name,
    page_source_id: databaseSourceId,
    position: property.position,
    source_id: property.sourceId,
    type: property.type,
  }));
  const rows = records.map((record, index) => {
    const title = cleanCell(record[titleIndex] ?? "") || `Fila ${index + 1}`;
    const values = Object.fromEntries(
      inferred.map((property) => [
        property.sourceId,
        convertCellValue(record[property.index] ?? "", property.type),
      ]),
    );
    return createPage({
      content: [],
      key: `${file.key}#row-${index + 1}`,
      parentKey: file.key,
      plainText: [title, ...record].filter(Boolean).join(" "),
      properties: values,
      sourceId: sourceId("row", `${file.key}:${index + 1}`),
      title,
      type: "doc",
    });
  });
  const database = createPage({
    content: null,
    key: file.key,
    parentKey: file.parentKey,
    plainText: "",
    sourceId: databaseSourceId,
    title: file.title,
    type: "database",
  });
  const view: TemplateViewSnapshot = {
    filters: { mode: "and", rules: [] },
    group_by_source_id: null,
    name: "Tabla",
    page_source_id: databaseSourceId,
    position: 1000,
    sorts: [],
    source_id: sourceId("view", file.key),
    type: "table",
    visible_property_source_ids: properties.map((property) => property.source_id),
  };
  return { database, properties, rows, view, warnings };
}

function createPage({
  content,
  key,
  parentKey,
  plainText,
  properties = {},
  sourceId: pageSourceId,
  title,
  type,
}: {
  content: unknown;
  key: string;
  parentKey: string | null;
  plainText: string;
  properties?: Record<string, unknown>;
  sourceId: string;
  title: string;
  type: "database" | "doc";
}): MutablePage {
  return {
    content,
    cover_url: null,
    icon: type === "database" ? "📊" : "📄",
    key,
    parent_database_source_id: null,
    parent_key: parentKey,
    parent_source_id: null,
    plain_text: plainText.slice(0, 100_000),
    position: 1000,
    properties,
    source_id: pageSourceId,
    title: title.slice(0, 250) || "Sin título",
    type,
  };
}

function markdownToBlocks(markdown: string, pageTitle: string) {
  const lines = markdown.replace(/\r\n?/g, "\n").split("\n");
  const blocks: Array<Record<string, unknown>> = [];
  const plain: string[] = [];
  let paragraph: string[] = [];
  let code: string[] | null = null;
  let codeLanguage = "text";

  function pushText(type: string, text: string, props?: Record<string, unknown>) {
    const cleaned = inlineMarkdownToText(text).trim();
    if (!cleaned && type !== "paragraph") return;
    blocks.push({ type, ...(props ? { props } : {}), content: cleaned });
    if (cleaned) plain.push(cleaned);
  }
  function flushParagraph() {
    if (!paragraph.length) return;
    pushText("paragraph", paragraph.join(" "));
    paragraph = [];
  }

  for (const line of lines) {
    const fence = line.match(/^```\s*([^\s]*)/);
    if (fence) {
      if (code) {
        const value = code.join("\n");
        blocks.push({ type: "codeBlock", props: { language: codeLanguage }, content: value });
        if (value) plain.push(value);
        code = null;
        codeLanguage = "text";
      } else {
        flushParagraph();
        code = [];
        codeLanguage = fence[1] || "text";
      }
      continue;
    }
    if (code) {
      code.push(line);
      continue;
    }
    if (!line.trim()) {
      flushParagraph();
      continue;
    }
    const heading = line.match(/^(#{1,6})\s+(.+)$/);
    if (heading) {
      flushParagraph();
      const text = inlineMarkdownToText(heading[2]);
      if (blocks.length === 0 && heading[1].length === 1 && normalizeTitle(text) === normalizeTitle(pageTitle)) {
        continue;
      }
      pushText("heading", text, { level: Math.min(heading[1].length, 3) });
      continue;
    }
    const task = line.match(/^\s*[-*+]\s+\[([ xX])\]\s+(.+)$/);
    if (task) {
      flushParagraph();
      pushText("checkListItem", task[2], { checked: task[1].toLocaleLowerCase() === "x" });
      continue;
    }
    const bullet = line.match(/^\s*[-*+]\s+(.+)$/);
    if (bullet) {
      flushParagraph();
      pushText("bulletListItem", bullet[1]);
      continue;
    }
    const numbered = line.match(/^\s*\d+[.)]\s+(.+)$/);
    if (numbered) {
      flushParagraph();
      pushText("numberedListItem", numbered[1]);
      continue;
    }
    const quote = line.match(/^>\s?(.*)$/);
    if (quote) {
      flushParagraph();
      pushText("quote", quote[1]);
      continue;
    }
    if (/^\s*([-*_])(?:\s*\1){2,}\s*$/.test(line)) {
      flushParagraph();
      blocks.push({ type: "divider" });
      continue;
    }
    if (/^\s*\|.*\|\s*$/.test(line)) {
      flushParagraph();
      pushText("codeBlock", line.replace(/^\s*\||\|\s*$/g, "").split("|").map((cell) => cell.trim()).join("  |  "), { language: "text" });
      continue;
    }
    paragraph.push(line.trim());
  }
  flushParagraph();
  if (code) pushText("codeBlock", code.join("\n"), { language: codeLanguage });
  if (!blocks.length) blocks.push({ type: "paragraph", content: "" });
  return { blocks: blocks.slice(0, 1000), plainText: plain.join(" ").slice(0, 100_000) };
}

function inlineMarkdownToText(value: string) {
  return value
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_match, alt: string) => `🖼️ ${alt || "Imagen"}`)
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1")
    .replace(/<((?:https?:\/\/|mailto:)[^>]+)>/g, "$1")
    .replace(/(\*\*|__)(.*?)\1/g, "$2")
    .replace(/(\*|_)(.*?)\1/g, "$2")
    .replace(/~~(.*?)~~/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\\([\\`*_{}\[\]()#+\-.!])/g, "$1");
}

function parseCsv(input: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < input.length; index += 1) {
    const character = input[index];
    if (character === '"') {
      if (quoted && input[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else quoted = !quoted;
      continue;
    }
    if (character === "," && !quoted) {
      row.push(cell);
      cell = "";
      continue;
    }
    if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && input[index + 1] === "\n") index += 1;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
      continue;
    }
    cell += character;
  }
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

function uniqueHeaders(headers: string[]) {
  const counts = new Map<string, number>();
  return headers.map((header, index) => {
    const base = cleanCell(header) || `Columna ${index + 1}`;
    const count = (counts.get(base) ?? 0) + 1;
    counts.set(base, count);
    return count === 1 ? base : `${base} ${count}`;
  });
}

function findTitleColumn(headers: string[]) {
  const titleNames = new Set(["name", "nombre", "title", "titulo", "título"]);
  const index = headers.findIndex((header) => titleNames.has(normalizeTitle(header)));
  return index >= 0 ? index : 0;
}

function inferPropertyType(name: string, values: string[]): DatabasePropertyType {
  const filled = values.map(cleanCell).filter(Boolean);
  if (!filled.length) return "text";
  const normalizedName = normalizeTitle(name);
  if (/fecha|date|deadline|vencimiento/.test(normalizedName) && filled.every(isDateValue)) return "date";
  if (/telefono|teléfono|phone|mobile|celular/.test(normalizedName)) return "phone";
  if (filled.every((value) => /^(true|false|yes|no|si|sí|x|✓|0|1)$/i.test(value))) return "checkbox";
  if (filled.every((value) => /^-?\d+(?:[.,]\d+)?$/.test(value))) return "number";
  if (filled.every((value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value))) return "email";
  if (filled.every((value) => /^https?:\/\//i.test(value))) return "url";
  if (filled.every(isDateValue) && /created|updated|publicado|inicio|fin/.test(normalizedName)) return "date";
  return "text";
}

function propertyConfig(type: DatabasePropertyType): DatabasePropertyConfig {
  const base = { hidden: false, width: 180 };
  if (type === "number") return { ...base, numberFormat: "number" };
  if (type === "date") return { ...base, range: false };
  return base;
}

function convertCellValue(value: string, type: DatabasePropertyType) {
  const cleaned = cleanCell(value);
  if (!cleaned) return null;
  if (type === "checkbox") return /^(true|yes|si|sí|x|✓|1)$/i.test(cleaned);
  if (type === "number") return Number(cleaned.replace(",", "."));
  if (type === "date") {
    const date = new Date(cleaned);
    return { start: Number.isNaN(date.getTime()) ? cleaned : date.toISOString().slice(0, 10) };
  }
  return cleaned;
}

function assignPositions(pages: MutablePage[]) {
  const groups = new Map<string, MutablePage[]>();
  for (const page of pages) {
    const key = page.parent_database_source_id ?? page.parent_source_id ?? "__root__";
    groups.set(key, [...(groups.get(key) ?? []), page]);
  }
  for (const siblings of groups.values()) {
    siblings
      .sort((left, right) => left.title.localeCompare(right.title, "es"))
      .forEach((page, index) => { page.position = (index + 1) * 1000; });
  }
}

function isUsefulPath(path: string) {
  const normalized = normalizePath(path);
  if (!normalized || normalized.endsWith("/") || normalized.startsWith("__MACOSX/")) return false;
  if (normalized.split("/").some((segment) => segment.startsWith("."))) return false;
  const extension = normalized.split(".").pop()?.toLocaleLowerCase("es") ?? "";
  return SUPPORTED_EXTENSIONS.has(extension);
}

function normalizePath(path: string) {
  return path.replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
}

function cleanTitle(value: string) {
  return value
    .replace(/\s+[0-9a-f]{32}$/i, "")
    .replace(/\s+[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, "")
    .replace(/%20/g, " ")
    .trim() || "Sin título";
}

function cleanCell(value: string) {
  return value.replace(/^\uFEFF/, "").trim();
}

function normalizeTitle(value: string) {
  return cleanTitle(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function isDateValue(value: string) {
  return /^\d{4}-\d{1,2}-\d{1,2}(?:\s|T|$)/.test(value) && !Number.isNaN(new Date(value).getTime());
}

function sourceId(prefix: string, value: string) {
  return `${prefix}:${value}`;
}
