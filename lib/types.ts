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

export type DatabaseViewType =
  | "table"
  | "board"
  | "list"
  | "calendar"
  | "gallery";

export type DatabaseFilterOperator =
  | "is"
  | "is_not"
  | "contains"
  | "not_contains"
  | "is_empty"
  | "is_not_empty"
  | "greater_than"
  | "less_than"
  | "before"
  | "after"
  | "on"
  | "checked"
  | "unchecked";

export type DatabaseFilterRule = {
  id: string;
  property_id: string;
  operator: DatabaseFilterOperator;
  value: unknown;
};

export type DatabaseViewFilters = {
  calendarMode?: "month" | "week";
  mode: "and" | "or";
  rules: DatabaseFilterRule[];
};

export type DatabaseSort = {
  id: string;
  property_id: string;
  direction: "asc" | "desc";
};

export type DatabaseView = {
  id: string;
  page_id: string;
  name: string;
  type: DatabaseViewType;
  filters: DatabaseViewFilters;
  sorts: DatabaseSort[];
  group_by: string | null;
  visible_properties: string[];
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
  visibility: "private" | "team";
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

export type WorkspaceMember = {
  user_id: string;
  full_name: string;
  avatar_url: string | null;
  role: WorkspaceSummary["role"];
};

export type WorkspaceInvitation = {
  id: string;
  workspace_id: string;
  email: string;
  role: "editor" | "viewer";
  token: string;
  invited_by: string;
  expires_at: string;
  accepted_at: string | null;
  created_at: string;
};

export type WorkspaceInvitationPreview = {
  workspace_id: string;
  workspace_name: string;
  workspace_icon: string | null;
  invited_email: string;
  invited_role: "editor" | "viewer";
  expires_at: string;
  accepted_at: string | null;
};

export type TemplatePageSnapshot = {
  source_id: string;
  parent_source_id: string | null;
  parent_database_source_id: string | null;
  type: PageType;
  title: string;
  icon: string | null;
  cover_url: string | null;
  content: unknown;
  plain_text: string;
  properties: Record<string, unknown>;
  position: number;
};

export type TemplatePropertySnapshot = {
  source_id: string;
  page_source_id: string;
  name: string;
  type: DatabasePropertyType;
  config: DatabasePropertyConfig;
  position: number;
};

export type TemplateViewSnapshot = {
  source_id: string;
  page_source_id: string;
  name: string;
  type: DatabaseViewType;
  filters: DatabaseViewFilters;
  sorts: DatabaseSort[];
  group_by_source_id: string | null;
  visible_property_source_ids: string[];
  position: number;
};

export type TemplateSnapshot = {
  pages: TemplatePageSnapshot[];
  properties: TemplatePropertySnapshot[];
  views: TemplateViewSnapshot[];
};

export type PageTemplate = {
  id: string;
  workspace_id: string | null;
  created_by: string | null;
  name: string;
  description: string;
  icon: string;
  snapshot: TemplateSnapshot;
  is_builtin: boolean;
  created_at: string;
};

export type PageShare = {
  page_id: string;
  is_public: boolean;
  public_slug: string | null;
  created_at: string;
};
