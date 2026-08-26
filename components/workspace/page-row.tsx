"use client";

import { CSS } from "@dnd-kit/utilities";
import { useSortable } from "@dnd-kit/sortable";
import {
  ChevronDown,
  ChevronRight,
  FileText,
  GripVertical,
  MoreHorizontal,
  Plus,
} from "lucide-react";

import { cn } from "@/lib/utils";
import type { FlatPage } from "@/lib/page-tree";

export function PageRow({
  expanded,
  onAddChild,
  onMenu,
  onSelect,
  onToggle,
  page,
  selected,
}: {
  expanded: boolean;
  onAddChild: (pageId: string) => void;
  onMenu: (pageId: string, x: number, y: number) => void;
  onSelect: (pageId: string) => void;
  onToggle: (pageId: string) => void;
  page: FlatPage;
  selected: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: page.id });

  return (
    <div
      ref={setNodeRef}
      style={{
        paddingLeft: `${8 + page.depth * 16}px`,
        transform: CSS.Transform.toString(transform),
        transition,
      }}
      className={cn(
        "group mx-1 flex h-8 items-center rounded-md text-sm text-zinc-600",
        selected && "bg-zinc-200/80 text-zinc-950",
        isDragging && "relative z-20 opacity-50",
      )}
      onContextMenu={(event) => {
        event.preventDefault();
        onMenu(page.id, event.clientX, event.clientY);
      }}
    >
      <button
        aria-label={`Arrastrar ${page.title}`}
        className="grid size-5 shrink-0 cursor-grab place-items-center rounded opacity-0 hover:bg-zinc-200 group-hover:opacity-100 active:cursor-grabbing"
        type="button"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="size-3" />
      </button>
      <button
        aria-label={expanded ? "Contraer subpáginas" : "Expandir subpáginas"}
        className="grid size-5 shrink-0 place-items-center rounded hover:bg-zinc-200"
        onClick={() => onToggle(page.id)}
        type="button"
      >
        {page.hasChildren ? (
          expanded ? (
            <ChevronDown className="size-3.5" />
          ) : (
            <ChevronRight className="size-3.5" />
          )
        ) : (
          <span className="size-3.5" />
        )}
      </button>
      <button
        className="flex min-w-0 flex-1 items-center gap-2 py-1 text-left"
        onClick={() => onSelect(page.id)}
        type="button"
      >
        <span className="shrink-0 text-[15px]">
          {page.icon || <FileText className="size-4 text-zinc-400" />}
        </span>
        <span className="truncate">{page.title || "Sin título"}</span>
      </button>
      <div className="mr-1 flex opacity-0 group-hover:opacity-100">
        <button
          aria-label={`Opciones de ${page.title}`}
          className="grid size-6 place-items-center rounded hover:bg-zinc-300/70"
          onClick={(event) => {
            const rect = event.currentTarget.getBoundingClientRect();
            onMenu(page.id, rect.right, rect.bottom + 4);
          }}
          type="button"
        >
          <MoreHorizontal className="size-3.5" />
        </button>
        <button
          aria-label={`Crear subpágina en ${page.title}`}
          className="grid size-6 place-items-center rounded hover:bg-zinc-300/70"
          onClick={() => onAddChild(page.id)}
          type="button"
        >
          <Plus className="size-3.5" />
        </button>
      </div>
    </div>
  );
}
