"use client";

import {
  CalendarDays,
  Columns3,
  ArrowDown,
  ArrowUp,
  Check,
  ChevronDown,
  ChevronRight,
  Copy,
  Eye,
  EyeOff,
  ExternalLink,
  Filter,
  GalleryVerticalEnd,
  Group,
  SquareKanban,
  List,
  ListPlus,
  LoaderCircle,
  Maximize2,
  Pencil,
  Plus,
  SlidersHorizontal,
  SortAsc,
  SortDesc,
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
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { IconPicker } from "@/components/workspace/icon-picker";
import { Backlinks } from "@/components/workspace/page-canvas";
import { PageIcon } from "@/components/workspace/page-icon";
import { PageHero } from "@/components/workspace/page-hero";
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
  WorkspaceMember,
  WorkspacePage,
} from "@/lib/types";

const OPTION_COLORS = ["gray", "blue", "green", "amber", "red", "violet", "pink"];

export function DatabaseCanvas({
  backlinks,
  currentUser,
  members,
  database,
  onArchiveRows,
  onCreateRow,
  onOpenRow,
  onOpenPage,
  onResolveFileUrl,
  onUpdatePage,
  onUploadFile,
  pages,
  readOnly = false,
  rows,
}: {
  backlinks: WorkspacePage[];
  currentUser: { id: string; label: string };
  members: WorkspaceMember[];
  database: WorkspacePage;
  onArchiveRows: (rowIds: string[]) => Promise<boolean>;
  onCreateRow: () => Promise<WorkspacePage | null>;
  onOpenRow: (rowId: string) => void;
  onOpenPage: (pageId: string) => void;
  onResolveFileUrl: (path: string) => Promise<string>;
  onUpdatePage: (pageId: string, changes: Partial<WorkspacePage>) => Promise<boolean>;
  onUploadFile: (pageId: string, file: File) => Promise<string>;
  pages: WorkspacePage[];
  readOnly?: boolean;
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
  const [propertiesOpen, setPropertiesOpen] = useState(false);
  const [viewControlsOpen, setViewControlsOpen] = useState(false);
  const [viewMenuOpen, setViewMenuOpen] = useState(false);
  const [viewTabMenuId, setViewTabMenuId] = useState<string | null>(null);
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

  useEffect(() => {
    const linkedViewId = new URL(window.location.href).searchParams.get("view");
    setActiveViewId((current) => {
      if (linkedViewId && views.some((view) => view.id === linkedViewId)) {
        return linkedViewId;
      }
      return views.some((view) => view.id === current)
        ? current
        : (views[0]?.id ?? null);
    });
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
      setViewTabMenuId(null);
    }
    window.addEventListener("keydown", closePanels);
    return () => window.removeEventListener("keydown", closePanels);
  }, []);

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

  async function duplicateView(source: DatabaseView) {
    const duplicate = await createView(source.type);
    if (!duplicate) return;
    const saved = await updateView(duplicate.id, {
      filters: normalizeFilters(source.filters),
      group_by: source.group_by,
      name: `${source.name} copia`,
      sorts: source.sorts.map((sort) => ({ ...sort, id: crypto.randomUUID() })),
      visible_properties: [...source.visible_properties],
    });
    if (saved) selectView(duplicate.id);
  }

  function selectView(viewId: string) {
    setActiveViewId(viewId);
    const url = new URL(window.location.href);
    url.searchParams.set("view", viewId);
    window.history.replaceState(window.history.state, "", url);
  }

  async function copyViewLink(viewId?: string) {
    const url = new URL(window.location.href);
    if (viewId) url.searchParams.set("view", viewId);
    else url.searchParams.delete("view");
    await navigator.clipboard.writeText(url.toString());
    toast.success(viewId ? "Enlace de la vista copiado" : "Enlace del origen copiado");
  }

  function visiblePropertyIds() {
    if (!activeView) return [];
    return activeView.visible_properties.length
      ? activeView.visible_properties.filter((id) => id !== "__none")
      : properties.filter((property) => !property.config.hidden).map((property) => property.id);
  }

  async function insertProperty(
    target: DatabaseProperty,
    direction: "left" | "right",
  ) {
    const ordered = [...properties].sort(
      (a, b) => Number(a.position) - Number(b.position),
    );
    const targetIndex = ordered.findIndex((property) => property.id === target.id);
    const neighbor =
      direction === "left" ? ordered[targetIndex - 1] : ordered[targetIndex + 1];
    const property = await createProperty("text", "Propiedad");
    if (!property) return null;
    const position =
      direction === "left"
        ? neighbor
          ? (Number(neighbor.position) + Number(target.position)) / 2
          : Number(target.position) - 1000
        : neighbor
          ? (Number(target.position) + Number(neighbor.position)) / 2
          : Number(target.position) + 1000;
    await updateProperty(property.id, { position });
    if (activeView?.visible_properties.length) {
      const ids = visiblePropertyIds();
      const index = ids.indexOf(target.id);
      ids.splice(direction === "left" ? index : index + 1, 0, property.id);
      await updateView(activeView.id, { visible_properties: ids });
    }
    return property;
  }

  async function duplicateProperty(source: DatabaseProperty) {
    const duplicate = await insertProperty(source, "right");
    if (!duplicate) return;
    await updateProperty(duplicate.id, {
      config: { ...source.config, options: source.config.options?.map((option) => ({ ...option })) },
      name: `${source.name} copia`,
      type: source.type,
    });
    await Promise.all(
      rows.map((row) =>
        onUpdatePage(row.id, {
          properties: {
            ...row.properties,
            [duplicate.id]: row.properties[source.id],
          },
        }),
      ),
    );
  }

  function filterByProperty(property: DatabaseProperty) {
    if (!activeView) return;
    const filters = normalizeFilters(activeView.filters);
    void updateView(activeView.id, {
      filters: {
        ...filters,
        rules: [
          ...filters.rules,
          {
            id: crypto.randomUUID(),
            operator: operatorsForType(property.type)[0].value,
            property_id: property.id,
            value: "",
          },
        ],
      },
    });
    setViewControlsOpen(true);
  }

  function sortByProperty(property: DatabaseProperty, direction: "asc" | "desc") {
    if (!activeView) return;
    const existing = activeView.sorts.find((sort) => sort.property_id === property.id);
    void updateView(activeView.id, {
      sorts: existing
        ? activeView.sorts.map((sort) =>
            sort.id === existing.id ? { ...sort, direction } : sort,
          )
        : [
            ...activeView.sorts,
            { direction, id: crypto.randomUUID(), property_id: property.id },
          ],
    });
  }

  return (
    <section className="relative mx-auto w-full max-w-[1400px] pb-28">
      <PageHero
        contentClassName="w-full px-4 sm:px-10"
        coverPath={database.cover_url}
        icon={database.icon}
        onUpdate={(changes) => onUpdatePage(database.id, changes)}
        onUploadFile={(file) => onUploadFile(database.id, file)}
        properties={database.properties}
        readOnly={readOnly}
        resolveFileUrl={onResolveFileUrl}
        title={database.title}
        titleAriaLabel="Título de la base de datos"
        titleClassName="w-full border-none bg-transparent text-3xl font-bold tracking-[-0.035em] outline-none placeholder:text-zinc-300 sm:text-[40px] sm:leading-[1.2]"
        titlePlaceholder="Base de datos"
      />

      <div className="mt-8 flex min-h-10 flex-wrap items-center gap-1 border-b px-4 sm:px-10">
        {views.map((view) => (
          <ViewTab
            active={activeView?.id === view.id}
            isMenuOpen={viewTabMenuId === view.id}
            key={view.id}
            onDelete={async () => {
              if (await deleteView(view.id)) {
                setViewTabMenuId(null);
                if (activeView?.id === view.id) {
                  const next = views.find((item) => item.id !== view.id);
                  if (next) selectView(next.id);
                }
              }
            }}
            onCopyLink={() => copyViewLink(view.id)}
            onCopySourceLink={() => copyViewLink()}
            onDuplicate={() => {
              setViewTabMenuId(null);
              void duplicateView(view);
            }}
            onEdit={() => {
              setActiveViewId(view.id);
              setViewControlsOpen(true);
              setViewTabMenuId(null);
            }}
            onMenuToggle={() => {
              setViewMenuOpen(false);
              selectView(view.id);
              setViewTabMenuId((current) => (current === view.id ? null : view.id));
            }}
            onSelect={() => {
              selectView(view.id);
              setViewTabMenuId(null);
            }}
            onUpdate={(changes) => updateView(view.id, changes)}
            sourceName={database.title}
            view={view}
          />
        ))}
        <div className="relative">
          <button
            aria-label="Añadir vista"
            className="grid size-8 place-items-center rounded-md text-zinc-500 hover:bg-zinc-100"
            onClick={() => {
              setViewTabMenuId(null);
              setViewMenuOpen((open) => !open);
            }}
            type="button"
          >
            <Plus className="size-4" />
          </button>
          {viewMenuOpen && (
            <div className="absolute left-0 top-9 z-30 w-[min(390px,calc(100vw-32px))] rounded-xl border border-zinc-200 bg-white p-3 shadow-[0_12px_32px_rgba(0,0,0,0.16)]">
              <p className="mb-2 px-1 text-xs font-medium text-zinc-500">Añade una nueva vista</p>
              <div className="grid grid-cols-2 gap-1 sm:grid-cols-3">
              {DATABASE_VIEW_TYPES.map((viewType) => (
                <button
                  className="flex min-h-20 flex-col items-center justify-center gap-2 rounded-lg px-3 text-center text-xs text-zinc-700 hover:bg-zinc-100"
                  key={viewType.value}
                  onClick={async () => {
                    const view = await createView(viewType.value);
                    if (view) selectView(view.id);
                    setViewMenuOpen(false);
                  }}
                  type="button"
                >
                  <span className="grid size-8 place-items-center rounded-lg bg-zinc-100 text-zinc-700"><ViewTypeIcon type={viewType.value} /></span>
                  {viewType.label}
                </button>
              ))}
              </div>
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

      <div className="px-4 sm:px-10">
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
          members={members}
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
          members={members}
          database={database}
          onCreateProperty={createColumn}
          onCreateRow={onCreateRow}
          onDeleteProperty={deleteProperty}
          onDuplicateProperty={duplicateProperty}
          onFilterProperty={filterByProperty}
          onGroupProperty={(property) =>
            void updateView(activeView.id, { group_by: property.id })
          }
          onHideProperty={(property) => {
            const ids = visiblePropertyIds().filter((id) => id !== property.id);
            return updateView(activeView.id, {
              visible_properties: ids.length ? ids : ["__none"],
            });
          }}
          onInsertProperty={insertProperty}
          onOpenRow={(rowId) => setPeekRowId(rowId)}
          onResolveFileUrl={onResolveFileUrl}
          onUploadFile={onUploadFile}
          onResizeColumn={(propertyId, width) =>
            setColumnWidths((current) => ({ ...current, [propertyId]: width }))
          }
          onSortProperty={sortByProperty}
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
      </div>

      {peekRow && (
        <RowPeek
          currentUser={currentUser}
          members={members}
          onClose={() => setPeekRowId(null)}
          onOpenFull={() => onOpenRow(peekRow.id)}
          onResolveFileUrl={onResolveFileUrl}
          onUpdatePage={onUpdatePage}
          onUpdateProperty={updateProperty}
          onUploadFile={onUploadFile}
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
  members: WorkspaceMember[];
  database: WorkspacePage;
  onCreateProperty: (
    name: string,
    type: DatabasePropertyType,
  ) => Promise<DatabaseProperty | null>;
  onCreateRow: () => Promise<WorkspacePage | null>;
  onDeleteProperty: (propertyId: string) => Promise<boolean>;
  onDuplicateProperty: (property: DatabaseProperty) => Promise<void>;
  onFilterProperty: (property: DatabaseProperty) => void;
  onGroupProperty: (property: DatabaseProperty) => void;
  onHideProperty: (property: DatabaseProperty) => Promise<boolean>;
  onInsertProperty: (
    property: DatabaseProperty,
    direction: "left" | "right",
  ) => Promise<DatabaseProperty | null>;
  onOpenRow: (rowId: string) => void;
  onResolveFileUrl: (path: string) => Promise<string>;
  onResizeColumn: (propertyId: string, width: number) => void;
  onSortProperty: (property: DatabaseProperty, direction: "asc" | "desc") => void;
  onToggleRow: (rowId: string) => void;
  onUploadFile: (rowId: string, file: File) => Promise<string>;
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
  members,
  database,
  onCreateProperty,
  onCreateRow,
  onDeleteProperty,
  onDuplicateProperty,
  onFilterProperty,
  onGroupProperty,
  onHideProperty,
  onInsertProperty,
  onOpenRow,
  onResolveFileUrl,
  onResizeColumn,
  onSortProperty,
  onToggleRow,
  onUpdatePage,
  onUpdateProperty,
  onUpdateView,
  onUploadFile,
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
  const groups = groupRows(rows, view.group_by, properties, currentUser, members, pages);
  return (
    <div className="mt-3 overflow-x-auto rounded-md border bg-white">
      <table className="w-max min-w-full border-collapse text-sm font-normal">
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
                    onDuplicate={onDuplicateProperty}
                    onFilter={onFilterProperty}
                    onGroup={onGroupProperty}
                    onHide={onHideProperty}
                    onInsert={onInsertProperty}
                    onSort={onSortProperty}
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
                    onUpdateIcon={(icon) => onUpdatePage(row.id, { icon })}
                    row={row}
                  />
                </td>
                {visibleProperties.map((property) => (
                  <td className="border-b border-r p-0" key={property.id}>
                    <DatabaseCell
                      currentUser={currentUser}
                      members={members}
                      onCommit={(value) => updateCell(row, property.id, value)}
                      onResolveFileUrl={onResolveFileUrl}
                      onUpdateProperty={onUpdateProperty}
                      onUploadFile={(file) => onUploadFile(row.id, file)}
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
        <tfoot>
          <tr className="h-9 border-t bg-zinc-50/60 text-xs text-zinc-500">
            <td className="border-r px-3" />
            <td className="border-r px-2 text-zinc-400">{rows.length} filas</td>
            {visibleProperties.map((property) => (
              <td className="border-r p-0" key={property.id}>
                <ColumnCalculationCell
                  calc={view.filters.calculations?.[property.id] ?? "none"}
                  onChange={(calc) =>
                    void onUpdateView({
                      filters: {
                        ...view.filters,
                        calculations: { ...view.filters.calculations, [property.id]: calc },
                      },
                    })
                  }
                  property={property}
                  rows={rows}
                />
              </td>
            ))}
            <td />
          </tr>
        </tfoot>
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
  onDuplicate,
  onFilter,
  onGroup,
  onHide,
  onInsert,
  onSort,
  onUpdate,
  property,
}: {
  onDelete: (propertyId: string) => Promise<boolean>;
  onDuplicate: (property: DatabaseProperty) => Promise<void>;
  onFilter: (property: DatabaseProperty) => void;
  onGroup: (property: DatabaseProperty) => void;
  onHide: (property: DatabaseProperty) => Promise<boolean>;
  onInsert: (
    property: DatabaseProperty,
    direction: "left" | "right",
  ) => Promise<DatabaseProperty | null>;
  onSort: (property: DatabaseProperty, direction: "asc" | "desc") => void;
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
              Tipo
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
              <div className="mt-2 block px-2 py-1 text-xs font-medium text-zinc-500">
                Opciones
                <OptionListEditor
                  onChange={(options) =>
                    void onUpdate(property.id, {
                      config: { ...property.config, options },
                    })
                  }
                  options={property.config.options ?? []}
                />
              </div>
            )}
          </div>

          <div className="border-t border-zinc-100 p-1.5">
            <button
              className="flex h-9 w-full items-center gap-2 rounded-md px-2 text-sm text-zinc-700 hover:bg-zinc-100"
              onClick={() => {
                onFilter(property);
                setIsOpen(false);
              }}
              type="button"
            >
              <Filter className="size-4 text-zinc-500" /> Filtrar por esta propiedad
            </button>
            <button
              className="flex h-9 w-full items-center gap-2 rounded-md px-2 text-sm text-zinc-700 hover:bg-zinc-100"
              onClick={() => {
                onSort(property, "asc");
                setIsOpen(false);
              }}
              type="button"
            >
              <SortAsc className="size-4 text-zinc-500" /> Ordenar ascendente
            </button>
            <button
              className="flex h-9 w-full items-center gap-2 rounded-md px-2 text-sm text-zinc-700 hover:bg-zinc-100"
              onClick={() => {
                onSort(property, "desc");
                setIsOpen(false);
              }}
              type="button"
            >
              <SortDesc className="size-4 text-zinc-500" /> Ordenar descendente
            </button>
            <button
              className="flex h-9 w-full items-center gap-2 rounded-md px-2 text-sm text-zinc-700 hover:bg-zinc-100"
              onClick={() => {
                onGroup(property);
                setIsOpen(false);
              }}
              type="button"
            >
              <Group className="size-4 text-zinc-500" /> Agrupar por esta propiedad
            </button>
          </div>

          <div className="border-t border-zinc-100 p-1.5">
            <button
              className="flex h-9 w-full items-center gap-2 rounded-md px-2 text-sm text-zinc-700 hover:bg-zinc-100"
              onClick={async () => {
                await onInsert(property, "left");
                setIsOpen(false);
              }}
              type="button"
            >
              <ArrowUp className="size-4 -rotate-90 text-zinc-500" /> Insertar a la izquierda
            </button>
            <button
              className="flex h-9 w-full items-center gap-2 rounded-md px-2 text-sm text-zinc-700 hover:bg-zinc-100"
              onClick={async () => {
                await onInsert(property, "right");
                setIsOpen(false);
              }}
              type="button"
            >
              <ArrowDown className="size-4 -rotate-90 text-zinc-500" /> Insertar a la derecha
            </button>
            <button
              className="flex h-9 w-full items-center gap-2 rounded-md px-2 text-sm text-zinc-700 hover:bg-zinc-100"
              onClick={async () => {
                await onDuplicate(property);
                setIsOpen(false);
              }}
              type="button"
            >
              <Copy className="size-4 text-zinc-500" /> Duplicar propiedad
            </button>
            <button
              className="flex h-9 w-full items-center gap-2 rounded-md px-2 text-sm text-zinc-700 hover:bg-zinc-100"
              onClick={async () => {
                if (await onHide(property)) setIsOpen(false);
              }}
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
          </div>
        </div>
      )}
    </>
  );
}

function ListView({
  currentUser,
  members,
  onCreateRow,
  onOpenRow,
  pages,
  properties,
  rows,
  view,
  visibleProperties,
}: ViewSurfaceProps) {
  const groups = groupRows(rows, view.group_by, properties, currentUser, members, pages);
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
              <span className="text-lg"><PageIcon icon={row.icon} /></span>
              <span className="min-w-0 flex-1 truncate text-sm font-medium">{row.title}</span>
              {visibleProperties.slice(0, 4).map((property) => (
                <span className="max-w-40 truncate text-xs text-zinc-500" key={property.id}>
                  {propertyDisplayValue(row, property, currentUser, members, pages)}
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
  members,
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
  const groups = boardGroups(groupProperty, currentUser, members);

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
            members={members}
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
  members,
  group,
  onOpenRow,
  pages,
  properties,
  rows,
}: {
  currentUser: { id: string; label: string };
  members: WorkspaceMember[];
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
            members={members}
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
  members,
  onOpen,
  pages,
  properties,
  row,
}: {
  currentUser: { id: string; label: string };
  members: WorkspaceMember[];
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
        <PageIcon icon={row.icon} /> {row.title}
      </button>
      <div className="mt-2 space-y-1">
        {properties.slice(0, 3).map((property) => (
          <div className="truncate text-xs text-zinc-500" key={property.id}>
            <span className="mr-1 text-zinc-400">{property.name}:</span>
            {propertyDisplayValue(row, property, currentUser, members, pages)}
          </div>
        ))}
      </div>
    </article>
  );
}

function CalendarView({
  currentUser,
  members,
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
              members={members}
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
  members: WorkspaceMember[];
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
      <PageIcon icon={row.icon} /> {row.title}
    </button>
  );
}

function GalleryView({
  currentUser,
  members,
  onCreateRow,
  onOpenRow,
  onResolveFileUrl,
  pages,
  properties,
  rows,
  view,
  visibleProperties,
}: ViewSurfaceProps) {
  const groups = groupRows(rows, view.group_by, properties, currentUser, members, pages);
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
                  <div className="truncate text-sm font-semibold"><PageIcon icon={row.icon} /> {row.title}</div>
                  <div className="mt-2 space-y-1">
                    {visibleProperties.slice(0, 4).map((property) => (
                      <div className="flex gap-2 text-xs" key={property.id}>
                        <span className="shrink-0 text-zinc-400">{property.name}</span>
                        <span className="min-w-0 truncate text-zinc-600">
                          {propertyDisplayValue(row, property, currentUser, members, pages)}
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
  members,
  onDelete,
  onUpdate,
  pages,
  properties,
  view,
}: {
  currentUser: { id: string; label: string };
  members: WorkspaceMember[];
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
                    members={members}
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
  members,
  onChange,
  operator,
  pages,
  property,
  value,
}: {
  currentUser: { id: string; label: string };
  members: WorkspaceMember[];
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
    const roster = members.length
      ? members
      : [{ full_name: currentUser.label, user_id: currentUser.id }];
    return (
      <select className="h-8 min-w-0 rounded border bg-white px-1" onChange={(event) => onChange(event.target.value)} value={typeof value === "string" ? value : ""}>
        <option value="">Elegir…</option>
        {roster.map((member) => <option key={member.user_id} value={member.user_id}>{member.full_name || "Sin nombre"}</option>)}
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
      <Plus className="size-4" /> Nueva página
    </button>
  );
}

function ViewTab({
  active,
  isMenuOpen,
  onCopyLink,
  onCopySourceLink,
  onDelete,
  onDuplicate,
  onEdit,
  onMenuToggle,
  onSelect,
  onUpdate,
  sourceName,
  view,
}: {
  active: boolean;
  isMenuOpen: boolean;
  onCopyLink: () => Promise<void>;
  onCopySourceLink: () => Promise<void>;
  onDelete: () => Promise<void>;
  onDuplicate: () => void;
  onEdit: () => void;
  onMenuToggle: () => void;
  onSelect: () => void;
  onUpdate: (
    changes: Partial<Pick<DatabaseView, "name" | "type" | "group_by">>,
  ) => Promise<boolean>;
  sourceName: string;
  view: DatabaseView;
}) {
  const menuRef = useRef<HTMLDivElement>(null);
  const renameRef = useRef<HTMLInputElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [originOpen, setOriginOpen] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [typeOpen, setTypeOpen] = useState(false);

  useEffect(() => {
    if (!isMenuOpen) {
      setOriginOpen(false);
      setRenameOpen(false);
      setTypeOpen(false);
    }
  }, [isMenuOpen]);

  useEffect(() => {
    if (renameOpen) renameRef.current?.focus();
  }, [renameOpen]);

  useEffect(() => {
    if (!isMenuOpen) return;
    function closeOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (!menuRef.current?.contains(target) && !triggerRef.current?.contains(target)) {
        onMenuToggle();
      }
    }
    window.addEventListener("mousedown", closeOutside);
    return () => window.removeEventListener("mousedown", closeOutside);
  }, [isMenuOpen, onMenuToggle]);

  return (
    <div
      className="group relative flex h-10 items-stretch"
      onContextMenu={(event) => {
        event.preventDefault();
        if (!isMenuOpen) onMenuToggle();
      }}
      title="Clic derecho para ver las opciones de la vista"
    >
      <button
        className={`flex items-center gap-2 border-b-2 pl-3 text-xs font-medium transition-colors ${
          active
            ? "border-zinc-900 text-zinc-900"
            : "border-transparent text-zinc-500 hover:text-zinc-800"
        } pr-1`}
        onClick={onSelect}
        type="button"
      >
        <ViewTypeIcon type={view.type} /> {view.name}
      </button>
      <button
        aria-expanded={isMenuOpen}
        aria-label={`Opciones de ${view.name}`}
        className={`border-b-2 pr-2 text-zinc-400 hover:text-zinc-800 ${
          active ? "border-zinc-900" : "border-transparent"
        } ${active || isMenuOpen ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}
        onClick={onMenuToggle}
        ref={triggerRef}
        type="button"
      >
        <ChevronDown className="size-3.5" />
      </button>
      {isMenuOpen && (
        <div
          className="absolute left-0 top-10 z-40 w-[min(290px,calc(100vw-24px))] rounded-xl border border-zinc-200 bg-white p-1.5 text-sm font-normal shadow-[0_12px_32px_rgba(0,0,0,0.16)]"
          ref={menuRef}
        >
          {renameOpen ? (
            <label className="mb-1 flex h-10 items-center gap-2 rounded-lg bg-zinc-50 px-2 ring-2 ring-indigo-100">
              <Pencil className="size-4 text-zinc-400" />
              <input
                aria-label="Renombrar vista"
                className="min-w-0 flex-1 bg-transparent outline-none"
                defaultValue={view.name}
                key={view.name}
                onBlur={(event) => {
                  const name = event.target.value.trim() || "Vista";
                  if (name !== view.name) void onUpdate({ name });
                  setRenameOpen(false);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter") event.currentTarget.blur();
                }}
                ref={renameRef}
              />
            </label>
          ) : (
            <button
              className="flex h-9 w-full items-center gap-2 rounded-md px-2 text-left text-zinc-700 hover:bg-zinc-100"
              onClick={() => setRenameOpen(true)}
              type="button"
            >
              <Pencil className="size-4 text-zinc-500" /> Renombrar
            </button>
          )}

          <button
            className="flex h-9 w-full items-center gap-2 rounded-md px-2 text-left text-zinc-700 hover:bg-zinc-100"
            onClick={() => setTypeOpen((open) => !open)}
            type="button"
          >
            <ViewTypeIcon type={view.type} /> Mostrar como
            <ChevronRight className={`ml-auto size-4 text-zinc-400 transition-transform ${typeOpen ? "rotate-90" : ""}`} />
          </button>
          {typeOpen && (
            <div className="mb-1 grid grid-cols-3 gap-1 rounded-lg bg-zinc-50 p-1">
              {DATABASE_VIEW_TYPES.map((type) => (
                <button
                  className={`flex flex-col items-center gap-1.5 rounded-lg px-2 py-2 text-xs hover:bg-white ${
                    view.type === type.value ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-600"
                  }`}
                  key={type.value}
                  onClick={() => {
                    void onUpdate({ group_by: null, type: type.value });
                    setTypeOpen(false);
                  }}
                  type="button"
                >
                  <ViewTypeIcon type={type.value} /> {type.label}
                </button>
              ))}
            </div>
          )}

          <button
            className="flex h-9 w-full items-center gap-2 rounded-md px-2 text-left text-zinc-700 hover:bg-zinc-100"
            onClick={onEdit}
            type="button"
          >
            <SlidersHorizontal className="size-4 text-zinc-500" /> Editar vista
          </button>
          <button
            className="flex h-9 w-full items-center gap-2 rounded-md px-2 text-left text-zinc-700 hover:bg-zinc-100"
            onClick={() => setOriginOpen((open) => !open)}
            type="button"
          >
            <Group className="size-4 text-zinc-500" /> Origen
            <span className="ml-auto max-w-28 truncate text-xs text-zinc-400">{sourceName}</span>
            <ChevronRight className={`size-4 shrink-0 text-zinc-400 transition-transform ${originOpen ? "rotate-90" : ""}`} />
          </button>
          {originOpen && (
            <div className="mb-1 rounded-lg bg-zinc-50 p-1">
              <p className="truncate px-2 py-1.5 text-xs font-medium text-zinc-600">{sourceName}</p>
              <button
                className="flex h-8 w-full items-center gap-2 rounded-md px-2 text-left text-xs text-zinc-600 hover:bg-white"
                onClick={() => void onCopySourceLink()}
                type="button"
              >
                <Copy className="size-3.5" /> Copiar enlace del origen
              </button>
            </div>
          )}

          <div className="border-t border-zinc-100 pt-1.5">
            <button
              className="flex h-9 w-full items-center gap-2 rounded-md px-2 text-left text-zinc-700 hover:bg-zinc-100"
              onClick={() => void onCopyLink()}
              type="button"
            >
              <Copy className="size-4 text-zinc-500" /> Copiar enlace de la vista
            </button>
            <button
              className="flex h-9 w-full items-center gap-2 rounded-md px-2 text-left text-zinc-700 hover:bg-zinc-100"
              onClick={onDuplicate}
              type="button"
            >
              <Copy className="size-4 text-zinc-500" /> Duplicar vista
            </button>
            <button
              className="flex h-9 w-full items-center gap-2 rounded-md px-2 text-left text-red-600 hover:bg-red-50"
              onClick={() => {
                if (window.confirm(`¿Eliminar la vista “${view.name}”?`)) void onDelete();
              }}
              type="button"
            >
              <Trash2 className="size-4" /> Eliminar vista
            </button>
          </div>
          {view.type === "calendar" && (
            <button
              className="mt-1 flex h-9 w-full items-center gap-2 border-t border-zinc-100 px-2 pt-1 text-left text-zinc-700 hover:bg-zinc-100"
              onClick={onEdit}
              type="button"
            >
              <CalendarDays className="size-4 text-zinc-500" /> Configurar calendario
            </button>
          )}
        </div>
      )}
    </div>
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
        <div className="mt-2 pl-8 text-xs text-zinc-500">
          Opciones
          <OptionListEditor
            onChange={(options) =>
              void onUpdate(property.id, {
                config: { ...property.config, options },
              })
            }
            options={property.config.options ?? []}
          />
        </div>
      )}
    </div>
  );
}

function RowTitleCell({
  onOpen,
  onUpdate,
  onUpdateIcon,
  row,
}: {
  onOpen: () => void;
  onUpdate: (value: string) => Promise<boolean>;
  onUpdateIcon: (icon: string | null) => void;
  row: WorkspacePage;
}) {
  const [value, setValue] = useState(row.title);
  useEffect(() => setValue(row.title), [row.title]);

  return (
    <div className="flex h-10 items-center gap-1 px-2">
      <IconPicker icon={row.icon} onChange={onUpdateIcon} size="sm" />
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
  members,
  onCommit,
  onResolveFileUrl,
  onUpdateProperty,
  onUploadFile,
  pages,
  property,
  row,
  value,
}: {
  currentUser: { id: string; label: string };
  members: WorkspaceMember[];
  onCommit: (value: unknown) => Promise<boolean>;
  onResolveFileUrl: (path: string) => Promise<string>;
  onUpdateProperty: (
    propertyId: string,
    changes: Partial<Pick<DatabaseProperty, "config" | "name" | "position" | "type">>,
  ) => Promise<boolean>;
  onUploadFile: (file: File) => Promise<string>;
  pages: WorkspacePage[];
  property: DatabaseProperty;
  row: WorkspacePage;
  value: unknown;
}) {
  function createOption(label: string): string {
    const usedColors = new Set((property.config.options ?? []).map((option) => option.color));
    const color =
      OPTION_COLORS.find((item) => !usedColors.has(item)) ??
      OPTION_COLORS[(property.config.options?.length ?? 0) % OPTION_COLORS.length];
    const option: DatabaseOption = { color, id: crypto.randomUUID(), label };
    void onUpdateProperty(property.id, {
      config: { ...property.config, options: [...(property.config.options ?? []), option] },
    });
    return option.id;
  }

  if (property.type === "created_time" || property.type === "last_edited_time") {
    const date = property.type === "created_time" ? row.created_at : row.updated_at;
    return <div className="px-3 py-2 text-xs text-zinc-500">{formatDateTime(date)}</div>;
  }

  if (property.type === "created_by" || property.type === "last_edited_by") {
    const userId = property.type === "created_by" ? row.created_by : row.updated_by;
    const name =
      userId === currentUser.id
        ? currentUser.label
        : (members.find((member) => member.user_id === userId)?.full_name ?? "—");
    return (
      <div className="flex items-center gap-1.5 px-3 py-2 text-xs text-zinc-500">
        <span className="grid size-4 shrink-0 place-items-center rounded-full bg-zinc-100 text-[9px] font-semibold text-zinc-600">
          {name.slice(0, 1).toUpperCase()}
        </span>
        {name}
      </div>
    );
  }

  if (property.type === "files") {
    return (
      <FilesCell
        onCommit={onCommit}
        onResolveFileUrl={onResolveFileUrl}
        onUploadFile={onUploadFile}
        value={value}
      />
    );
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
      <OptionPickerCell
        multiple={false}
        onCommit={onCommit}
        onCreateOption={createOption}
        options={property.config.options ?? []}
        value={value}
      />
    );
  }

  if (property.type === "multi_select") {
    return (
      <OptionPickerCell
        multiple
        onCommit={onCommit}
        onCreateOption={createOption}
        options={property.config.options ?? []}
        value={value}
      />
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
    const roster = members.length
      ? members
      : [{ avatar_url: null, full_name: currentUser.label, role: "owner" as const, user_id: currentUser.id }];
    return <PersonPickerCell members={roster} onCommit={onCommit} value={value} />;
  }

  if (property.type === "relation") {
    return (
      <RelationPickerCell
        currentRowId={row.id}
        onCommit={onCommit}
        pages={pages}
        value={value}
      />
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

function FilesCell({
  onCommit,
  onResolveFileUrl,
  onUploadFile,
  value,
}: {
  onCommit: (value: unknown) => Promise<boolean>;
  onResolveFileUrl: (path: string) => Promise<string>;
  onUploadFile: (file: File) => Promise<string>;
  value: unknown;
}) {
  const paths = Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function addFiles(fileList: FileList | null) {
    if (!fileList?.length) return;
    setUploading(true);
    try {
      const uploaded: string[] = [];
      for (const file of Array.from(fileList)) {
        uploaded.push(await onUploadFile(file));
      }
      await onCommit([...paths, ...uploaded]);
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function removeFile(path: string) {
    void onCommit(paths.filter((item) => item !== path));
  }

  return (
    <div className="flex min-h-10 flex-wrap items-center gap-1 px-2 py-1">
      {paths.map((path) => (
        <FileChip key={path} onRemove={() => removeFile(path)} path={path} resolveFileUrl={onResolveFileUrl} />
      ))}
      <button
        aria-label="Adjuntar archivo"
        className="grid size-6 shrink-0 place-items-center rounded text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
        disabled={uploading}
        onClick={() => inputRef.current?.click()}
        type="button"
      >
        {uploading ? <LoaderCircle className="size-3.5 animate-spin" /> : <Plus className="size-3.5" />}
      </button>
      <input
        className="hidden"
        multiple
        onChange={(event) => void addFiles(event.target.files)}
        ref={inputRef}
        type="file"
      />
    </div>
  );
}

function FileChip({
  onRemove,
  path,
  resolveFileUrl,
}: {
  onRemove: () => void;
  path: string;
  resolveFileUrl: (path: string) => Promise<string>;
}) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    void resolveFileUrl(path)
      .then((next) => {
        if (active) setUrl(next);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [path, resolveFileUrl]);
  const name = fileNameFromPath(path);

  return (
    <span className="inline-flex max-w-[160px] items-center gap-1 rounded-md bg-zinc-100 px-1.5 py-0.5 text-[11px] font-medium text-zinc-700">
      <a
        className="truncate hover:underline"
        href={url ?? "#"}
        onClick={(event) => {
          if (!url) event.preventDefault();
        }}
        rel="noreferrer"
        target="_blank"
        title={name}
      >
        {name}
      </a>
      <button
        aria-label="Quitar archivo"
        className="shrink-0 text-zinc-400 hover:text-red-500"
        onClick={onRemove}
        type="button"
      >
        <X className="size-3" />
      </button>
    </span>
  );
}

function fileNameFromPath(path: string) {
  const base = path.split("/").pop() ?? path;
  return decodeURIComponent(base.replace(/^[0-9a-f-]{36}-/i, ""));
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
  const externalHref = resolveExternalHref(type, draft);

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
      {externalHref && (
        <a
          aria-label="Abrir enlace"
          className="ml-1 grid size-6 shrink-0 place-items-center rounded text-zinc-400 hover:bg-zinc-100 hover:text-indigo-600"
          href={externalHref}
          onClick={(event) => event.stopPropagation()}
          onMouseDown={(event) => event.preventDefault()}
          rel="noreferrer"
          target="_blank"
        >
          <ExternalLink className="size-3.5" />
        </a>
      )}
    </div>
  );
}

function resolveExternalHref(type: DatabasePropertyType, text: string): string | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  if (type === "url") {
    return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  }
  if (/^(https?:\/\/|www\.)\S+\.\S{2,}$/i.test(trimmed)) {
    return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  }
  return null;
}

const BASE_CALCULATIONS = [
  { label: "Calcular", value: "none" },
  { label: "Total", value: "count_all" },
  { label: "Con valor", value: "count_values" },
  { label: "Vacías", value: "count_empty" },
  { label: "% vacías", value: "percent_empty" },
  { label: "% con valor", value: "percent_not_empty" },
];
const NUMBER_CALCULATIONS = [
  { label: "Suma", value: "sum" },
  { label: "Promedio", value: "average" },
  { label: "Mínimo", value: "min" },
  { label: "Máximo", value: "max" },
];
const CHECKBOX_CALCULATIONS = [
  { label: "Marcadas", value: "count_checked" },
  { label: "% marcadas", value: "percent_checked" },
];

function calculationsForType(type: DatabasePropertyType) {
  if (type === "number") return [...BASE_CALCULATIONS, ...NUMBER_CALCULATIONS];
  if (type === "checkbox") return [...BASE_CALCULATIONS, ...CHECKBOX_CALCULATIONS];
  return BASE_CALCULATIONS;
}

function formatCalcNumber(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

function computeCalculation(
  calc: string,
  property: DatabaseProperty,
  rows: WorkspacePage[],
): string {
  const values = rows.map((row) => row.properties[property.id]);
  const total = values.length;
  const nonEmpty = values.filter((value) => !isEmptyValue(value));

  switch (calc) {
    case "count_all":
      return String(total);
    case "count_values":
      return String(nonEmpty.length);
    case "count_empty":
      return String(total - nonEmpty.length);
    case "percent_empty":
      return total ? `${Math.round(((total - nonEmpty.length) / total) * 100)}%` : "0%";
    case "percent_not_empty":
      return total ? `${Math.round((nonEmpty.length / total) * 100)}%` : "0%";
    case "sum":
      return formatCalcNumber(nonEmpty.reduce<number>((acc, value) => acc + Number(value), 0));
    case "average":
      return nonEmpty.length
        ? formatCalcNumber(
            nonEmpty.reduce<number>((acc, value) => acc + Number(value), 0) / nonEmpty.length,
          )
        : "0";
    case "min":
      return nonEmpty.length ? formatCalcNumber(Math.min(...nonEmpty.map(Number))) : "—";
    case "max":
      return nonEmpty.length ? formatCalcNumber(Math.max(...nonEmpty.map(Number))) : "—";
    case "count_checked":
      return String(values.filter(Boolean).length);
    case "percent_checked":
      return total ? `${Math.round((values.filter(Boolean).length / total) * 100)}%` : "0%";
    default:
      return "";
  }
}

function ColumnCalculationCell({
  calc,
  onChange,
  property,
  rows,
}: {
  calc: string;
  onChange: (calc: string) => void;
  property: DatabaseProperty;
  rows: WorkspacePage[];
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const options = calculationsForType(property.type);

  useEffect(() => {
    if (!open) return;
    function onOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onOutside);
    return () => document.removeEventListener("mousedown", onOutside);
  }, [open]);

  const result = calc !== "none" ? computeCalculation(calc, property, rows) : null;

  return (
    <div className="relative" ref={containerRef}>
      <button
        className="flex h-9 w-full items-center justify-end px-2 text-right text-xs text-zinc-500 hover:bg-zinc-100"
        onClick={() => setOpen((current) => !current)}
        type="button"
      >
        {result ?? <span className="text-zinc-300">Calcular</span>}
      </button>
      {open && (
        <div className="absolute bottom-full right-0 z-30 mb-1 w-40 rounded-lg border bg-white p-1 shadow-xl">
          {options.map((option) => (
            <button
              className={`flex h-8 w-full items-center rounded-md px-2 text-left text-xs hover:bg-zinc-100 ${
                calc === option.value ? "font-medium text-indigo-600" : "text-zinc-700"
              }`}
              key={option.value}
              onClick={() => {
                onChange(option.value);
                setOpen(false);
              }}
              type="button"
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function PickerCell({
  chip,
  emptyLabel = "Vacío",
  itemLeading,
  items,
  multiple = false,
  onChange,
  onCreate,
  selectedIds,
}: {
  chip: (id: string) => ReactNode;
  emptyLabel?: string;
  itemLeading?: (id: string) => ReactNode;
  items: { id: string; label: string }[];
  multiple?: boolean;
  onChange: (nextIds: string[]) => void;
  onCreate?: (label: string) => string;
  selectedIds: string[];
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onOutside);
    return () => document.removeEventListener("mousedown", onOutside);
  }, [open]);

  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  const normalizedQuery = query.trim().toLocaleLowerCase("es");
  const filtered = normalizedQuery
    ? items.filter((item) => item.label.toLocaleLowerCase("es").includes(normalizedQuery))
    : items;
  const exactMatch = items.some(
    (item) => item.label.toLocaleLowerCase("es") === normalizedQuery,
  );
  const selected = items.filter((item) => selectedIds.includes(item.id));

  function toggle(id: string) {
    if (multiple) {
      onChange(
        selectedIds.includes(id)
          ? selectedIds.filter((existing) => existing !== id)
          : [...selectedIds, id],
      );
    } else {
      onChange(selectedIds.includes(id) ? [] : [id]);
      setOpen(false);
    }
  }

  function createFromQuery() {
    if (!onCreate || !query.trim()) return;
    const id = onCreate(query.trim());
    if (multiple) onChange([...selectedIds, id]);
    else {
      onChange([id]);
      setOpen(false);
    }
    setQuery("");
  }

  return (
    <div className="relative h-10 w-full" ref={containerRef}>
      <button
        aria-expanded={open}
        className="flex h-10 w-full flex-wrap items-center gap-1 px-2 text-left"
        onClick={() => setOpen((current) => !current)}
        type="button"
      >
        {selected.length ? (
          selected.map((item) => <span key={item.id}>{chip(item.id)}</span>)
        ) : (
          <span className="text-xs text-zinc-400">{emptyLabel}</span>
        )}
      </button>
      {open && (
        <div
          className="absolute left-0 top-full z-30 mt-1 w-64 rounded-xl border bg-white p-2 shadow-xl"
          onClick={(event) => event.stopPropagation()}
        >
          <input
            autoFocus
            className="mb-2 w-full rounded-md border px-2 py-1 text-xs outline-none focus:border-indigo-400"
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && onCreate && query.trim() && !exactMatch) {
                createFromQuery();
              }
            }}
            placeholder="Buscar…"
            value={query}
          />
          <div className="max-h-56 space-y-0.5 overflow-y-auto">
            {filtered.map((item) => (
              <button
                className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs hover:bg-zinc-100 ${
                  selectedIds.includes(item.id) ? "bg-zinc-50" : ""
                }`}
                key={item.id}
                onClick={() => toggle(item.id)}
                type="button"
              >
                {multiple && (
                  <span
                    className={`grid size-3.5 shrink-0 place-items-center rounded-sm border ${
                      selectedIds.includes(item.id)
                        ? "border-indigo-500 bg-indigo-500 text-white"
                        : "border-zinc-300"
                    }`}
                  >
                    {selectedIds.includes(item.id) && <Check className="size-2.5" />}
                  </span>
                )}
                {itemLeading?.(item.id)}
                <span className="min-w-0 flex-1 truncate">{item.label}</span>
              </button>
            ))}
            {filtered.length === 0 && !query && (
              <p className="px-2 py-3 text-center text-xs text-zinc-400">Sin opciones</p>
            )}
            {onCreate && query.trim() && !exactMatch && (
              <button
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs text-indigo-600 hover:bg-indigo-50"
                onClick={createFromQuery}
                type="button"
              >
                <Plus className="size-3.5" /> Crear &ldquo;{query.trim()}&rdquo;
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function OptionPickerCell({
  multiple,
  onCommit,
  onCreateOption,
  options,
  value,
}: {
  multiple: boolean;
  onCommit: (value: unknown) => Promise<boolean>;
  onCreateOption: (label: string) => string;
  options: DatabaseOption[];
  value: unknown;
}) {
  const selectedIds = multiple
    ? Array.isArray(value)
      ? value.filter((item): item is string => typeof item === "string")
      : []
    : typeof value === "string" && value
      ? [value]
      : [];

  return (
    <PickerCell
      chip={(id) => {
        const option = options.find((item) => item.id === id);
        if (!option) return null;
        return (
          <span
            className={`rounded-md px-1.5 py-0.5 text-[11px] font-medium ${
              OPTION_COLOR_STYLES[option.color] ?? OPTION_COLOR_STYLES.gray
            }`}
          >
            {option.label}
          </span>
        );
      }}
      items={options.map((option) => ({ id: option.id, label: option.label }))}
      multiple={multiple}
      onChange={(ids) => void onCommit(multiple ? ids : (ids[0] ?? null))}
      onCreate={onCreateOption}
      selectedIds={selectedIds}
    />
  );
}

function PersonPickerCell({
  members,
  onCommit,
  value,
}: {
  members: WorkspaceMember[];
  onCommit: (value: unknown) => Promise<boolean>;
  value: unknown;
}) {
  const selectedIds = typeof value === "string" && value ? [value] : [];

  return (
    <PickerCell
      chip={(id) => {
        const member = members.find((item) => item.user_id === id);
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-1.5 py-0.5 text-[11px] font-medium text-zinc-700">
            <span className="grid size-4 shrink-0 place-items-center rounded-full bg-indigo-100 text-[9px] font-semibold text-indigo-700">
              {(member?.full_name || "?").slice(0, 1).toUpperCase()}
            </span>
            {member?.full_name || "Sin nombre"}
          </span>
        );
      }}
      emptyLabel="Sin asignar"
      items={members.map((member) => ({ id: member.user_id, label: member.full_name || "Sin nombre" }))}
      onChange={(ids) => void onCommit(ids[0] ?? null)}
      selectedIds={selectedIds}
    />
  );
}

function RelationPickerCell({
  currentRowId,
  onCommit,
  pages,
  value,
}: {
  currentRowId: string;
  onCommit: (value: unknown) => Promise<boolean>;
  pages: WorkspacePage[];
  value: unknown;
}) {
  const candidates = pages.filter((page) => !page.is_archived && page.id !== currentRowId);
  const selectedIds = typeof value === "string" && value ? [value] : [];

  return (
    <PickerCell
      chip={(id) => {
        const page = candidates.find((item) => item.id === id);
        return (
          <span className="inline-flex items-center gap-1 rounded-md bg-zinc-100 px-1.5 py-0.5 text-[11px] font-medium text-zinc-700">
            {page?.icon || "📄"} {page?.title ?? "…"}
          </span>
        );
      }}
      emptyLabel="Sin relación"
      items={candidates.map((page) => ({ id: page.id, label: page.title }))}
      onChange={(ids) => void onCommit(ids[0] ?? null)}
      selectedIds={selectedIds}
    />
  );
}

export function RowPropertiesList({
  currentUser,
  members,
  onResolveFileUrl,
  onUpdatePage,
  onUpdateProperty,
  onUploadFile,
  pages,
  properties,
  row,
}: {
  currentUser: { id: string; label: string };
  members: WorkspaceMember[];
  onResolveFileUrl: (path: string) => Promise<string>;
  onUpdatePage: (pageId: string, changes: Partial<WorkspacePage>) => Promise<boolean>;
  onUpdateProperty: (
    propertyId: string,
    changes: Partial<Pick<DatabaseProperty, "config" | "name" | "position" | "type">>,
  ) => Promise<boolean>;
  onUploadFile: (rowId: string, file: File) => Promise<string>;
  pages: WorkspacePage[];
  properties: DatabaseProperty[];
  row: WorkspacePage;
}) {
  return (
    <div className="mb-8 divide-y rounded-xl border">
      {properties.map((property) => (
        <div className="grid grid-cols-[140px_1fr] items-center" key={property.id}>
          <div className="px-3 py-2 text-xs font-medium text-zinc-500">
            {propertyTypeIcon(property.type)} {property.name}
          </div>
          <div className="border-l">
            <DatabaseCell
              currentUser={currentUser}
              members={members}
              onCommit={(value) =>
                onUpdatePage(row.id, {
                  properties: { ...row.properties, [property.id]: value },
                })
              }
              onResolveFileUrl={onResolveFileUrl}
              onUpdateProperty={onUpdateProperty}
              onUploadFile={(file) => onUploadFile(row.id, file)}
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
  );
}

function RowPeek({
  currentUser,
  members,
  onClose,
  onOpenFull,
  onResolveFileUrl,
  onUpdatePage,
  onUpdateProperty,
  onUploadFile,
  pages,
  properties,
  row,
}: {
  currentUser: { id: string; label: string };
  members: WorkspaceMember[];
  onClose: () => void;
  onOpenFull: () => void;
  onResolveFileUrl: (path: string) => Promise<string>;
  onUpdatePage: (pageId: string, changes: Partial<WorkspacePage>) => Promise<boolean>;
  onUpdateProperty: (
    propertyId: string,
    changes: Partial<Pick<DatabaseProperty, "config" | "name" | "position" | "type">>,
  ) => Promise<boolean>;
  onUploadFile: (rowId: string, file: File) => Promise<string>;
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
        <IconPicker
          icon={row.icon}
          onChange={(icon) => void onUpdatePage(row.id, { icon })}
          triggerClassName="text-4xl leading-none transition-transform hover:scale-105"
        />
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
        <RowPropertiesList
          currentUser={currentUser}
          members={members}
          onResolveFileUrl={onResolveFileUrl}
          onUpdatePage={onUpdatePage}
          onUpdateProperty={onUpdateProperty}
          onUploadFile={onUploadFile}
          pages={pages}
          properties={properties}
          row={row}
        />
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

const OPTION_COLOR_STYLES: Record<string, string> = {
  amber: "bg-amber-100 text-amber-800",
  blue: "bg-blue-100 text-blue-700",
  gray: "bg-zinc-200 text-zinc-700",
  green: "bg-green-100 text-green-700",
  pink: "bg-pink-100 text-pink-700",
  red: "bg-red-100 text-red-700",
  violet: "bg-violet-100 text-violet-700",
};

function OptionListEditor({
  onChange,
  options,
}: {
  onChange: (options: DatabaseOption[]) => void;
  options: DatabaseOption[];
}) {
  const [colorMenuId, setColorMenuId] = useState<string | null>(null);

  function updateOption(id: string, changes: Partial<DatabaseOption>) {
    onChange(options.map((option) => (option.id === id ? { ...option, ...changes } : option)));
  }

  function removeOption(id: string) {
    onChange(options.filter((option) => option.id !== id));
  }

  function moveOption(id: string, direction: -1 | 1) {
    const index = options.findIndex((option) => option.id === id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= options.length) return;
    const next = [...options];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  }

  function addOption() {
    const usedColors = new Set(options.map((option) => option.color));
    const color =
      OPTION_COLORS.find((item) => !usedColors.has(item)) ??
      OPTION_COLORS[options.length % OPTION_COLORS.length];
    onChange([...options, { color, id: crypto.randomUUID(), label: "Nueva opción" }]);
  }

  return (
    <div className="mt-1.5 space-y-1">
      {options.map((option, index) => (
        <div className="flex items-center gap-1" key={option.id}>
          <div className="relative">
            <button
              aria-label="Color de la opción"
              className={`grid size-6 shrink-0 place-items-center rounded-md text-[10px] font-semibold ${OPTION_COLOR_STYLES[option.color] ?? OPTION_COLOR_STYLES.gray}`}
              onClick={() => setColorMenuId((current) => (current === option.id ? null : option.id))}
              type="button"
            >
              ●
            </button>
            {colorMenuId === option.id && (
              <div className="absolute left-0 top-7 z-10 grid grid-cols-4 gap-1 rounded-lg border bg-white p-1.5 shadow-lg">
                {OPTION_COLORS.map((color) => (
                  <button
                    aria-label={`Color ${color}`}
                    className={`size-5 rounded-md ${OPTION_COLOR_STYLES[color]} ${option.color === color ? "ring-2 ring-indigo-400" : ""}`}
                    key={color}
                    onClick={() => {
                      updateOption(option.id, { color });
                      setColorMenuId(null);
                    }}
                    type="button"
                  />
                ))}
              </div>
            )}
          </div>
          <input
            aria-label="Nombre de la opción"
            className="h-7 min-w-0 flex-1 rounded-md border bg-white px-2 text-xs outline-none focus:ring-2 focus:ring-indigo-100"
            onChange={(event) => updateOption(option.id, { label: event.target.value })}
            value={option.label}
          />
          <button
            aria-label="Subir opción"
            className="grid size-6 shrink-0 place-items-center rounded hover:bg-zinc-100 disabled:opacity-30"
            disabled={index === 0}
            onClick={() => moveOption(option.id, -1)}
            type="button"
          >
            <ArrowUp className="size-3" />
          </button>
          <button
            aria-label="Bajar opción"
            className="grid size-6 shrink-0 place-items-center rounded hover:bg-zinc-100 disabled:opacity-30"
            disabled={index === options.length - 1}
            onClick={() => moveOption(option.id, 1)}
            type="button"
          >
            <ArrowDown className="size-3" />
          </button>
          <button
            aria-label="Eliminar opción"
            className="grid size-6 shrink-0 place-items-center rounded text-zinc-400 hover:bg-red-50 hover:text-red-500"
            onClick={() => removeOption(option.id)}
            type="button"
          >
            <X className="size-3.5" />
          </button>
        </div>
      ))}
      <button
        className="flex h-7 w-full items-center gap-1.5 rounded-md px-2 text-xs font-medium text-zinc-500 hover:bg-zinc-100"
        onClick={addOption}
        type="button"
      >
        <Plus className="size-3.5" /> Añadir opción
      </button>
    </div>
  );
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
    files: "📎",
    created_by: "◐",
    last_edited_by: "◐",
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
  members: WorkspaceMember[],
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
      ? propertyDisplayValue(groupedRows[0], property, currentUser, members, pages)
      : "Sin valor",
    rows: groupedRows,
  }));
}

function boardGroups(
  property: DatabaseProperty | null,
  currentUser: { id: string; label: string },
  members: WorkspaceMember[],
) {
  const groups = [{ key: "empty", label: "Sin asignar", value: "" }];
  if (!property) return groups;
  if (property.type === "person") {
    for (const member of members.length ? members : [{ full_name: currentUser.label, user_id: currentUser.id }]) {
      groups.push({ key: member.user_id, label: member.full_name || "Sin nombre", value: member.user_id });
    }
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
  members: WorkspaceMember[],
  pages: WorkspacePage[],
) {
  if (property.type === "created_time") return formatDateTime(row.created_at);
  if (property.type === "last_edited_time") return formatDateTime(row.updated_at);
  if (property.type === "created_by" || property.type === "last_edited_by") {
    const userId = property.type === "created_by" ? row.created_by : row.updated_by;
    if (userId === currentUser.id) return currentUser.label;
    return members.find((member) => member.user_id === userId)?.full_name ?? "—";
  }
  const value = row.properties[property.id];
  if (isEmptyValue(value)) return "—";
  if (property.type === "files") {
    return Array.isArray(value) && value.length ? `${value.length} archivo(s)` : "—";
  }
  if (property.type === "checkbox") return value ? "Sí" : "No";
  if (property.type === "date") {
    const start = dateStart(value);
    if (!start) return "—";
    const end = isRecord(value) && typeof value.end === "string" ? value.end : null;
    return end ? `${start} – ${end}` : start;
  }
  if (property.type === "person") {
    if (value === currentUser.id) return currentUser.label;
    return members.find((member) => member.user_id === value)?.full_name ?? "Sin asignar";
  }
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
