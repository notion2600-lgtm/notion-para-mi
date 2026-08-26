import type { WorkspacePage } from "@/lib/types";

export function getBacklinks(pages: WorkspacePage[], targetPageId: string) {
  return pages.filter(
    (page) =>
      !page.is_archived &&
      page.id !== targetPageId &&
      (containsPageReference(page.content, targetPageId) ||
        containsPageReference(page.properties, targetPageId)),
  );
}

function containsPageReference(value: unknown, targetPageId: string): boolean {
  if (value === targetPageId) return true;
  if (Array.isArray(value)) {
    return value.some((item) => containsPageReference(item, targetPageId));
  }
  if (typeof value === "object" && value !== null) {
    return Object.values(value).some((item) =>
      containsPageReference(item, targetPageId),
    );
  }
  return false;
}
