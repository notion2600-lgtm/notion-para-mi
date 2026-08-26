export type PageType = "doc" | "database";

export type WorkspacePage = {
  id: string;
  workspace_id: string;
  parent_page_id: string | null;
  parent_database_id: string | null;
  type: PageType;
  title: string;
  icon: string | null;
  cover_url: string | null;
  content: unknown;
  plain_text: string;
  properties: Record<string, unknown>;
  position: number;
  is_favorite: boolean;
  is_archived: boolean;
  archived_at: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
};

export type WorkspaceSummary = {
  id: string;
  name: string;
  icon: string | null;
  role: "owner" | "editor" | "viewer";
};
