export type PageType = "doc" | "database";

export type DatabasePropertyType =
  | "text"
  | "number"
  | "select"
  | "multi_select"
  | "status"
  | "date"
  | "checkbox"
  | "url"
  | "email"
  | "phone"
  | "person"
  | "relation"
  | "created_time"
  | "last_edited_time";

export type DatabaseOption = {
  id: string;
  label: string;
  color: string;
};

export type DatabasePropertyConfig = {
  hidden?: boolean;
  numberFormat?: "number" | "currency" | "percent";
  options?: DatabaseOption[];
  range?: boolean;
  width?: number;
};

export type DatabaseProperty = {
  id: string;
  page_id: string;
  name: string;
  type: DatabasePropertyType;
  config: DatabasePropertyConfig;
  position: number;
};

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
