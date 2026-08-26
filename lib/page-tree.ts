import type { WorkspacePage } from "@/lib/types";

export type FlatPage = WorkspacePage & {
  depth: number;
  hasChildren: boolean;
};

export function sortPages(pages: WorkspacePage[]) {
  return [...pages].sort((a, b) => {
    if (a.position !== b.position) return a.position - b.position;
    return a.created_at.localeCompare(b.created_at);
  });
}

export function flattenPageTree(
  pages: WorkspacePage[],
  expanded: Record<string, boolean>,
) {
  const active = pages.filter(
    (page) => !page.is_archived && page.parent_database_id === null,
  );
  const activeIds = new Set(active.map((page) => page.id));
  const byParent = new Map<string | null, WorkspacePage[]>();

  for (const page of active) {
    const parent =
      page.parent_page_id && activeIds.has(page.parent_page_id)
        ? page.parent_page_id
        : null;
    byParent.set(parent, [...(byParent.get(parent) ?? []), page]);
  }

  const flattened: FlatPage[] = [];
  const visited = new Set<string>();

  function visit(parentId: string | null, depth: number) {
    for (const page of sortPages(byParent.get(parentId) ?? [])) {
      if (visited.has(page.id)) continue;
      visited.add(page.id);
      const children = byParent.get(page.id) ?? [];
      flattened.push({ ...page, depth, hasChildren: children.length > 0 });
      if (expanded[page.id]) visit(page.id, depth + 1);
    }
  }

  visit(null, 0);
  return flattened;
}

export function getPagePath(pages: WorkspacePage[], pageId: string) {
  const byId = new Map(pages.map((page) => [page.id, page]));
  const path: WorkspacePage[] = [];
  const visited = new Set<string>();
  let current = byId.get(pageId);

  while (current && !visited.has(current.id)) {
    visited.add(current.id);
    path.unshift(current);
    const parentId = current.parent_page_id ?? current.parent_database_id;
    current = parentId ? byId.get(parentId) : undefined;
  }

  return path;
}

export function getDescendantIds(pages: WorkspacePage[], pageId: string) {
  const descendants = new Set<string>();
  const queue = [pageId];

  while (queue.length) {
    const parentId = queue.shift();
    if (!parentId || descendants.has(parentId)) continue;
    descendants.add(parentId);
    pages
      .filter(
        (page) =>
          page.parent_page_id === parentId || page.parent_database_id === parentId,
      )
      .forEach((page) => queue.push(page.id));
  }

  return [...descendants];
}

export function isDescendant(
  pages: WorkspacePage[],
  candidateId: string,
  ancestorId: string,
) {
  return getDescendantIds(pages, ancestorId).includes(candidateId);
}

export function getNextPosition(
  pages: WorkspacePage[],
  parentPageId: string | null,
) {
  const siblings = pages.filter(
    (page) =>
      !page.is_archived &&
      page.parent_page_id === parentPageId &&
      page.parent_database_id === null,
  );
  return siblings.length
    ? Math.max(...siblings.map((page) => Number(page.position))) + 1000
    : 1000;
}

export function positionAfter(
  pages: WorkspacePage[],
  overPage: WorkspacePage,
  movingPageId: string,
) {
  const siblings = sortPages(
    pages.filter(
      (page) =>
        !page.is_archived &&
        page.id !== movingPageId &&
        page.parent_page_id === overPage.parent_page_id &&
        page.parent_database_id === null,
    ),
  );
  const overIndex = siblings.findIndex((page) => page.id === overPage.id);
  const next = siblings[overIndex + 1];

  if (!next) return Number(overPage.position) + 1000;
  return (Number(overPage.position) + Number(next.position)) / 2;
}
