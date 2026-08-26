"use client";

import {
  ArrowDown,
  ArrowUp,
  ChevronRight,
  Eye,
  EyeOff,
  ListPlus,
  Maximize2,
  Plus,
  Settings2,
  Table2,
  Trash2,
  X,
} from "lucide-react";
import {
  type PointerEvent as ReactPointerEvent,
  useEffect,
  useMemo,
  useState,
} from "react";

import { Button } from "@/components/ui/button";
import {
  DATABASE_PROPERTY_TYPES,
  useDatabaseProperties,
} from "@/hooks/use-database-properties";
import type {
  DatabaseOption,
  DatabaseProperty,
  DatabasePropertyConfig,
  DatabasePropertyType,
  WorkspacePage,
} from "@/lib/types";

const OPTION_COLORS = ["gray", "blue", "green", "amber", "red", "violet", "pink"];

export function DatabaseCanvas({
  currentUser,
  database,
  onArchiveRows,
  onCreateRow,
  onOpenRow,
  onUpdatePage,
  pages,
  rows,
}: {
  currentUser: { id: string; label: string };
  database: WorkspacePage;
  onArchiveRows: (rowIds: string[]) => Promise<boolean>;
  onCreateRow: () => Promise<WorkspacePage | null>;
  onOpenRow: (rowId: string) => void;
  onUpdatePage: (pageId: string, changes: Partial<WorkspacePage>) => Promise<boolean>;
  pages: WorkspacePage[];
  rows: WorkspacePage[];
}) {
  const {
    createProperty,
    deleteProperty,
    isLoading,
    moveProperty,
    properties,
    updateProperty,
  } = useDatabaseProperties(database.id);
  const [title, setTitle] = useState(database.title);
  const [propertiesOpen, setPropertiesOpen] = useState(false);
  const [newPropertyType, setNewPropertyType] =
    useState<DatabasePropertyType>("text");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [peekRowId, setPeekRowId] = useState<string | null>(null);
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({});
  const visibleProperties = useMemo(
    () => properties.filter((property) => !property.config.hidden),
    [properties],
  );
  const peekRow = rows.find((row) => row.id === peekRowId) ?? null;
  const titleWidth =
    columnWidths.__title ??
    (typeof database.properties._title_width === "number"
      ? database.properties._title_width
      : 280);

  useEffect(() => setTitle(database.title), [database.id, database.title]);
  useEffect(() => {
    setSelected((current) => {
      const valid = new Set(rows.map((row) => row.id));
      return new Set([...current].filter((id) => valid.has(id)));
    });
  }, [rows]);

  function saveTitle() {
    const nextTitle = title.trim() || "Base de datos";
    setTitle(nextTitle);
    if (nextTitle !== database.title) {
      void onUpdatePage(database.id, { title: nextTitle });
    }
  }

  function toggleRow(rowId: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(rowId)) next.delete(rowId);
      else next.add(rowId);
      return next;
    });
  }

  async function archiveSelected() {
    const ids = [...selected];
    if (await onArchiveRows(ids)) {
      setSelected(new Set());
      if (peekRowId && ids.includes(peekRowId)) setPeekRowId(null);
    }
  }

  function updateCell(row: WorkspacePage, propertyId: string, value: unknown) {
    return onUpdatePage(row.id, {
      properties: { ...row.properties, [propertyId]: value },
    });
  }

  return (
    <section className="relative mx-auto w-full max-w-[1400px] px-10 pb-28 pt-16">
      <div className="mb-2 text-5xl">{database.icon || "📊"}</div>
      <input
        aria-label="Título de la base de datos"
        className="w-full border-none bg-transparent text-5xl font-bold tracking-[-0.04em] outline-none placeholder:text-zinc-300"
        onBlur={saveTitle}
        onChange={(event) => setTitle(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") event.currentTarget.blur();
        }}
        value={title}
      />

      <div className="mt-8 flex min-h-9 flex-wrap items-center gap-2">
        <div className="flex items-center gap-2 rounded-md bg-zinc-100 px-3 py-1.5 text-xs font-medium text-zinc-600">
          <Table2 className="size-3.5" /> Tabla
        </div>
        <button
          className="flex items-center gap-2 rounded-md px-3 py-1.5 text-xs font-medium text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800"
          onClick={() => setPropertiesOpen((open) => !open)}
          type="button"
        >
          <Settings2 className="size-3.5" /> Propiedades
          <span className="rounded-full bg-zinc-100 px-1.5 py-0.5 text-[10px]">
            {properties.length}
          </span>
        </button>
        {selected.size > 0 && (
          <div className="ml-auto flex items-center gap-2 rounded-lg border bg-white px-2 py-1 shadow-sm">
            <span className="px-1 text-xs font-medium">{selected.size} seleccionadas</span>
            <Button onClick={() => void archiveSelected()} size="sm" variant="destructive">
              <Trash2 className="size-3.5" /> Archivar
            </Button>
            <button
              aria-label="Limpiar selección"
              className="grid size-7 place-items-center rounded hover:bg-zinc-100"
              onClick={() => setSelected(new Set())}
              type="button"
            >
              <X className="size-3.5" />
            </button>
          </div>
        )}
      </div>

      {propertiesOpen && (
        <PropertyPanel
          newPropertyType={newPropertyType}
          onAdd={() => void createProperty(newPropertyType)}
          onChangeNewType={setNewPropertyType}
          onDelete={deleteProperty}
          onMove={moveProperty}
          onUpdate={updateProperty}
          properties={properties}
        />
      )}

      <div className="mt-3 overflow-x-auto rounded-xl border bg-white">
        <table className="w-max min-w-full border-collapse text-sm">
          <colgroup>
            <col style={{ width: 42 }} />
            <col style={{ width: titleWidth }} />
            {visibleProperties.map((property) => (
              <col
                key={property.id}
                style={{
                  width:
                    columnWidths[property.id] ?? property.config.width ?? 180,
                }}
              />
            ))}
            <col style={{ width: 42 }} />
          </colgroup>
          <thead>
            <tr className="h-10 bg-zinc-50 text-left text-xs font-medium text-zinc-500">
              <th className="border-b border-r px-3">
                <input
                  aria-label="Seleccionar todas las filas"
                  checked={rows.length > 0 && selected.size === rows.length}
                  onChange={(event) =>
                    setSelected(
                      event.target.checked
                        ? new Set(rows.map((row) => row.id))
                        : new Set(),
                    )
                  }
                  type="checkbox"
                />
              </th>
              <th className="relative border-b border-r px-3">
                Nombre
                <ColumnResizeHandle
                  onCommit={(width) =>
                    void onUpdatePage(database.id, {
                      properties: {
                        ...database.properties,
                        _title_width: width,
                      },
                    })
                  }
                  onResize={(width) =>
                    setColumnWidths((current) => ({ ...current, __title: width }))
                  }
                  width={titleWidth}
                />
              </th>
              {visibleProperties.map((property) => {
                const width =
                  columnWidths[property.id] ?? property.config.width ?? 180;
                return (
                  <th className="relative border-b border-r px-3" key={property.id}>
                    <span className="mr-2">{propertyTypeIcon(property.type)}</span>
                    {property.name}
                    <ColumnResizeHandle
                      onCommit={(nextWidth) =>
                        void updateProperty(property.id, {
                          config: { ...property.config, width: nextWidth },
                        })
                      }
                      onResize={(nextWidth) =>
                        setColumnWidths((current) => ({
                          ...current,
                          [property.id]: nextWidth,
                        }))
                      }
                      width={width}
                    />
                  </th>
                );
              })}
              <th className="border-b px-2 text-center">
                <button
                  aria-label="Añadir propiedad"
                  className="grid size-7 place-items-center rounded hover:bg-zinc-200"
                  onClick={() => setPropertiesOpen(true)}
                  type="button"
                >
                  <Plus className="size-3.5" />
                </button>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr className="group h-10 hover:bg-zinc-50/80" key={row.id}>
                <td className="border-b border-r px-3">
                  <input
                    aria-label={`Seleccionar ${row.title}`}
                    checked={selected.has(row.id)}
                    onChange={() => toggleRow(row.id)}
                    type="checkbox"
                  />
                </td>
                <td className="border-b border-r p-0">
                  <RowTitleCell
                    onOpen={() => setPeekRowId(row.id)}
                    onUpdate={(value) => onUpdatePage(row.id, { title: value })}
                    row={row}
                  />
                </td>
                {visibleProperties.map((property) => (
                  <td className="border-b border-r p-0" key={property.id}>
                    <DatabaseCell
                      currentUser={currentUser}
                      onCommit={(value) => updateCell(row, property.id, value)}
                      pages={pages}
                      property={property}
                      row={row}
                      value={row.properties[property.id]}
                    />
                  </td>
                ))}
                <td className="border-b px-2 text-center">
                  <button
                    aria-label={`Abrir ${row.title}`}
                    className="grid size-7 place-items-center rounded opacity-0 hover:bg-zinc-100 group-hover:opacity-100"
                    onClick={() => setPeekRowId(row.id)}
                    type="button"
                  >
                    <ChevronRight className="size-4" />
                  </button>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td
                  className="py-12 text-center text-sm text-zinc-400"
                  colSpan={visibleProperties.length + 3}
                >
                  Aún no hay filas. Crea la primera para comenzar.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        <button
          className="flex h-10 w-full items-center gap-2 border-t px-4 text-sm text-zinc-500 hover:bg-zinc-50 hover:text-zinc-800"
          onClick={() => void onCreateRow()}
          type="button"
        >
          <Plus className="size-4" /> Nueva fila
        </button>
      </div>

      {isLoading && (
        <p className="mt-3 text-xs text-zinc-400">Cargando propiedades…</p>
      )}

      {peekRow && (
        <RowPeek
          currentUser={currentUser}
          onClose={() => setPeekRowId(null)}
          onOpenFull={() => onOpenRow(peekRow.id)}
          onUpdatePage={onUpdatePage}
          pages={pages}
          properties={properties}
          row={peekRow}
        />
      )}
    </section>
  );
}

function PropertyPanel({
  newPropertyType,
  onAdd,
  onChangeNewType,
  onDelete,
  onMove,
  onUpdate,
  properties,
}: {
  newPropertyType: DatabasePropertyType;
  onAdd: () => void;
  onChangeNewType: (type: DatabasePropertyType) => void;
  onDelete: (propertyId: string) => Promise<boolean>;
  onMove: (propertyId: string, direction: -1 | 1) => Promise<boolean>;
  onUpdate: (
    propertyId: string,
    changes: Partial<Pick<DatabaseProperty, "config" | "name" | "position" | "type">>,
  ) => Promise<boolean>;
  properties: DatabaseProperty[];
}) {
  return (
    <div className="mt-3 rounded-xl border bg-zinc-50/80 p-3">
      <div className="flex flex-wrap items-center gap-2 border-b pb-3">
        <select
          aria-label="Tipo de nueva propiedad"
          className="h-8 rounded-md border bg-white px-2 text-xs"
          onChange={(event) =>
            onChangeNewType(event.target.value as DatabasePropertyType)
          }
          value={newPropertyType}
        >
          {DATABASE_PROPERTY_TYPES.map((type) => (
            <option key={type.value} value={type.value}>
              {type.label}
            </option>
          ))}
        </select>
        <Button onClick={onAdd} size="sm">
          <ListPlus className="size-3.5" /> Añadir propiedad
        </Button>
      </div>
      <div className="mt-2 space-y-2">
        {properties.map((property, index) => (
          <PropertyEditorRow
            first={index === 0}
            key={property.id}
            last={index === properties.length - 1}
            onDelete={onDelete}
            onMove={onMove}
            onUpdate={onUpdate}
            property={property}
          />
        ))}
        {properties.length === 0 && (
          <p className="px-2 py-4 text-center text-xs text-zinc-400">
            Añade propiedades para crear columnas.
          </p>
        )}
      </div>
    </div>
  );
}

function PropertyEditorRow({
  first,
  last,
  onDelete,
  onMove,
  onUpdate,
  property,
}: {
  first: boolean;
  last: boolean;
  onDelete: (propertyId: string) => Promise<boolean>;
  onMove: (propertyId: string, direction: -1 | 1) => Promise<boolean>;
  onUpdate: (
    propertyId: string,
    changes: Partial<Pick<DatabaseProperty, "config" | "name" | "position" | "type">>,
  ) => Promise<boolean>;
  property: DatabaseProperty;
}) {
  const [name, setName] = useState(property.name);
  const configurableOptions =
    property.type === "select" ||
    property.type === "multi_select" ||
    property.type === "status";

  useEffect(() => setName(property.name), [property.name]);

  return (
    <div className="rounded-lg border bg-white p-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="w-6 text-center text-sm">{propertyTypeIcon(property.type)}</span>
        <input
          aria-label="Nombre de propiedad"
          className="h-8 min-w-36 flex-1 rounded-md border px-2 text-xs outline-none focus:ring-2 focus:ring-indigo-200"
          onBlur={() => {
            const next = name.trim() || "Propiedad";
            setName(next);
            if (next !== property.name) void onUpdate(property.id, { name: next });
          }}
          onChange={(event) => setName(event.target.value)}
          value={name}
        />
        <select
          aria-label="Tipo de propiedad"
          className="h-8 rounded-md border bg-white px-2 text-xs"
          onChange={(event) => {
            const type = event.target.value as DatabasePropertyType;
            void onUpdate(property.id, {
              config: configForType(type, property.config),
              type,
            });
          }}
          value={property.type}
        >
          {DATABASE_PROPERTY_TYPES.map((type) => (
            <option key={type.value} value={type.value}>
              {type.label}
            </option>
          ))}
        </select>
        <button
          aria-label="Mover propiedad a la izquierda"
          className="grid size-8 place-items-center rounded-md hover:bg-zinc-100 disabled:opacity-30"
          disabled={first}
          onClick={() => void onMove(property.id, -1)}
          type="button"
        >
          <ArrowUp className="size-3.5 -rotate-90" />
        </button>
        <button
          aria-label="Mover propiedad a la derecha"
          className="grid size-8 place-items-center rounded-md hover:bg-zinc-100 disabled:opacity-30"
          disabled={last}
          onClick={() => void onMove(property.id, 1)}
          type="button"
        >
          <ArrowDown className="size-3.5 -rotate-90" />
        </button>
        <button
          aria-label={property.config.hidden ? "Mostrar propiedad" : "Ocultar propiedad"}
          className="grid size-8 place-items-center rounded-md hover:bg-zinc-100"
          onClick={() =>
            void onUpdate(property.id, {
              config: { ...property.config, hidden: !property.config.hidden },
            })
          }
          type="button"
        >
          {property.config.hidden ? (
            <EyeOff className="size-3.5" />
          ) : (
            <Eye className="size-3.5" />
          )}
        </button>
        <button
          aria-label="Eliminar propiedad"
          className="grid size-8 place-items-center rounded-md text-red-500 hover:bg-red-50"
          onClick={() => {
            if (window.confirm(`¿Eliminar la propiedad “${property.name}”?`)) {
              void onDelete(property.id);
            }
          }}
          type="button"
        >
          <Trash2 className="size-3.5" />
        </button>
      </div>

      {property.type === "number" && (
        <div className="mt-2 flex items-center gap-2 pl-8 text-xs text-zinc-500">
          Formato
          <select
            className="h-8 rounded-md border bg-white px-2"
            onChange={(event) =>
              void onUpdate(property.id, {
                config: {
                  ...property.config,
                  numberFormat: event.target.value as "number" | "currency" | "percent",
                },
              })
            }
            value={property.config.numberFormat ?? "number"}
          >
            <option value="number">Número</option>
            <option value="currency">Moneda</option>
            <option value="percent">Porcentaje</option>
          </select>
        </div>
      )}

      {property.type === "date" && (
        <label className="mt-2 flex items-center gap-2 pl-8 text-xs text-zinc-500">
          <input
            checked={Boolean(property.config.range)}
            onChange={(event) =>
              void onUpdate(property.id, {
                config: { ...property.config, range: event.target.checked },
              })
            }
            type="checkbox"
          />
          Permitir rango de fechas
        </label>
      )}

      {configurableOptions && (
        <label className="mt-2 grid grid-cols-[auto_1fr] items-center gap-2 pl-8 text-xs text-zinc-500">
          Opciones
          <input
            className="h-8 rounded-md border bg-white px-2 text-zinc-800"
            defaultValue={(property.config.options ?? []).map((option) => option.label).join(", ")}
            key={JSON.stringify(property.config.options)}
            onBlur={(event) =>
              void onUpdate(property.id, {
                config: {
                  ...property.config,
                  options: optionsFromText(event.target.value, property.config.options ?? []),
                },
              })
            }
            placeholder="Nuevo, En curso, Listo"
          />
        </label>
      )}
    </div>
  );
}

function RowTitleCell({
  onOpen,
  onUpdate,
  row,
}: {
  onOpen: () => void;
  onUpdate: (value: string) => Promise<boolean>;
  row: WorkspacePage;
}) {
  const [value, setValue] = useState(row.title);
  useEffect(() => setValue(row.title), [row.title]);

  return (
    <div className="flex h-10 items-center gap-1 px-2">
      <span className="shrink-0">{row.icon || "📄"}</span>
      <input
        aria-label="Nombre de fila"
        className="min-w-0 flex-1 bg-transparent outline-none"
        onBlur={() => {
          const next = value.trim() || "Sin título";
          setValue(next);
          if (next !== row.title) void onUpdate(next);
        }}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") event.currentTarget.blur();
        }}
        value={value}
      />
      <button
        aria-label="Abrir fila en panel"
        className="grid size-7 shrink-0 place-items-center rounded opacity-0 hover:bg-zinc-100 group-hover:opacity-100 focus:opacity-100"
        onClick={onOpen}
        type="button"
      >
        <Maximize2 className="size-3.5" />
      </button>
    </div>
  );
}

function DatabaseCell({
  currentUser,
  onCommit,
  pages,
  property,
  row,
  value,
}: {
  currentUser: { id: string; label: string };
  onCommit: (value: unknown) => Promise<boolean>;
  pages: WorkspacePage[];
  property: DatabaseProperty;
  row: WorkspacePage;
  value: unknown;
}) {
  if (property.type === "created_time" || property.type === "last_edited_time") {
    const date = property.type === "created_time" ? row.created_at : row.updated_at;
    return <div className="px-3 py-2 text-xs text-zinc-500">{formatDateTime(date)}</div>;
  }

  if (property.type === "checkbox") {
    return (
      <label className="grid h-10 place-items-center">
        <input
          checked={Boolean(value)}
          onChange={(event) => void onCommit(event.target.checked)}
          type="checkbox"
        />
      </label>
    );
  }

  if (property.type === "select" || property.type === "status") {
    return (
      <select
        aria-label={property.name}
        className="h-10 w-full bg-transparent px-2 outline-none"
        onChange={(event) => void onCommit(event.target.value || null)}
        value={typeof value === "string" ? value : ""}
      >
        <option value="">Vacío</option>
        {(property.config.options ?? []).map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </select>
    );
  }

  if (property.type === "multi_select") {
    const selectedValues = Array.isArray(value)
      ? value.filter((item): item is string => typeof item === "string")
      : [];
    return (
      <select
        aria-label={property.name}
        className="min-h-10 w-full bg-transparent px-2 py-1 text-xs outline-none"
        multiple
        onChange={(event) =>
          void onCommit(
            [...event.target.selectedOptions].map((option) => option.value),
          )
        }
        value={selectedValues}
      >
        {(property.config.options ?? []).map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </select>
    );
  }

  if (property.type === "date") {
    const dateValue = isRecord(value) ? value : {};
    return (
      <div className="flex min-h-10 items-center gap-1 px-1">
        <input
          aria-label={`${property.name}, inicio`}
          className="min-w-28 flex-1 bg-transparent text-xs outline-none"
          onChange={(event) =>
            void onCommit({ ...dateValue, start: event.target.value || null })
          }
          type="date"
          value={typeof dateValue.start === "string" ? dateValue.start : ""}
        />
        {property.config.range && (
          <input
            aria-label={`${property.name}, fin`}
            className="min-w-28 flex-1 bg-transparent text-xs outline-none"
            onChange={(event) =>
              void onCommit({ ...dateValue, end: event.target.value || null })
            }
            type="date"
            value={typeof dateValue.end === "string" ? dateValue.end : ""}
          />
        )}
      </div>
    );
  }

  if (property.type === "person") {
    return (
      <select
        aria-label={property.name}
        className="h-10 w-full bg-transparent px-2 outline-none"
        onChange={(event) => void onCommit(event.target.value || null)}
        value={typeof value === "string" ? value : ""}
      >
        <option value="">Sin asignar</option>
        <option value={currentUser.id}>{currentUser.label}</option>
      </select>
    );
  }

  if (property.type === "relation") {
    return (
      <select
        aria-label={property.name}
        className="h-10 w-full bg-transparent px-2 outline-none"
        onChange={(event) => void onCommit(event.target.value || null)}
        value={typeof value === "string" ? value : ""}
      >
        <option value="">Sin relación</option>
        {pages
          .filter((page) => !page.is_archived && page.id !== row.id)
          .map((page) => (
            <option key={page.id} value={page.id}>
              {page.icon || "📄"} {page.title}
            </option>
          ))}
      </select>
    );
  }

  return (
    <TextLikeCell
      numberFormat={property.config.numberFormat}
      onCommit={onCommit}
      type={property.type}
      value={value}
    />
  );
}

function TextLikeCell({
  numberFormat,
  onCommit,
  type,
  value,
}: {
  numberFormat?: "number" | "currency" | "percent";
  onCommit: (value: unknown) => Promise<boolean>;
  type: DatabasePropertyType;
  value: unknown;
}) {
  const [draft, setDraft] = useState(
    typeof value === "string" || typeof value === "number" ? String(value) : "",
  );
  useEffect(() => {
    setDraft(
      typeof value === "string" || typeof value === "number" ? String(value) : "",
    );
  }, [value]);
  const inputType =
    type === "number"
      ? "number"
      : type === "email"
        ? "email"
        : type === "url"
          ? "url"
          : type === "phone"
            ? "tel"
            : "text";

  return (
    <div className="flex h-10 items-center px-2">
      {type === "number" && numberFormat === "currency" && (
        <span className="mr-1 text-xs text-zinc-400">S/</span>
      )}
      <input
        className="min-w-0 flex-1 bg-transparent outline-none"
        onBlur={() =>
          void onCommit(
            type === "number" ? (draft === "" ? null : Number(draft)) : draft,
          )
        }
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") event.currentTarget.blur();
        }}
        step={type === "number" ? "any" : undefined}
        type={inputType}
        value={draft}
      />
      {type === "number" && numberFormat === "percent" && (
        <span className="ml-1 text-xs text-zinc-400">%</span>
      )}
    </div>
  );
}

function RowPeek({
  currentUser,
  onClose,
  onOpenFull,
  onUpdatePage,
  pages,
  properties,
  row,
}: {
  currentUser: { id: string; label: string };
  onClose: () => void;
  onOpenFull: () => void;
  onUpdatePage: (pageId: string, changes: Partial<WorkspacePage>) => Promise<boolean>;
  pages: WorkspacePage[];
  properties: DatabaseProperty[];
  row: WorkspacePage;
}) {
  const [title, setTitle] = useState(row.title);
  useEffect(() => setTitle(row.title), [row.id, row.title]);

  return (
    <aside className="fixed bottom-0 right-0 top-12 z-40 w-[min(560px,calc(100vw-40px))] overflow-y-auto border-l bg-white shadow-2xl">
      <div className="sticky top-0 z-10 flex h-12 items-center justify-between border-b bg-white/95 px-4 backdrop-blur">
        <span className="text-xs font-medium text-zinc-500">Vista previa de fila</span>
        <div className="flex items-center gap-1">
          <Button onClick={onOpenFull} size="sm" variant="ghost">
            <Maximize2 className="size-3.5" /> Abrir completa
          </Button>
          <button
            aria-label="Cerrar panel"
            className="grid size-8 place-items-center rounded-md hover:bg-zinc-100"
            onClick={onClose}
            type="button"
          >
            <X className="size-4" />
          </button>
        </div>
      </div>
      <div className="px-10 py-12">
        <div className="text-4xl">{row.icon || "📄"}</div>
        <input
          aria-label="Título de la fila"
          className="mt-3 w-full bg-transparent text-3xl font-bold tracking-tight outline-none"
          onBlur={() => {
            const next = title.trim() || "Sin título";
            setTitle(next);
            if (next !== row.title) void onUpdatePage(row.id, { title: next });
          }}
          onChange={(event) => setTitle(event.target.value)}
          value={title}
        />
        <div className="mt-8 divide-y rounded-xl border">
          {properties.map((property) => (
            <div className="grid grid-cols-[140px_1fr] items-center" key={property.id}>
              <div className="px-3 py-2 text-xs font-medium text-zinc-500">
                {propertyTypeIcon(property.type)} {property.name}
              </div>
              <div className="border-l">
                <DatabaseCell
                  currentUser={currentUser}
                  onCommit={(value) =>
                    onUpdatePage(row.id, {
                      properties: { ...row.properties, [property.id]: value },
                    })
                  }
                  pages={pages}
                  property={property}
                  row={row}
                  value={row.properties[property.id]}
                />
              </div>
            </div>
          ))}
          {properties.length === 0 && (
            <p className="px-4 py-8 text-center text-sm text-zinc-400">
              Esta base de datos aún no tiene propiedades.
            </p>
          )}
        </div>
        <button
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-lg border border-dashed px-4 py-6 text-sm text-zinc-500 hover:border-zinc-400 hover:bg-zinc-50"
          onClick={onOpenFull}
          type="button"
        >
          <Maximize2 className="size-4" /> Abrir como página para escribir contenido
        </button>
      </div>
    </aside>
  );
}

function ColumnResizeHandle({
  onCommit,
  onResize,
  width,
}: {
  onCommit: (width: number) => void;
  onResize: (width: number) => void;
  width: number;
}) {
  function beginResize(event: ReactPointerEvent<HTMLDivElement>) {
    event.preventDefault();
    event.stopPropagation();
    const startX = event.clientX;
    let lastWidth = width;
    function move(pointerEvent: PointerEvent) {
      lastWidth = Math.min(520, Math.max(110, width + pointerEvent.clientX - startX));
      onResize(lastWidth);
    }
    function stop() {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", stop);
      onCommit(lastWidth);
    }
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", stop);
  }

  return (
    <div
      aria-label="Redimensionar columna"
      className="absolute inset-y-0 right-0 w-1 cursor-col-resize hover:bg-indigo-400"
      onPointerDown={beginResize}
      role="separator"
    />
  );
}

function configForType(
  type: DatabasePropertyType,
  previous: DatabasePropertyConfig,
): DatabasePropertyConfig {
  const base = { hidden: previous.hidden, width: previous.width ?? 180 };
  if (type === "number") return { ...base, numberFormat: "number" };
  if (type === "select" || type === "multi_select" || type === "status") {
    return { ...base, options: previous.options ?? [] };
  }
  if (type === "date") return { ...base, range: false };
  return base;
}

function optionsFromText(text: string, previous: DatabaseOption[]) {
  const labels = [...new Set(text.split(",").map((label) => label.trim()).filter(Boolean))];
  return labels.map((label, index) => {
    const existing = previous.find(
      (option) => option.label.toLocaleLowerCase("es") === label.toLocaleLowerCase("es"),
    );
    return (
      existing ?? {
        color: OPTION_COLORS[index % OPTION_COLORS.length],
        id: crypto.randomUUID(),
        label,
      }
    );
  });
}

function propertyTypeIcon(type: DatabasePropertyType) {
  const icons: Record<DatabasePropertyType, string> = {
    text: "Aa",
    number: "#",
    select: "◉",
    multi_select: "◌",
    status: "◔",
    date: "▣",
    checkbox: "☑",
    url: "↗",
    email: "@",
    phone: "☎",
    person: "●",
    relation: "↔",
    created_time: "◷",
    last_edited_time: "◷",
  };
  return icons[type];
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("es-PE", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
