"use client";

import {
  CalendarDays,
  Columns3,
  ArrowDown,
  ArrowUp,
  ChevronRight,
  Eye,
  EyeOff,
  GalleryVerticalEnd,
  SquareKanban,
  List,
  ListPlus,
  LoaderCircle,
  Maximize2,
  Plus,
  SlidersHorizontal,
  Settings2,
  Table2,
  Trash2,
  X,
} from "lucide-react";
import {
  DndContext,
  type DragEndEvent,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  addDays,
  addMonths,
  addWeeks,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  parseISO,
  startOfMonth,
  startOfWeek,
  subMonths,
  subWeeks,
} from "date-fns";
import { es } from "date-fns/locale";
import {
  type ReactNode,
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { Button } from "@/components/ui/button";
import { Backlinks } from "@/components/workspace/page-canvas";
import {
  DATABASE_PROPERTY_TYPES,
  useDatabaseProperties,
} from "@/hooks/use-database-properties";
import {
  DATABASE_VIEW_TYPES,
  useDatabaseViews,
} from "@/hooks/use-database-views";
import type {
  DatabaseFilterOperator,
  DatabaseFilterRule,
  DatabaseOption,
  DatabaseProperty,
  DatabasePropertyConfig,
  DatabasePropertyType,
  DatabaseView,
  DatabaseViewType,
  WorkspacePage,
} from "@/lib/types";

const OPTION_COLORS = ["gray", "blue", "green", "amber", "red", "violet", "pink"];

export function DatabaseCanvas({
  backlinks,
  currentUser,
  database,
  onArchiveRows,
  onCreateRow,
  onOpenRow,
  onOpenPage,
  onResolveFileUrl,
  onUpdatePage,
  pages,
  rows,
}: {
  backlinks: WorkspacePage[];
  currentUser: { id: string; label: string };
  database: WorkspacePage;
  onArchiveRows: (rowIds: string[]) => Promise<boolean>;
  onCreateRow: () => Promise<WorkspacePage | null>;
  onOpenRow: (rowId: string) => void;
  onOpenPage: (pageId: string) => void;
  onResolveFileUrl: (path: string) => Promise<string>;
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
  const {
    createView,
    deleteView,
    isLoading: viewsLoading,
    updateView,
    views,
  } = useDatabaseViews(database.id);
  const [title, setTitle] = useState(database.title);
  const [propertiesOpen, setPropertiesOpen] = useState(false);
  const [viewControlsOpen, setViewControlsOpen] = useState(false);
  const [viewMenuOpen, setViewMenuOpen] = useState(false);
  const [activeViewId, setActiveViewId] = useState<string | null>(null);
  const [newPropertyType, setNewPropertyType] =
    useState<DatabasePropertyType>("text");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [peekRowId, setPeekRowId] = useState<string | null>(null);
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({});
  const activeView =
    views.find((view) => view.id === activeViewId) ?? views[0] ?? null;
  const visibleProperties = useMemo(() => {
    const globallyVisible = properties.filter((property) => !property.config.hidden);
    if (!activeView?.visible_properties.length) return globallyVisible;
    const visible = new Set(activeView.visible_properties);
    return globallyVisible.filter((property) => visible.has(property.id));
  }, [activeView, properties]);
  const processedRows = useMemo(
    () => applyView(rows, properties, activeView),
    [activeView, properties, rows],
  );
  const peekRow = rows.find((row) => row.id === peekRowId) ?? null;
  const titleWidth =
    columnWidths.__title ??
    (typeof database.properties._title_width === "number"
      ? database.properties._title_width
      : 280);

  useEffect(() => setTitle(database.title), [database.id, database.title]);
  useEffect(() => {
    setActiveViewId((current) =>
      views.some((view) => view.id === current) ? current : (views[0]?.id ?? null),
    );
  }, [database.id, views]);
  useEffect(() => {
    setSelected((current) => {
      const valid = new Set(rows.map((row) => row.id));
      return new Set([...current].filter((id) => valid.has(id)));
    });
  }, [rows]);
  useEffect(() => {
    function closePanels(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      setPeekRowId(null);
      setPropertiesOpen(false);
      setViewControlsOpen(false);
      setViewMenuOpen(false);
    }
    window.addEventListener("keydown", closePanels);
    return () => window.removeEventListener("keydown", closePanels);
  }, []);

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

  async function createColumn(name: string, type: DatabasePropertyType) {
    const property = await createProperty(type, name);
    if (property && activeView?.visible_properties.length) {
      await updateView(activeView.id, {
        visible_properties: [...activeView.visible_properties, property.id],
      });
    }
    return property;
  }

  return (
    <section className="relative mx-auto w-full max-w-[1400px] px-4 pb-28 pt-10 sm:px-10 sm:pt-16">
      <div className="mb-2 text-5xl">{database.icon || "📊"}</div>
      <input
        aria-label="Título de la base de datos"
        className="w-full border-none bg-transparent text-3xl font-bold tracking-[-0.04em] outline-none placeholder:text-zinc-300 sm:text-5xl"
        onBlur={saveTitle}
        onChange={(event) => setTitle(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") event.currentTarget.blur();
        }}
        value={title}
      />

      <div className="mt-8 flex min-h-10 flex-wrap items-center gap-1 border-b">
        {views.map((view) => (
          <button
            className={`flex h-10 items-center gap-2 border-b-2 px-3 text-xs font-medium transition-colors ${
              activeView?.id === view.id
                ? "border-indigo-500 text-zinc-900"
                : "border-transparent text-zinc-500 hover:text-zinc-800"
            }`}
            key={view.id}
            onClick={() => setActiveViewId(view.id)}
            type="button"
          >
            <ViewTypeIcon type={view.type} /> {view.name}
          </button>
        ))}
        <div className="relative">
          <button
            aria-label="Añadir vista"
            className="grid size-8 place-items-center rounded-md text-zinc-500 hover:bg-zinc-100"
            onClick={() => setViewMenuOpen((open) => !open)}
            type="button"
          >
            <Plus className="size-4" />
          </button>
          {viewMenuOpen && (
            <div className="absolute left-0 top-9 z-30 w-44 rounded-lg border bg-white p-1 shadow-xl">
              {DATABASE_VIEW_TYPES.map((viewType) => (
                <button
                  className="flex h-9 w-full items-center gap-2 rounded-md px-2 text-left text-xs hover:bg-zinc-100"
                  key={viewType.value}
                  onClick={async () => {
                    const view = await createView(viewType.value);
                    if (view) setActiveViewId(view.id);
                    setViewMenuOpen(false);
                  }}
                  type="button"
                >
                  <ViewTypeIcon type={viewType.value} /> {viewType.label}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="ml-auto flex items-center gap-1">
          <button
            className="flex items-center gap-2 rounded-md px-3 py-1.5 text-xs font-medium text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800"
            onClick={() => setViewControlsOpen((open) => !open)}
            type="button"
          >
            <SlidersHorizontal className="size-3.5" /> Vista
            {activeView &&
              (activeView.filters.rules.length > 0 || activeView.sorts.length > 0) && (
                <span className="rounded-full bg-indigo-50 px-1.5 py-0.5 text-[10px] text-indigo-600">
                  {activeView.filters.rules.length + activeView.sorts.length}
                </span>
              )}
          </button>
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
        </div>
        {selected.size > 0 && (
          <div className="flex items-center gap-2 rounded-lg border bg-white px-2 py-1 shadow-sm">
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

      {viewControlsOpen && activeView && (
        <ViewControls
          currentUser={currentUser}
          onDelete={async () => {
            const deleted = await deleteView(activeView.id);
            if (deleted) setViewControlsOpen(false);
          }}
          onUpdate={(changes) => updateView(activeView.id, changes)}
          properties={properties}
          pages={pages}
          view={activeView}
        />
      )}

      {activeView && (
        <DatabaseViewSurface
          columnWidths={columnWidths}
          currentUser={currentUser}
          database={database}
          onCreateProperty={createColumn}
          onCreateRow={onCreateRow}
          onDeleteProperty={deleteProperty}
          onOpenRow={(rowId) => setPeekRowId(rowId)}
          onResolveFileUrl={onResolveFileUrl}
          onResizeColumn={(propertyId, width) =>
            setColumnWidths((current) => ({ ...current, [propertyId]: width }))
          }
          onToggleRow={toggleRow}
          onUpdatePage={onUpdatePage}
          onUpdateProperty={updateProperty}
          onUpdateView={(changes) => updateView(activeView.id, changes)}
          pages={pages}
          properties={properties}
          rows={processedRows}
          selected={selected}
          setSelected={setSelected}
          titleWidth={titleWidth}
          updateCell={updateCell}
          view={activeView}
          visibleProperties={visibleProperties}
        />
      )}

      {(isLoading || viewsLoading) && (
        <p className="mt-3 text-xs text-zinc-400">Cargando base de datos…</p>
      )}

      <Backlinks backlinks={backlinks} onOpenPage={onOpenPage} />

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

type ViewSurfaceProps = {
  columnWidths: Record<string, number>;
  currentUser: { id: string; label: string };
  database: WorkspacePage;
  onCreateProperty: (
    name: string,
    type: DatabasePropertyType,
  ) => Promise<DatabaseProperty | null>;
  onCreateRow: () => Promise<WorkspacePage | null>;
  onDeleteProperty: (propertyId: string) => Promise<boolean>;
  onOpenRow: (rowId: string) => void;
  onResolveFileUrl: (path: string) => Promise<string>;
  onResizeColumn: (propertyId: string, width: number) => void;
  onToggleRow: (rowId: string) => void;
  onUpdatePage: (pageId: string, changes: Partial<WorkspacePage>) => Promise<boolean>;
  onUpdateProperty: (
    propertyId: string,
    changes: Partial<Pick<DatabaseProperty, "config" | "name" | "position" | "type">>,
  ) => Promise<boolean>;
  onUpdateView: (
    changes: Partial<Pick<DatabaseView, "filters" | "group_by" | "name" | "sorts" | "type" | "visible_properties">>,
  ) => Promise<boolean>;
  pages: WorkspacePage[];
  properties: DatabaseProperty[];
  rows: WorkspacePage[];
  selected: Set<string>;
  setSelected: (selected: Set<string>) => void;
  titleWidth: number;
  updateCell: (row: WorkspacePage, propertyId: string, value: unknown) => Promise<boolean>;
  view: DatabaseView;
  visibleProperties: DatabaseProperty[];
};

function DatabaseViewSurface(props: ViewSurfaceProps) {
  if (props.view.type === "board") return <BoardView {...props} />;
  if (props.view.type === "list") return <ListView {...props} />;
  if (props.view.type === "calendar") return <CalendarView {...props} />;
  if (props.view.type === "gallery") return <GalleryView {...props} />;
  return <TableView {...props} />;
}

function TableView({
  columnWidths,
  currentUser,
  database,
  onCreateProperty,
  onCreateRow,
  onDeleteProperty,
  onOpenRow,
  onResizeColumn,
  onToggleRow,
  onUpdatePage,
  onUpdateProperty,
  pages,
  properties,
  rows,
  selected,
  setSelected,
  titleWidth,
  updateCell,
  view,
  visibleProperties,
}: ViewSurfaceProps) {
  const groups = groupRows(rows, view.group_by, properties, currentUser, pages);
  return (
    <div className="mt-3 overflow-x-auto rounded-xl border bg-white">
      <table className="w-max min-w-full border-collapse text-sm">
        <colgroup>
          <col style={{ width: 42 }} />
          <col style={{ width: titleWidth }} />
          {visibleProperties.map((property) => (
            <col
              key={property.id}
              style={{ width: columnWidths[property.id] ?? property.config.width ?? 180 }}
            />
          ))}
          <col style={{ width: 42 }} />
        </colgroup>
        <thead>
          <tr className="h-10 bg-zinc-50 text-left text-xs font-medium text-zinc-500">
            <th className="border-b border-r px-3">
              <input
                aria-label="Seleccionar todas las filas visibles"
                checked={rows.length > 0 && rows.every((row) => selected.has(row.id))}
                onChange={(event) =>
                  setSelected(event.target.checked ? new Set(rows.map((row) => row.id)) : new Set())
                }
                type="checkbox"
              />
            </th>
            <th className="relative border-b border-r p-0">
              <TitleColumnHeader
                database={database}
                onUpdatePage={onUpdatePage}
              />
              <ColumnResizeHandle
                onCommit={(width) =>
                  void onUpdatePage(database.id, {
                    properties: { ...database.properties, _title_width: width },
                  })
                }
                onResize={(width) => onResizeColumn("__title", width)}
                width={titleWidth}
              />
            </th>
            {visibleProperties.map((property) => {
              const width = columnWidths[property.id] ?? property.config.width ?? 180;
              return (
                <th className="relative border-b border-r p-0" key={property.id}>
                  <ColumnHeaderEditor
                    onDelete={onDeleteProperty}
                    onUpdate={onUpdateProperty}
                    property={property}
                  />
                  <ColumnResizeHandle
                    onCommit={(nextWidth) =>
                      void onUpdateProperty(property.id, {
                        config: { ...property.config, width: nextWidth },
                      })
                    }
                    onResize={(nextWidth) => onResizeColumn(property.id, nextWidth)}
                    width={width}
                  />
                </th>
              );
            })}
            <th className="border-b px-1 text-center">
              <AddColumnButton onCreateProperty={onCreateProperty} />
            </th>
          </tr>
        </thead>
        {groups.map((group) => (
          <tbody key={group.key}>
            {group.label && (
              <tr>
                <td
                  className="border-b bg-zinc-50 px-3 py-2 text-xs font-semibold text-zinc-600"
                  colSpan={visibleProperties.length + 3}
                >
                  {group.label} <span className="ml-1 text-zinc-400">{group.rows.length}</span>
                </td>
              </tr>
            )}
            {group.rows.map((row) => (
              <tr className="group h-10 hover:bg-zinc-50/80" key={row.id}>
                <td className="border-b border-r px-3">
                  <input
                    aria-label={`Seleccionar ${row.title}`}
                    checked={selected.has(row.id)}
                    onChange={() => onToggleRow(row.id)}
                    type="checkbox"
                  />
                </td>
                <td className="border-b border-r p-0">
                  <RowTitleCell
                    onOpen={() => onOpenRow(row.id)}
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
                    onClick={() => onOpenRow(row.id)}
                    type="button"
                  >
                    <ChevronRight className="size-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        ))}
      </table>
      <EmptyRows rows={rows} />
      <NewRowButton onCreateRow={onCreateRow} />
    </div>
  );
}

function TitleColumnHeader({
  database,
  onUpdatePage,
}: {
  database: WorkspacePage;
  onUpdatePage: (pageId: string, changes: Partial<WorkspacePage>) => Promise<boolean>;
}) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const storedName =
    typeof database.properties._title_name === "string"
      ? database.properties._title_name
      : "Nombre";
  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState(storedName);
  const nameRef = useRef(storedName);
  const [position, setPosition] = useState({ left: 12, top: 12 });

  useEffect(() => {
    setName(storedName);
    nameRef.current = storedName;
  }, [storedName]);

  const saveName = useCallback((value = nameRef.current) => {
    const nextName = value.trim() || "Nombre";
    setName(nextName);
    nameRef.current = nextName;
    if (nextName === storedName) return;
    void onUpdatePage(database.id, {
      properties: { ...database.properties, _title_name: nextName },
    });
  }, [database.id, database.properties, onUpdatePage, storedName]);

  useEffect(() => {
    if (!isOpen || !buttonRef.current) return;
    const button = buttonRef.current as HTMLButtonElement;

    function positionMenu() {
      const rect = button.getBoundingClientRect();
      const menuWidth = Math.min(310, window.innerWidth - 24);
      setPosition({
        left: Math.max(12, Math.min(rect.left, window.innerWidth - menuWidth - 12)),
        top: rect.bottom + 6,
      });
    }

    function close(event: MouseEvent) {
      const target = event.target as Node;
      if (!menuRef.current?.contains(target) && !button.contains(target)) {
        saveName();
        setIsOpen(false);
      }
    }

    function closeOnKey(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      saveName();
      setIsOpen(false);
    }

    positionMenu();
    const focusTimer = window.setTimeout(() => inputRef.current?.focus(), 0);
    window.addEventListener("mousedown", close);
    window.addEventListener("keydown", closeOnKey);
    window.addEventListener("resize", positionMenu);
    window.addEventListener("scroll", positionMenu, true);
    return () => {
      window.clearTimeout(focusTimer);
      window.removeEventListener("mousedown", close);
      window.removeEventListener("keydown", closeOnKey);
      window.removeEventListener("resize", positionMenu);
      window.removeEventListener("scroll", positionMenu, true);
    };
  }, [isOpen, saveName]);

  return (
    <>
      <button
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        className="flex h-10 w-full items-center gap-2 px-3 text-left hover:bg-zinc-100"
        onClick={() => setIsOpen((open) => !open)}
        ref={buttonRef}
        type="button"
      >
        <span className="text-zinc-400">Aa</span>
        <span className="truncate">{storedName}</span>
      </button>
      {isOpen && (
        <div
          aria-label={`Editar columna ${storedName}`}
          className="fixed z-[80] w-[min(310px,calc(100vw-24px))] rounded-xl border border-zinc-200 bg-white p-2 text-left font-normal text-zinc-900 shadow-[0_12px_32px_rgba(0,0,0,0.16)]"
          ref={menuRef}
          role="dialog"
          style={{ left: position.left, top: position.top }}
        >
          <label className="flex h-10 items-center gap-2 rounded-lg bg-zinc-50 px-2 focus-within:ring-2 focus-within:ring-indigo-100">
            <span className="w-6 text-center text-sm font-medium text-zinc-500">Aa</span>
            <input
              aria-label="Nombre de la columna principal"
              className="min-w-0 flex-1 bg-transparent text-sm outline-none"
              maxLength={80}
              onBlur={() => saveName()}
              onChange={(event) => {
                setName(event.target.value);
                nameRef.current = event.target.value;
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") event.currentTarget.blur();
              }}
              ref={inputRef}
              value={name}
            />
          </label>
          <div className="mt-2 flex items-center gap-2 rounded-lg px-2 py-2 text-sm text-zinc-600">
            <span className="w-6 text-center text-zinc-400">Aa</span>
            <div>
              <p className="text-zinc-700">Título</p>
              <p className="text-[11px] text-zinc-400">Propiedad principal de la página</p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function ColumnHeaderEditor({
  onDelete,
  onUpdate,
  property,
}: {
  onDelete: (propertyId: string) => Promise<boolean>;
  onUpdate: (
    propertyId: string,
    changes: Partial<Pick<DatabaseProperty, "config" | "name" | "position" | "type">>,
  ) => Promise<boolean>;
  property: DatabaseProperty;
}) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState(property.name);
  const nameRef = useRef(property.name);
  const [position, setPosition] = useState({ left: 12, top: 12 });
  const configurableOptions =
    property.type === "select" ||
    property.type === "multi_select" ||
    property.type === "status";

  useEffect(() => {
    setName(property.name);
    nameRef.current = property.name;
  }, [property.name]);

  const saveName = useCallback((value = nameRef.current) => {
    const nextName = value.trim() || "Propiedad";
    setName(nextName);
    nameRef.current = nextName;
    if (nextName !== property.name) void onUpdate(property.id, { name: nextName });
  }, [onUpdate, property.id, property.name]);

  useEffect(() => {
    if (!isOpen || !buttonRef.current) return;
    const button = buttonRef.current as HTMLButtonElement;

    function positionMenu() {
      const rect = button.getBoundingClientRect();
      const menuWidth = Math.min(330, window.innerWidth - 24);
      const menuHeight = menuRef.current?.offsetHeight ?? 390;
      const roomBelow = window.innerHeight - rect.bottom;
      setPosition({
        left: Math.max(12, Math.min(rect.left, window.innerWidth - menuWidth - 12)),
        top:
          roomBelow >= Math.min(menuHeight, 260)
            ? rect.bottom + 6
            : Math.max(12, rect.top - menuHeight - 6),
      });
    }

    function close(event: MouseEvent) {
      const target = event.target as Node;
      if (!menuRef.current?.contains(target) && !button.contains(target)) {
        saveName();
        setIsOpen(false);
      }
    }

    function closeOnKey(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      saveName();
      setIsOpen(false);
    }

    positionMenu();
    const focusTimer = window.setTimeout(() => inputRef.current?.focus(), 0);
    window.addEventListener("mousedown", close);
    window.addEventListener("keydown", closeOnKey);
    window.addEventListener("resize", positionMenu);
    window.addEventListener("scroll", positionMenu, true);
    return () => {
      window.clearTimeout(focusTimer);
      window.removeEventListener("mousedown", close);
      window.removeEventListener("keydown", closeOnKey);
      window.removeEventListener("resize", positionMenu);
      window.removeEventListener("scroll", positionMenu, true);
    };
  }, [isOpen, saveName]);

  return (
    <>
      <button
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        className="flex h-10 w-full items-center gap-2 px-3 text-left hover:bg-zinc-100"
        onClick={() => setIsOpen((open) => !open)}
        ref={buttonRef}
        type="button"
      >
        <span className="shrink-0 text-zinc-400">{propertyTypeIcon(property.type)}</span>
        <span className="truncate">{property.name}</span>
      </button>
      {isOpen && (
        <div
          aria-label={`Editar columna ${property.name}`}
          className="fixed z-[80] flex w-[min(330px,calc(100vw-24px))] flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white text-left font-normal text-zinc-900 shadow-[0_12px_32px_rgba(0,0,0,0.16)]"
          ref={menuRef}
          role="dialog"
          style={{
            left: position.left,
            maxHeight: `calc(100vh - ${position.top}px - 12px)`,
            top: position.top,
          }}
        >
          <div className="overflow-y-auto p-2">
            <label className="flex h-10 items-center gap-2 rounded-lg bg-zinc-50 px-2 focus-within:ring-2 focus-within:ring-indigo-100">
              <span className="w-6 shrink-0 text-center text-sm font-medium text-zinc-500">
                {propertyTypeIcon(property.type)}
              </span>
              <input
                aria-label="Nombre de la columna"
                className="min-w-0 flex-1 bg-transparent text-sm outline-none"
                maxLength={80}
                onBlur={() => saveName()}
                onChange={(event) => {
                  setName(event.target.value);
                  nameRef.current = event.target.value;
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter") event.currentTarget.blur();
                }}
                ref={inputRef}
                value={name}
              />
            </label>

            <label className="mt-2 block px-2 py-1 text-xs font-medium text-zinc-500">
              Tipo de propiedad
              <select
                className="mt-1.5 h-9 w-full rounded-lg border border-zinc-200 bg-white px-2 text-sm font-normal text-zinc-800 outline-none focus:ring-2 focus:ring-indigo-100"
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
                    {propertyTypeIcon(type.value)} {type.label}
                  </option>
                ))}
              </select>
            </label>

            {property.type === "number" && (
              <label className="mt-2 block px-2 py-1 text-xs font-medium text-zinc-500">
                Formato
                <select
                  className="mt-1.5 h-9 w-full rounded-lg border border-zinc-200 bg-white px-2 text-sm font-normal text-zinc-800"
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
              </label>
            )}

            {property.type === "date" && (
              <label className="mt-2 flex items-center gap-2 rounded-lg px-2 py-2 text-sm text-zinc-700 hover:bg-zinc-50">
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
              <label className="mt-2 block px-2 py-1 text-xs font-medium text-zinc-500">
                Opciones separadas por comas
                <input
                  className="mt-1.5 h-9 w-full rounded-lg border border-zinc-200 bg-white px-2 text-sm font-normal text-zinc-800 outline-none focus:ring-2 focus:ring-indigo-100"
                  defaultValue={(property.config.options ?? [])
                    .map((option) => option.label)
                    .join(", ")}
                  key={JSON.stringify(property.config.options)}
                  onBlur={(event) =>
                    void onUpdate(property.id, {
                      config: {
                        ...property.config,
                        options: optionsFromText(
                          event.target.value,
                          property.config.options ?? [],
                        ),
                      },
                    })
                  }
                  placeholder="Nuevo, En curso, Listo"
                />
              </label>
            )}
          </div>

          <div className="border-t border-zinc-100 p-1.5">
            <button
              className="flex h-9 w-full items-center gap-2 rounded-md px-2 text-sm text-zinc-700 hover:bg-zinc-100"
              onClick={() =>
                void onUpdate(property.id, {
                  config: { ...property.config, hidden: true },
                })
              }
              type="button"
            >
              <EyeOff className="size-4 text-zinc-500" /> Ocultar columna
            </button>
            <button
              className="flex h-9 w-full items-center gap-2 rounded-md px-2 text-sm text-red-600 hover:bg-red-50"
              onClick={async () => {
                if (!window.confirm(`¿Eliminar la columna “${property.name}”?`)) return;
                if (await onDelete(property.id)) setIsOpen(false);
              }}
              type="button"
            >
              <Trash2 className="size-4" /> Eliminar columna
            </button>
          </div>
        </div>
      )}
    </>
  );
}

function AddColumnButton({
  onCreateProperty,
}: {
  onCreateProperty: (
    name: string,
    type: DatabasePropertyType,
  ) => Promise<DatabaseProperty | null>;
}) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [name, setName] = useState("");
  const [type, setType] = useState<DatabasePropertyType>("text");
  const [position, setPosition] = useState({ left: 12, top: 12 });

  useEffect(() => {
    if (!isOpen) return;
    if (!buttonRef.current) return;
    const button = buttonRef.current as HTMLButtonElement;

    function positionMenu() {
      const rect = button.getBoundingClientRect();
      const menuWidth = Math.min(390, window.innerWidth - 24);
      const menuHeight = menuRef.current?.offsetHeight ?? Math.min(480, window.innerHeight - 24);
      const preferredLeft = rect.right - menuWidth;
      const hasRoomBelow = window.innerHeight - rect.bottom >= Math.min(menuHeight, 280);
      setPosition({
        left: Math.max(12, Math.min(preferredLeft, window.innerWidth - menuWidth - 12)),
        top: hasRoomBelow ? rect.bottom + 6 : Math.max(12, rect.top - menuHeight - 6),
      });
    }

    function closeOnKey(event: KeyboardEvent) {
      if (event.key === "Escape") setIsOpen(false);
    }

    function closeOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (!menuRef.current?.contains(target) && !button.contains(target)) {
        setIsOpen(false);
      }
    }

    positionMenu();
    const focusTimer = window.setTimeout(() => inputRef.current?.focus(), 0);
    window.addEventListener("keydown", closeOnKey);
    window.addEventListener("mousedown", closeOutside);
    window.addEventListener("resize", positionMenu);
    window.addEventListener("scroll", positionMenu, true);
    return () => {
      window.clearTimeout(focusTimer);
      window.removeEventListener("keydown", closeOnKey);
      window.removeEventListener("mousedown", closeOutside);
      window.removeEventListener("resize", positionMenu);
      window.removeEventListener("scroll", positionMenu, true);
    };
  }, [isOpen]);

  async function submit(selectedType = type) {
    if (isSaving) return;
    setIsSaving(true);
    setType(selectedType);
    const property = await onCreateProperty(
      name.trim() || DATABASE_PROPERTY_TYPES.find((item) => item.value === selectedType)?.label || "Propiedad",
      selectedType,
    );
    setIsSaving(false);
    if (!property) return;
    setName("");
    setType("text");
    setIsOpen(false);
  }

  return (
    <>
      <button
        aria-label="Añadir columna"
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        className="mx-auto grid size-8 place-items-center rounded-md text-zinc-400 hover:bg-zinc-200 hover:text-zinc-700"
        onClick={() => setIsOpen((open) => !open)}
        ref={buttonRef}
        title="Añadir columna"
        type="button"
      >
        <Plus className="size-4" />
      </button>
      {isOpen && (
        <div
          aria-label="Añadir columna"
          className="fixed z-[80] flex w-[min(390px,calc(100vw-24px))] flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white text-left font-normal text-zinc-900 shadow-[0_12px_32px_rgba(0,0,0,0.16)]"
          ref={menuRef}
          role="dialog"
          style={{
            left: position.left,
            maxHeight: `calc(100vh - ${position.top}px - 12px)`,
            top: position.top,
          }}
        >
          <form
            className="border-b border-zinc-100 p-2"
            onSubmit={(event) => {
              event.preventDefault();
              void submit();
            }}
          >
            <label className="flex h-10 items-center gap-2 rounded-lg px-2 focus-within:bg-zinc-50">
              <span className="grid size-7 shrink-0 place-items-center rounded-md bg-zinc-100 text-sm font-semibold text-zinc-500">
                {propertyTypeIcon(type)}
              </span>
              <input
                aria-label="Nombre de la propiedad"
                className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-zinc-400"
                maxLength={80}
                onChange={(event) => setName(event.target.value)}
                placeholder="Escribe el nombre de la propiedad..."
                ref={inputRef}
                value={name}
              />
              {isSaving && <LoaderCircle className="size-4 shrink-0 animate-spin text-zinc-400" />}
            </label>
          </form>
          <div className="overflow-y-auto p-2">
            <p className="px-2 pb-1.5 pt-1 text-xs font-medium text-zinc-500">
              Seleccionar tipo
            </p>
            <div className="grid grid-cols-2 gap-0.5">
              {DATABASE_PROPERTY_TYPES.map((propertyType) => (
                <button
                  className="flex min-h-9 items-center gap-2 rounded-md px-2 text-left text-sm text-zinc-700 hover:bg-zinc-100 disabled:cursor-wait disabled:opacity-60"
                  disabled={isSaving}
                  key={propertyType.value}
                  onClick={() => void submit(propertyType.value)}
                  type="button"
                >
                  <span className="w-5 shrink-0 text-center text-sm font-medium text-zinc-500">
                    {propertyTypeIcon(propertyType.value)}
                  </span>
                  <span className="truncate">{propertyType.label}</span>
                </button>
              ))}
            </div>
            <p className="mt-2 border-t border-zinc-100 px-2 pb-1 pt-2 text-[11px] text-zinc-400">
              Escribe un nombre y elige el tipo para crear la columna.
            </p>
          </div>
        </div>
      )}
    </>
  );
}

function ListView({
  currentUser,
  onCreateRow,
  onOpenRow,
  pages,
  properties,
  rows,
  view,
  visibleProperties,
}: ViewSurfaceProps) {
  const groups = groupRows(rows, view.group_by, properties, currentUser, pages);
  return (
    <div className="mt-3 overflow-hidden rounded-xl border bg-white">
      {groups.map((group) => (
        <div key={group.key}>
          {group.label && (
            <div className="border-b bg-zinc-50 px-4 py-2 text-xs font-semibold text-zinc-600">
              {group.label} <span className="ml-1 text-zinc-400">{group.rows.length}</span>
            </div>
          )}
          {group.rows.map((row) => (
            <button
              className="group flex w-full items-center gap-3 border-b px-4 py-3 text-left hover:bg-zinc-50"
              key={row.id}
              onClick={() => onOpenRow(row.id)}
              type="button"
            >
              <span className="text-lg">{row.icon || "📄"}</span>
              <span className="min-w-0 flex-1 truncate text-sm font-medium">{row.title}</span>
              {visibleProperties.slice(0, 4).map((property) => (
                <span className="max-w-40 truncate text-xs text-zinc-500" key={property.id}>
                  {propertyDisplayValue(row, property, currentUser, pages)}
                </span>
              ))}
              <ChevronRight className="size-4 text-zinc-300 group-hover:text-zinc-600" />
            </button>
          ))}
        </div>
      ))}
      <EmptyRows rows={rows} />
      <NewRowButton onCreateRow={onCreateRow} />
    </div>
  );
}

function BoardView({
  currentUser,
  onCreateRow,
  onOpenRow,
  pages,
  properties,
  rows,
  updateCell,
  view,
  visibleProperties,
}: ViewSurfaceProps) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  const groupProperty =
    properties.find(
      (property) =>
        property.id === view.group_by &&
        ["select", "status", "person"].includes(property.type),
    ) ?? null;
  const groups = boardGroups(groupProperty, currentUser);

  if (!groupProperty) {
    return (
      <ViewSetupMessage>
        Elige una propiedad de selección, estado o persona en <strong>Vista → Agrupar</strong>
        para organizar el tablero.
      </ViewSetupMessage>
    );
  }

  function handleDragEnd(event: DragEndEvent) {
    const rowId = event.active.data.current?.rowId;
    const groupValue = event.over?.data.current?.groupValue;
    if (typeof rowId !== "string" || groupValue === undefined) return;
    const row = rows.find((item) => item.id === rowId);
    if (row) void updateCell(row, groupProperty!.id, groupValue || null);
  }

  return (
    <DndContext onDragEnd={handleDragEnd} sensors={sensors}>
      <div className="mt-3 flex min-h-[420px] gap-3 overflow-x-auto pb-3">
        {groups.map((group) => (
          <BoardColumn
            currentUser={currentUser}
            group={group}
            key={group.key}
            onOpenRow={onOpenRow}
            pages={pages}
            properties={visibleProperties}
            rows={rows.filter(
              (row) => String(row.properties[groupProperty.id] ?? "") === group.value,
            )}
          />
        ))}
        <button
          className="flex h-10 min-w-64 items-center gap-2 rounded-lg px-3 text-sm text-zinc-500 hover:bg-zinc-100"
          onClick={() => void onCreateRow()}
          type="button"
        >
          <Plus className="size-4" /> Nueva tarjeta
        </button>
      </div>
    </DndContext>
  );
}

function BoardColumn({
  currentUser,
  group,
  onOpenRow,
  pages,
  properties,
  rows,
}: {
  currentUser: { id: string; label: string };
  group: { key: string; label: string; value: string };
  onOpenRow: (rowId: string) => void;
  pages: WorkspacePage[];
  properties: DatabaseProperty[];
  rows: WorkspacePage[];
}) {
  const { isOver, setNodeRef } = useDroppable({
    data: { groupValue: group.value },
    id: `board-group:${group.key}`,
  });
  return (
    <section
      className={`w-72 shrink-0 rounded-xl bg-zinc-100/80 p-2 transition-colors ${
        isOver ? "bg-indigo-50 ring-2 ring-indigo-300" : ""
      }`}
      ref={setNodeRef}
    >
      <div className="flex items-center gap-2 px-1 py-2 text-xs font-semibold text-zinc-600">
        <span className="size-2 rounded-full bg-zinc-400" /> {group.label}
        <span className="ml-auto text-zinc-400">{rows.length}</span>
      </div>
      <div className="space-y-2">
        {rows.map((row) => (
          <BoardCard
            currentUser={currentUser}
            key={row.id}
            onOpen={() => onOpenRow(row.id)}
            pages={pages}
            properties={properties}
            row={row}
          />
        ))}
      </div>
    </section>
  );
}

function BoardCard({
  currentUser,
  onOpen,
  pages,
  properties,
  row,
}: {
  currentUser: { id: string; label: string };
  onOpen: () => void;
  pages: WorkspacePage[];
  properties: DatabaseProperty[];
  row: WorkspacePage;
}) {
  const { attributes, isDragging, listeners, setNodeRef, transform } = useDraggable({
    data: { rowId: row.id },
    id: `board-card:${row.id}`,
  });
  return (
    <article
      className={`cursor-grab rounded-lg border bg-white p-3 shadow-sm ${isDragging ? "opacity-50" : ""}`}
      ref={setNodeRef}
      style={{ transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined }}
      {...attributes}
      {...listeners}
    >
      <button className="w-full text-left text-sm font-medium" onClick={onOpen} type="button">
        {row.icon || "📄"} {row.title}
      </button>
      <div className="mt-2 space-y-1">
        {properties.slice(0, 3).map((property) => (
          <div className="truncate text-xs text-zinc-500" key={property.id}>
            <span className="mr-1 text-zinc-400">{property.name}:</span>
            {propertyDisplayValue(row, property, currentUser, pages)}
          </div>
        ))}
      </div>
    </article>
  );
}

function CalendarView({
  currentUser,
  onCreateRow,
  onOpenRow,
  pages,
  properties,
  rows,
  updateCell,
  view,
}: ViewSurfaceProps) {
  const [cursor, setCursor] = useState(() => new Date());
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  const dateProperty =
    properties.find((property) => property.id === view.group_by && property.type === "date") ??
    properties.find((property) => property.type === "date") ??
    null;
  const mode = view.filters.calendarMode ?? "month";

  if (!dateProperty) {
    return (
      <ViewSetupMessage>
        Añade una propiedad de fecha y selecciónala en <strong>Vista → Fecha del calendario</strong>.
      </ViewSetupMessage>
    );
  }

  const periodStart =
    mode === "week"
      ? startOfWeek(cursor, { weekStartsOn: 1 })
      : startOfWeek(startOfMonth(cursor), { weekStartsOn: 1 });
  const periodEnd =
    mode === "week"
      ? endOfWeek(cursor, { weekStartsOn: 1 })
      : endOfWeek(endOfMonth(cursor), { weekStartsOn: 1 });
  const days: Date[] = [];
  for (let day = periodStart; day <= periodEnd; day = addDays(day, 1)) days.push(day);
  const undated = rows.filter((row) => !dateStart(row.properties[dateProperty.id]));

  function handleDragEnd(event: DragEndEvent) {
    const rowId = event.active.data.current?.rowId;
    const date = event.over?.data.current?.date;
    if (typeof rowId !== "string" || typeof date !== "string") return;
    const row = rows.find((item) => item.id === rowId);
    if (!row) return;
    const existingValue = row.properties[dateProperty!.id];
    const previous: Record<string, unknown> = isRecord(existingValue) ? existingValue : {};
    void updateCell(row, dateProperty!.id, { ...previous, start: date });
  }

  return (
    <DndContext onDragEnd={handleDragEnd} sensors={sensors}>
      <div className="mt-3 overflow-hidden rounded-xl border bg-white">
        <div className="flex flex-wrap items-center gap-2 border-b px-3 py-2">
          <button
            className="rounded-md px-2 py-1 text-xs hover:bg-zinc-100"
            onClick={() => setCursor(new Date())}
            type="button"
          >
            Hoy
          </button>
          <button
            aria-label="Periodo anterior"
            className="grid size-7 place-items-center rounded hover:bg-zinc-100"
            onClick={() => setCursor(mode === "week" ? subWeeks(cursor, 1) : subMonths(cursor, 1))}
            type="button"
          >
            <ChevronRight className="size-4 rotate-180" />
          </button>
          <button
            aria-label="Periodo siguiente"
            className="grid size-7 place-items-center rounded hover:bg-zinc-100"
            onClick={() => setCursor(mode === "week" ? addWeeks(cursor, 1) : addMonths(cursor, 1))}
            type="button"
          >
            <ChevronRight className="size-4" />
          </button>
          <strong className="ml-1 text-sm capitalize">
            {mode === "week"
              ? `${format(periodStart, "d MMM", { locale: es })} – ${format(periodEnd, "d MMM yyyy", { locale: es })}`
              : format(cursor, "MMMM yyyy", { locale: es })}
          </strong>
          <span className="ml-auto text-xs text-zinc-500">Arrastra una tarjeta para cambiar su fecha</span>
        </div>
        <div className="grid grid-cols-7 border-b bg-zinc-50 text-center text-[11px] font-medium uppercase text-zinc-500">
          {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map((day) => (
            <div className="border-r py-2 last:border-r-0" key={day}>{day}</div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {days.map((day) => (
            <CalendarDay
              currentUser={currentUser}
              day={day}
              inMonth={mode === "week" || isSameMonth(day, cursor)}
              key={day.toISOString()}
              onOpenRow={onOpenRow}
              pages={pages}
              rows={rows.filter((row) => {
                const value = dateStart(row.properties[dateProperty.id]);
                return value ? isSameDay(parseISO(value), day) : false;
              })}
            />
          ))}
        </div>
        {undated.length > 0 && (
          <div className="border-t bg-zinc-50 p-3">
            <div className="mb-2 text-xs font-semibold text-zinc-500">Sin fecha</div>
            <div className="flex flex-wrap gap-2">
              {undated.map((row) => (
                <CalendarEvent key={row.id} onOpen={() => onOpenRow(row.id)} row={row} />
              ))}
            </div>
          </div>
        )}
        <NewRowButton onCreateRow={onCreateRow} />
      </div>
    </DndContext>
  );
}

function CalendarDay({
  day,
  inMonth,
  onOpenRow,
  rows,
}: {
  currentUser: { id: string; label: string };
  day: Date;
  inMonth: boolean;
  onOpenRow: (rowId: string) => void;
  pages: WorkspacePage[];
  rows: WorkspacePage[];
}) {
  const date = format(day, "yyyy-MM-dd");
  const { isOver, setNodeRef } = useDroppable({ data: { date }, id: `calendar-day:${date}` });
  return (
    <div
      className={`min-h-28 border-b border-r p-1.5 transition-colors ${
        inMonth ? "bg-white" : "bg-zinc-50 text-zinc-300"
      } ${isOver ? "bg-indigo-50 ring-2 ring-inset ring-indigo-300" : ""}`}
      ref={setNodeRef}
    >
      <div className={`mb-1 text-right text-xs ${isSameDay(day, new Date()) ? "font-bold text-indigo-600" : ""}`}>
        {format(day, "d")}
      </div>
      <div className="space-y-1">
        {rows.map((row) => (
          <CalendarEvent key={row.id} onOpen={() => onOpenRow(row.id)} row={row} />
        ))}
      </div>
    </div>
  );
}

function CalendarEvent({ onOpen, row }: { onOpen: () => void; row: WorkspacePage }) {
  const { attributes, isDragging, listeners, setNodeRef, transform } = useDraggable({
    data: { rowId: row.id },
    id: `calendar-event:${row.id}`,
  });
  return (
    <button
      className={`block w-full cursor-grab truncate rounded bg-indigo-50 px-2 py-1 text-left text-[11px] font-medium text-indigo-800 ${
        isDragging ? "opacity-50" : ""
      }`}
      onClick={onOpen}
      ref={setNodeRef}
      style={{ transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined }}
      type="button"
      {...attributes}
      {...listeners}
    >
      {row.icon || "📄"} {row.title}
    </button>
  );
}

function GalleryView({
  currentUser,
  onCreateRow,
  onOpenRow,
  onResolveFileUrl,
  pages,
  properties,
  rows,
  view,
  visibleProperties,
}: ViewSurfaceProps) {
  const groups = groupRows(rows, view.group_by, properties, currentUser, pages);
  return (
    <div className="mt-3 space-y-4">
      {groups.map((group) => (
        <section key={group.key}>
          {group.label && (
            <div className="mb-2 text-xs font-semibold text-zinc-600">
              {group.label} <span className="ml-1 text-zinc-400">{group.rows.length}</span>
            </div>
          )}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {group.rows.map((row) => (
              <button
                className="overflow-hidden rounded-xl border bg-white text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                key={row.id}
                onClick={() => onOpenRow(row.id)}
                type="button"
              >
                <CoverPreview path={row.cover_url} resolveFileUrl={onResolveFileUrl} />
                <div className="p-3">
                  <div className="truncate text-sm font-semibold">{row.icon || "📄"} {row.title}</div>
                  <div className="mt-2 space-y-1">
                    {visibleProperties.slice(0, 4).map((property) => (
                      <div className="flex gap-2 text-xs" key={property.id}>
                        <span className="shrink-0 text-zinc-400">{property.name}</span>
                        <span className="min-w-0 truncate text-zinc-600">
                          {propertyDisplayValue(row, property, currentUser, pages)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </section>
      ))}
      <EmptyRows rows={rows} />
      <button
        className="flex h-10 items-center gap-2 rounded-lg px-3 text-sm text-zinc-500 hover:bg-zinc-100"
        onClick={() => void onCreateRow()}
        type="button"
      >
        <Plus className="size-4" /> Nueva tarjeta
      </button>
    </div>
  );
}

function CoverPreview({
  path,
  resolveFileUrl,
}: {
  path: string | null;
  resolveFileUrl: (path: string) => Promise<string>;
}) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    if (!path) {
      setUrl(null);
      return;
    }
    void resolveFileUrl(path)
      .then((nextUrl) => {
        if (active) setUrl(nextUrl);
      })
      .catch(() => {
        if (active) setUrl(null);
      });
    return () => {
      active = false;
    };
  }, [path, resolveFileUrl]);
  return (
    <div
      className="h-32 bg-gradient-to-br from-indigo-50 to-zinc-100 bg-cover bg-center"
      style={url ? { backgroundImage: `url(${JSON.stringify(url)})` } : undefined}
    />
  );
}

function ViewControls({
  currentUser,
  onDelete,
  onUpdate,
  pages,
  properties,
  view,
}: {
  currentUser: { id: string; label: string };
  onDelete: () => Promise<void>;
  onUpdate: (
    changes: Partial<Pick<DatabaseView, "filters" | "group_by" | "name" | "sorts" | "type" | "visible_properties">>,
  ) => Promise<boolean>;
  pages: WorkspacePage[];
  properties: DatabaseProperty[];
  view: DatabaseView;
}) {
  const filters = normalizeFilters(view.filters);
  const groupCandidates =
    view.type === "board"
      ? properties.filter((property) => ["select", "status", "person"].includes(property.type))
      : view.type === "calendar"
        ? properties.filter((property) => property.type === "date")
        : properties;
  const visible = view.visible_properties.length
    ? new Set(view.visible_properties)
    : new Set(properties.filter((property) => !property.config.hidden).map((property) => property.id));

  function updateFilter(ruleId: string, changes: Partial<DatabaseFilterRule>) {
    void onUpdate({
      filters: {
        ...filters,
        rules: filters.rules.map((rule) => (rule.id === ruleId ? { ...rule, ...changes } : rule)),
      },
    });
  }

  return (
    <div className="mt-3 rounded-xl border bg-zinc-50/80 p-3 text-xs">
      <div className="grid gap-3 border-b pb-3 md:grid-cols-3">
        <label className="space-y-1 text-zinc-500">
          <span>Nombre de la vista</span>
          <input
            className="h-9 w-full rounded-md border bg-white px-2 text-zinc-900"
            defaultValue={view.name}
            key={view.name}
            onBlur={(event) => {
              const name = event.target.value.trim() || "Vista";
              if (name !== view.name) void onUpdate({ name });
            }}
          />
        </label>
        <label className="space-y-1 text-zinc-500">
          <span>Tipo</span>
          <select
            className="h-9 w-full rounded-md border bg-white px-2 text-zinc-900"
            onChange={(event) =>
              void onUpdate({ group_by: null, type: event.target.value as DatabaseViewType })
            }
            value={view.type}
          >
            {DATABASE_VIEW_TYPES.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
          </select>
        </label>
        <label className="space-y-1 text-zinc-500">
          <span>{view.type === "calendar" ? "Fecha del calendario" : "Agrupar"}</span>
          <select
            className="h-9 w-full rounded-md border bg-white px-2 text-zinc-900"
            onChange={(event) => void onUpdate({ group_by: event.target.value || null })}
            value={view.group_by ?? ""}
          >
            <option value="">Sin agrupación</option>
            {groupCandidates.map((property) => <option key={property.id} value={property.id}>{property.name}</option>)}
          </select>
        </label>
      </div>

      {view.type === "calendar" && (
        <div className="flex items-center gap-2 border-b py-3">
          <span className="font-medium text-zinc-600">Escala</span>
          {(["month", "week"] as const).map((mode) => (
            <button
              className={`rounded-md px-2 py-1 ${filters.calendarMode === mode || (!filters.calendarMode && mode === "month") ? "bg-white shadow-sm" : "text-zinc-500"}`}
              key={mode}
              onClick={() => void onUpdate({ filters: { ...filters, calendarMode: mode } })}
              type="button"
            >
              {mode === "month" ? "Mes" : "Semana"}
            </button>
          ))}
        </div>
      )}

      <div className="grid gap-4 py-3 lg:grid-cols-2">
        <section>
          <div className="mb-2 flex items-center gap-2 font-semibold text-zinc-700">
            Filtros
            <select
              className="ml-auto h-7 rounded border bg-white px-1 font-normal"
              onChange={(event) =>
                void onUpdate({ filters: { ...filters, mode: event.target.value as "and" | "or" } })
              }
              value={filters.mode}
            >
              <option value="and">Cumplir todas (Y)</option>
              <option value="or">Cumplir alguna (O)</option>
            </select>
          </div>
          <div className="space-y-2">
            {filters.rules.map((rule) => {
              const property = properties.find((item) => item.id === rule.property_id);
              const type = rule.property_id === "__title" ? "text" : property?.type ?? "text";
              return (
                <div className="grid grid-cols-[1fr_1fr_1fr_auto] gap-1" key={rule.id}>
                  <select
                    className="h-8 min-w-0 rounded border bg-white px-1"
                    onChange={(event) => {
                      const propertyId = event.target.value;
                      const nextProperty = properties.find((item) => item.id === propertyId);
                      const nextType = propertyId === "__title" ? "text" : nextProperty?.type ?? "text";
                      updateFilter(rule.id, {
                        operator: operatorsForType(nextType)[0].value,
                        property_id: propertyId,
                        value: "",
                      });
                    }}
                    value={rule.property_id}
                  >
                    <option value="__title">Nombre</option>
                    {properties.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                  </select>
                  <select
                    className="h-8 min-w-0 rounded border bg-white px-1"
                    onChange={(event) => updateFilter(rule.id, { operator: event.target.value as DatabaseFilterOperator })}
                    value={rule.operator}
                  >
                    {operatorsForType(type).map((operator) => <option key={operator.value} value={operator.value}>{operator.label}</option>)}
                  </select>
                  <FilterValueInput
                    currentUser={currentUser}
                    onChange={(value) => updateFilter(rule.id, { value })}
                    operator={rule.operator}
                    pages={pages}
                    property={property}
                    value={rule.value}
                  />
                  <button
                    aria-label="Eliminar filtro"
                    className="grid size-8 place-items-center rounded hover:bg-red-50 hover:text-red-600"
                    onClick={() => void onUpdate({ filters: { ...filters, rules: filters.rules.filter((item) => item.id !== rule.id) } })}
                    type="button"
                  ><X className="size-3.5" /></button>
                </div>
              );
            })}
          </div>
          <button
            className="mt-2 flex items-center gap-1 rounded px-2 py-1 text-zinc-500 hover:bg-white"
            onClick={() => void onUpdate({ filters: { ...filters, rules: [...filters.rules, { id: crypto.randomUUID(), operator: "contains", property_id: "__title", value: "" }] } })}
            type="button"
          ><Plus className="size-3" /> Añadir filtro</button>
        </section>

        <section>
          <div className="mb-2 font-semibold text-zinc-700">Ordenamientos</div>
          <div className="space-y-2">
            {view.sorts.map((sort) => (
              <div className="grid grid-cols-[1fr_1fr_auto] gap-1" key={sort.id}>
                <select
                  className="h-8 min-w-0 rounded border bg-white px-1"
                  onChange={(event) => void onUpdate({ sorts: view.sorts.map((item) => item.id === sort.id ? { ...item, property_id: event.target.value } : item) })}
                  value={sort.property_id}
                >
                  <option value="__title">Nombre</option>
                  {properties.map((property) => <option key={property.id} value={property.id}>{property.name}</option>)}
                </select>
                <select
                  className="h-8 rounded border bg-white px-1"
                  onChange={(event) => void onUpdate({ sorts: view.sorts.map((item) => item.id === sort.id ? { ...item, direction: event.target.value as "asc" | "desc" } : item) })}
                  value={sort.direction}
                >
                  <option value="asc">Ascendente</option>
                  <option value="desc">Descendente</option>
                </select>
                <button
                  aria-label="Eliminar orden"
                  className="grid size-8 place-items-center rounded hover:bg-red-50 hover:text-red-600"
                  onClick={() => void onUpdate({ sorts: view.sorts.filter((item) => item.id !== sort.id) })}
                  type="button"
                ><X className="size-3.5" /></button>
              </div>
            ))}
          </div>
          <button
            className="mt-2 flex items-center gap-1 rounded px-2 py-1 text-zinc-500 hover:bg-white"
            onClick={() => void onUpdate({ sorts: [...view.sorts, { direction: "asc", id: crypto.randomUUID(), property_id: "__title" }] })}
            type="button"
          ><Plus className="size-3" /> Añadir orden</button>
        </section>
      </div>

      <section className="border-t pt-3">
        <div className="mb-2 flex items-center gap-2 font-semibold text-zinc-700"><Columns3 className="size-3.5" /> Propiedades visibles en esta vista</div>
        <div className="flex flex-wrap gap-2">
          {properties.map((property) => (
            <label className="flex items-center gap-1.5 rounded-md border bg-white px-2 py-1.5 text-zinc-600" key={property.id}>
              <input
                checked={visible.has(property.id)}
                onChange={(event) => {
                  const next = new Set(visible);
                  next.delete("__none");
                  if (event.target.checked) next.add(property.id); else next.delete(property.id);
                  void onUpdate({ visible_properties: next.size ? [...next] : ["__none"] });
                }}
                type="checkbox"
              />
              {property.name}
            </label>
          ))}
        </div>
      </section>
      <div className="mt-3 flex justify-end border-t pt-3">
        <button
          className="flex items-center gap-1 rounded-md px-2 py-1.5 text-red-600 hover:bg-red-50"
          onClick={() => {
            if (window.confirm(`¿Eliminar la vista “${view.name}”?`)) void onDelete();
          }}
          type="button"
        ><Trash2 className="size-3.5" /> Eliminar vista</button>
      </div>
    </div>
  );
}

function FilterValueInput({
  currentUser,
  onChange,
  operator,
  pages,
  property,
  value,
}: {
  currentUser: { id: string; label: string };
  onChange: (value: unknown) => void;
  operator: DatabaseFilterOperator;
  pages: WorkspacePage[];
  property: DatabaseProperty | undefined;
  value: unknown;
}) {
  if (["is_empty", "is_not_empty", "checked", "unchecked"].includes(operator)) {
    return <span className="h-8 rounded border border-dashed px-2 py-1.5 text-zinc-400">Sin valor</span>;
  }
  if (property && ["select", "status", "multi_select"].includes(property.type)) {
    return (
      <select className="h-8 min-w-0 rounded border bg-white px-1" onChange={(event) => onChange(event.target.value)} value={typeof value === "string" ? value : ""}>
        <option value="">Elegir…</option>
        {(property.config.options ?? []).map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
      </select>
    );
  }
  if (property?.type === "person") {
    return (
      <select className="h-8 min-w-0 rounded border bg-white px-1" onChange={(event) => onChange(event.target.value)} value={typeof value === "string" ? value : ""}>
        <option value="">Elegir…</option>
        <option value={currentUser.id}>{currentUser.label}</option>
      </select>
    );
  }
  if (property?.type === "relation") {
    return (
      <select className="h-8 min-w-0 rounded border bg-white px-1" onChange={(event) => onChange(event.target.value)} value={typeof value === "string" ? value : ""}>
        <option value="">Elegir…</option>
        {pages.filter((page) => !page.is_archived).map((page) => <option key={page.id} value={page.id}>{page.title}</option>)}
      </select>
    );
  }
  return (
    <input
      className="h-8 min-w-0 rounded border bg-white px-2"
      onBlur={(event) => onChange(property?.type === "number" ? Number(event.target.value) : event.target.value)}
      defaultValue={typeof value === "string" || typeof value === "number" ? value : ""}
      key={String(value)}
      type={property && ["date", "created_time", "last_edited_time"].includes(property.type) ? "date" : property?.type === "number" ? "number" : "text"}
    />
  );
}

function ViewSetupMessage({ children }: { children: ReactNode }) {
  return <div className="mt-3 rounded-xl border border-dashed bg-zinc-50 px-6 py-16 text-center text-sm text-zinc-500">{children}</div>;
}

function EmptyRows({ rows }: { rows: WorkspacePage[] }) {
  if (rows.length) return null;
  return <div className="px-4 py-12 text-center text-sm text-zinc-400">No hay filas que coincidan con esta vista.</div>;
}

function NewRowButton({ onCreateRow }: { onCreateRow: () => Promise<WorkspacePage | null> }) {
  return (
    <button className="flex h-10 w-full items-center gap-2 border-t px-4 text-sm text-zinc-500 hover:bg-zinc-50 hover:text-zinc-800" onClick={() => void onCreateRow()} type="button">
      <Plus className="size-4" /> Nueva fila
    </button>
  );
}

function ViewTypeIcon({ type }: { type: DatabaseViewType }) {
  if (type === "board") return <SquareKanban className="size-3.5" />;
  if (type === "list") return <List className="size-3.5" />;
  if (type === "calendar") return <CalendarDays className="size-3.5" />;
  if (type === "gallery") return <GalleryVerticalEnd className="size-3.5" />;
  return <Table2 className="size-3.5" />;
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

function normalizeFilters(filters: DatabaseView["filters"] | null | undefined) {
  return {
    calendarMode: filters?.calendarMode === "week" ? "week" as const : "month" as const,
    mode: filters?.mode === "or" ? "or" as const : "and" as const,
    rules: Array.isArray(filters?.rules) ? filters.rules : [],
  };
}

function applyView(
  rows: WorkspacePage[],
  properties: DatabaseProperty[],
  view: DatabaseView | null,
) {
  if (!view) return rows;
  const filters = normalizeFilters(view.filters);
  const filtered = filters.rules.length
    ? rows.filter((row) => {
        const results = filters.rules.map((rule) => matchesFilter(row, rule, properties));
        return filters.mode === "or" ? results.some(Boolean) : results.every(Boolean);
      })
    : [...rows];
  if (!view.sorts.length) return filtered;
  return filtered.sort((left, right) => {
    for (const sort of view.sorts) {
      const comparison = compareValues(
        valueForProperty(left, sort.property_id, properties),
        valueForProperty(right, sort.property_id, properties),
      );
      if (comparison !== 0) return sort.direction === "asc" ? comparison : -comparison;
    }
    return Number(left.position) - Number(right.position);
  });
}

function matchesFilter(
  row: WorkspacePage,
  rule: DatabaseFilterRule,
  properties: DatabaseProperty[],
) {
  const value = valueForProperty(row, rule.property_id, properties);
  const empty = isEmptyValue(value);
  if (rule.operator === "is_empty") return empty;
  if (rule.operator === "is_not_empty") return !empty;
  if (rule.operator === "checked") return value === true;
  if (rule.operator === "unchecked") return value !== true;
  if (empty) return rule.operator === "is_not" || rule.operator === "not_contains";

  const expected = rule.value;
  const comparable = Array.isArray(value) ? value.map(String) : String(value).toLocaleLowerCase("es");
  const expectedText = String(expected ?? "").toLocaleLowerCase("es");
  if (rule.operator === "contains") {
    return Array.isArray(comparable)
      ? comparable.includes(String(expected ?? ""))
      : comparable.includes(expectedText);
  }
  if (rule.operator === "not_contains") {
    return Array.isArray(comparable)
      ? !comparable.includes(String(expected ?? ""))
      : !comparable.includes(expectedText);
  }
  if (rule.operator === "is") return String(value) === String(expected ?? "");
  if (rule.operator === "is_not") return String(value) !== String(expected ?? "");
  if (rule.operator === "greater_than") return Number(value) > Number(expected);
  if (rule.operator === "less_than") return Number(value) < Number(expected);
  if (rule.operator === "before") return String(value) < String(expected ?? "");
  if (rule.operator === "after") return String(value) > String(expected ?? "");
  if (rule.operator === "on") return String(value) === String(expected ?? "");
  return true;
}

function valueForProperty(
  row: WorkspacePage,
  propertyId: string,
  properties: DatabaseProperty[],
) {
  if (propertyId === "__title") return row.title;
  const property = properties.find((item) => item.id === propertyId);
  if (property?.type === "created_time") return row.created_at.slice(0, 10);
  if (property?.type === "last_edited_time") return row.updated_at.slice(0, 10);
  if (property?.type === "date") return dateStart(row.properties[propertyId]);
  return row.properties[propertyId];
}

function compareValues(left: unknown, right: unknown) {
  if (isEmptyValue(left) && isEmptyValue(right)) return 0;
  if (isEmptyValue(left)) return 1;
  if (isEmptyValue(right)) return -1;
  if (typeof left === "number" && typeof right === "number") return left - right;
  if (typeof left === "boolean" && typeof right === "boolean") return Number(left) - Number(right);
  return String(left).localeCompare(String(right), "es", { numeric: true, sensitivity: "base" });
}

function isEmptyValue(value: unknown) {
  if (value === null || value === undefined || value === "") return true;
  if (Array.isArray(value)) return value.length === 0;
  if (isRecord(value)) return !value.start && !value.end;
  return false;
}

function operatorsForType(type: DatabasePropertyType) {
  const empty = [
    { label: "Está vacío", value: "is_empty" as const },
    { label: "No está vacío", value: "is_not_empty" as const },
  ];
  if (type === "checkbox") {
    return [
      { label: "Marcada", value: "checked" as const },
      { label: "Sin marcar", value: "unchecked" as const },
    ];
  }
  if (type === "number") {
    return [
      { label: "Es", value: "is" as const },
      { label: "No es", value: "is_not" as const },
      { label: "Mayor que", value: "greater_than" as const },
      { label: "Menor que", value: "less_than" as const },
      ...empty,
    ];
  }
  if (["date", "created_time", "last_edited_time"].includes(type)) {
    return [
      { label: "Es el día", value: "on" as const },
      { label: "Antes de", value: "before" as const },
      { label: "Después de", value: "after" as const },
      ...empty,
    ];
  }
  if (["select", "status", "person", "relation"].includes(type)) {
    return [
      { label: "Es", value: "is" as const },
      { label: "No es", value: "is_not" as const },
      ...empty,
    ];
  }
  return [
    { label: "Contiene", value: "contains" as const },
    { label: "No contiene", value: "not_contains" as const },
    { label: "Es", value: "is" as const },
    { label: "No es", value: "is_not" as const },
    ...empty,
  ];
}

function groupRows(
  rows: WorkspacePage[],
  groupBy: string | null,
  properties: DatabaseProperty[],
  currentUser: { id: string; label: string },
  pages: WorkspacePage[],
) {
  const property = properties.find((item) => item.id === groupBy);
  if (!property) return [{ key: "all", label: null, rows }];
  const groups = new Map<string, WorkspacePage[]>();
  for (const row of rows) {
    const raw = valueForProperty(row, property.id, properties);
    const key = Array.isArray(raw) ? String(raw[0] ?? "") : String(raw ?? "");
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }
  return [...groups.entries()].map(([key, groupedRows]) => ({
    key: key || "empty",
    label: key
      ? propertyDisplayValue(groupedRows[0], property, currentUser, pages)
      : "Sin valor",
    rows: groupedRows,
  }));
}

function boardGroups(
  property: DatabaseProperty | null,
  currentUser: { id: string; label: string },
) {
  const groups = [{ key: "empty", label: "Sin asignar", value: "" }];
  if (!property) return groups;
  if (property.type === "person") {
    groups.push({ key: currentUser.id, label: currentUser.label, value: currentUser.id });
    return groups;
  }
  for (const option of property.config.options ?? []) {
    groups.push({ key: option.id, label: option.label, value: option.id });
  }
  return groups;
}

function propertyDisplayValue(
  row: WorkspacePage,
  property: DatabaseProperty,
  currentUser: { id: string; label: string },
  pages: WorkspacePage[],
) {
  if (property.type === "created_time") return formatDateTime(row.created_at);
  if (property.type === "last_edited_time") return formatDateTime(row.updated_at);
  const value = row.properties[property.id];
  if (isEmptyValue(value)) return "—";
  if (property.type === "checkbox") return value ? "Sí" : "No";
  if (property.type === "date") {
    const start = dateStart(value);
    if (!start) return "—";
    const end = isRecord(value) && typeof value.end === "string" ? value.end : null;
    return end ? `${start} – ${end}` : start;
  }
  if (property.type === "person") return value === currentUser.id ? currentUser.label : "Sin asignar";
  if (property.type === "relation") {
    const related = pages.find((page) => page.id === value);
    return related ? related.title : "—";
  }
  if (["select", "status"].includes(property.type)) {
    return property.config.options?.find((option) => option.id === value)?.label ?? "—";
  }
  if (property.type === "multi_select" && Array.isArray(value)) {
    return value
      .map((id) => property.config.options?.find((option) => option.id === id)?.label)
      .filter(Boolean)
      .join(", ") || "—";
  }
  return String(value);
}

function dateStart(value: unknown) {
  return isRecord(value) && typeof value.start === "string" ? value.start : null;
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
