-- Workspace: esquema inicial completo, triggers, RLS y Storage.
-- Se puede ejecutar como un bloque en Supabase > SQL Editor.

create extension if not exists pgcrypto;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  avatar_url text,
  created_at timestamptz not null default now()
);

create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  icon text,
  owner_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.workspace_members (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'editor', 'viewer')),
  primary key (workspace_id, user_id)
);

create table public.pages (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  parent_page_id uuid references public.pages(id) on delete cascade,
  parent_database_id uuid references public.pages(id) on delete cascade,
  type text not null default 'doc' check (type in ('doc', 'database')),
  title text not null default 'Sin título',
  icon text,
  cover_url text,
  content jsonb,
  plain_text text not null default '',
  search_vector tsvector generated always as (
    to_tsvector('simple'::regconfig, coalesce(title, '') || ' ' || coalesce(plain_text, ''))
  ) stored,
  properties jsonb not null default '{}'::jsonb,
  position numeric not null default 1000,
  is_favorite boolean not null default false,
  is_archived boolean not null default false,
  archived_at timestamptz,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (not (parent_page_id is not null and parent_database_id is not null))
);

create table public.db_properties (
  id uuid primary key default gen_random_uuid(),
  page_id uuid not null references public.pages(id) on delete cascade,
  name text not null,
  type text not null check (
    type in (
      'text', 'number', 'select', 'multi_select', 'status', 'date',
      'checkbox', 'url', 'email', 'phone', 'person', 'relation',
      'created_time', 'last_edited_time'
    )
  ),
  config jsonb not null default '{}'::jsonb,
  position numeric not null default 1000
);

create table public.db_views (
  id uuid primary key default gen_random_uuid(),
  page_id uuid not null references public.pages(id) on delete cascade,
  name text not null,
  type text not null check (type in ('table', 'board', 'list', 'calendar', 'gallery')),
  filters jsonb not null default '{}'::jsonb,
  sorts jsonb not null default '[]'::jsonb,
  group_by uuid references public.db_properties(id) on delete set null,
  visible_properties jsonb not null default '[]'::jsonb,
  position numeric not null default 1000
);

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  page_id uuid not null references public.pages(id) on delete cascade,
  block_id text,
  user_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (length(btrim(body)) > 0),
  resolved boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.page_shares (
  page_id uuid primary key references public.pages(id) on delete cascade,
  is_public boolean not null default false,
  public_slug text unique,
  created_at timestamptz not null default now(),
  check (not is_public or public_slug is not null)
);

create table public.files (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  page_id uuid references public.pages(id) on delete set null,
  storage_path text not null unique,
  name text not null,
  size int not null check (size >= 0),
  mime text not null,
  created_at timestamptz not null default now()
);

create index workspace_members_user_idx on public.workspace_members(user_id);
create index pages_workspace_parent_idx on public.pages(workspace_id, parent_page_id, position);
create index pages_database_rows_idx on public.pages(parent_database_id, position);
create index pages_search_idx on public.pages using gin(search_vector);
create index pages_archived_idx on public.pages(workspace_id, is_archived, archived_at);
create index db_properties_page_idx on public.db_properties(page_id, position);
create index db_views_page_idx on public.db_views(page_id, position);
create index comments_page_idx on public.comments(page_id, created_at);
create index files_workspace_idx on public.files(workspace_id, page_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger pages_set_updated_at
before update on public.pages
for each row execute function public.set_updated_at();

create or replace function public.is_workspace_member(target_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.workspace_members
    where workspace_id = target_workspace_id
      and user_id = auth.uid()
  );
$$;

create or replace function public.can_edit_workspace(target_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.workspace_members
    where workspace_id = target_workspace_id
      and user_id = auth.uid()
      and role in ('owner', 'editor')
  );
$$;

create or replace function public.is_workspace_owner(target_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.workspaces
    where id = target_workspace_id
      and owner_id = auth.uid()
  );
$$;

create or replace function public.is_page_public(target_page_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.page_shares
    where page_id = target_page_id
      and is_public = true
  );
$$;

create or replace function public.shares_workspace_with(target_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select target_user_id = auth.uid() or exists (
    select 1
    from public.workspace_members mine
    join public.workspace_members theirs
      on theirs.workspace_id = mine.workspace_id
    where mine.user_id = auth.uid()
      and theirs.user_id = target_user_id
  );
$$;

create or replace function public.workspace_id_from_storage_path(object_name text)
returns uuid
language plpgsql
immutable
set search_path = ''
as $$
begin
  return split_part(object_name, '/', 1)::uuid;
exception when invalid_text_representation then
  return null;
end;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  initial_workspace_id uuid := gen_random_uuid();
  display_name text := coalesce(
    nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''),
    nullif(split_part(new.email, '@', 1), ''),
    'Usuario'
  );
begin
  insert into public.profiles (id, full_name, avatar_url)
  values (new.id, display_name, new.raw_user_meta_data ->> 'avatar_url');

  insert into public.workspaces (id, name, icon, owner_id)
  values (initial_workspace_id, 'Espacio de ' || display_name, '✨', new.id);

  insert into public.workspace_members (workspace_id, user_id, role)
  values (initial_workspace_id, new.id, 'owner');

  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.pages enable row level security;
alter table public.db_properties enable row level security;
alter table public.db_views enable row level security;
alter table public.comments enable row level security;
alter table public.page_shares enable row level security;
alter table public.files enable row level security;

create policy "profiles_select_workspace_peers"
on public.profiles for select
to authenticated
using (public.shares_workspace_with(id));

create policy "profiles_update_self"
on public.profiles for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

create policy "workspaces_select_members"
on public.workspaces for select
to authenticated
using (public.is_workspace_member(id));

create policy "workspaces_insert_owner"
on public.workspaces for insert
to authenticated
with check (owner_id = auth.uid());

create policy "workspaces_update_editors"
on public.workspaces for update
to authenticated
using (public.can_edit_workspace(id))
with check (public.can_edit_workspace(id));

create policy "workspaces_delete_owner"
on public.workspaces for delete
to authenticated
using (public.is_workspace_owner(id));

create policy "members_select_members"
on public.workspace_members for select
to authenticated
using (public.is_workspace_member(workspace_id));

create policy "members_insert_owner"
on public.workspace_members for insert
to authenticated
with check (public.is_workspace_owner(workspace_id));

create policy "members_update_owner"
on public.workspace_members for update
to authenticated
using (public.is_workspace_owner(workspace_id))
with check (public.is_workspace_owner(workspace_id));

create policy "members_delete_owner"
on public.workspace_members for delete
to authenticated
using (public.is_workspace_owner(workspace_id));

create policy "pages_select_members"
on public.pages for select
to authenticated
using (public.is_workspace_member(workspace_id));

create policy "pages_select_public"
on public.pages for select
to anon, authenticated
using (public.is_page_public(id));

create policy "pages_insert_editors"
on public.pages for insert
to authenticated
with check (public.can_edit_workspace(workspace_id) and created_by = auth.uid());

create policy "pages_update_editors"
on public.pages for update
to authenticated
using (public.can_edit_workspace(workspace_id))
with check (public.can_edit_workspace(workspace_id));

create policy "pages_delete_editors"
on public.pages for delete
to authenticated
using (public.can_edit_workspace(workspace_id));

create policy "db_properties_select_members"
on public.db_properties for select
to authenticated
using (
  exists (
    select 1 from public.pages
    where pages.id = db_properties.page_id
      and public.is_workspace_member(pages.workspace_id)
  )
);

create policy "db_properties_insert_editors"
on public.db_properties for insert
to authenticated
with check (
  exists (
    select 1 from public.pages
    where pages.id = db_properties.page_id
      and public.can_edit_workspace(pages.workspace_id)
  )
);

create policy "db_properties_update_editors"
on public.db_properties for update
to authenticated
using (
  exists (
    select 1 from public.pages
    where pages.id = db_properties.page_id
      and public.can_edit_workspace(pages.workspace_id)
  )
)
with check (
  exists (
    select 1 from public.pages
    where pages.id = db_properties.page_id
      and public.can_edit_workspace(pages.workspace_id)
  )
);

create policy "db_properties_delete_editors"
on public.db_properties for delete
to authenticated
using (
  exists (
    select 1 from public.pages
    where pages.id = db_properties.page_id
      and public.can_edit_workspace(pages.workspace_id)
  )
);

create policy "db_views_select_members"
on public.db_views for select
to authenticated
using (
  exists (
    select 1 from public.pages
    where pages.id = db_views.page_id
      and public.is_workspace_member(pages.workspace_id)
  )
);

create policy "db_views_insert_editors"
on public.db_views for insert
to authenticated
with check (
  exists (
    select 1 from public.pages
    where pages.id = db_views.page_id
      and public.can_edit_workspace(pages.workspace_id)
  )
);

create policy "db_views_update_editors"
on public.db_views for update
to authenticated
using (
  exists (
    select 1 from public.pages
    where pages.id = db_views.page_id
      and public.can_edit_workspace(pages.workspace_id)
  )
)
with check (
  exists (
    select 1 from public.pages
    where pages.id = db_views.page_id
      and public.can_edit_workspace(pages.workspace_id)
  )
);

create policy "db_views_delete_editors"
on public.db_views for delete
to authenticated
using (
  exists (
    select 1 from public.pages
    where pages.id = db_views.page_id
      and public.can_edit_workspace(pages.workspace_id)
  )
);

create policy "comments_select_members"
on public.comments for select
to authenticated
using (
  exists (
    select 1 from public.pages
    where pages.id = comments.page_id
      and public.is_workspace_member(pages.workspace_id)
  )
);

create policy "comments_insert_members"
on public.comments for insert
to authenticated
with check (
  user_id = auth.uid() and exists (
    select 1 from public.pages
    where pages.id = comments.page_id
      and public.is_workspace_member(pages.workspace_id)
  )
);

create policy "comments_update_author"
on public.comments for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "comments_delete_author_or_editor"
on public.comments for delete
to authenticated
using (
  user_id = auth.uid() or exists (
    select 1 from public.pages
    where pages.id = comments.page_id
      and public.can_edit_workspace(pages.workspace_id)
  )
);

create policy "shares_select_public_or_members"
on public.page_shares for select
to anon, authenticated
using (
  is_public or exists (
    select 1 from public.pages
    where pages.id = page_shares.page_id
      and public.is_workspace_member(pages.workspace_id)
  )
);

create policy "shares_insert_editors"
on public.page_shares for insert
to authenticated
with check (
  exists (
    select 1 from public.pages
    where pages.id = page_shares.page_id
      and public.can_edit_workspace(pages.workspace_id)
  )
);

create policy "shares_update_editors"
on public.page_shares for update
to authenticated
using (
  exists (
    select 1 from public.pages
    where pages.id = page_shares.page_id
      and public.can_edit_workspace(pages.workspace_id)
  )
)
with check (
  exists (
    select 1 from public.pages
    where pages.id = page_shares.page_id
      and public.can_edit_workspace(pages.workspace_id)
  )
);

create policy "shares_delete_editors"
on public.page_shares for delete
to authenticated
using (
  exists (
    select 1 from public.pages
    where pages.id = page_shares.page_id
      and public.can_edit_workspace(pages.workspace_id)
  )
);

create policy "files_select_members"
on public.files for select
to authenticated
using (public.is_workspace_member(workspace_id));

create policy "files_insert_editors"
on public.files for insert
to authenticated
with check (public.can_edit_workspace(workspace_id));

create policy "files_update_editors"
on public.files for update
to authenticated
using (public.can_edit_workspace(workspace_id))
with check (public.can_edit_workspace(workspace_id));

create policy "files_delete_editors"
on public.files for delete
to authenticated
using (public.can_edit_workspace(workspace_id));

insert into storage.buckets (id, name, public, file_size_limit)
values ('workspace-files', 'workspace-files', false, 52428800)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit;

drop policy if exists "workspace_files_select_members" on storage.objects;
drop policy if exists "workspace_files_insert_editors" on storage.objects;
drop policy if exists "workspace_files_update_editors" on storage.objects;
drop policy if exists "workspace_files_delete_editors" on storage.objects;

create policy "workspace_files_select_members"
on storage.objects for select
to authenticated
using (
  bucket_id = 'workspace-files'
  and public.is_workspace_member(public.workspace_id_from_storage_path(name))
);

create policy "workspace_files_insert_editors"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'workspace-files'
  and public.can_edit_workspace(public.workspace_id_from_storage_path(name))
);

create policy "workspace_files_update_editors"
on storage.objects for update
to authenticated
using (
  bucket_id = 'workspace-files'
  and public.can_edit_workspace(public.workspace_id_from_storage_path(name))
)
with check (
  bucket_id = 'workspace-files'
  and public.can_edit_workspace(public.workspace_id_from_storage_path(name))
);

create policy "workspace_files_delete_editors"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'workspace-files'
  and public.can_edit_workspace(public.workspace_id_from_storage_path(name))
);

grant usage on schema public to anon, authenticated;
grant select on public.pages, public.page_shares to anon;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant execute on function public.is_workspace_member(uuid) to anon, authenticated;
grant execute on function public.can_edit_workspace(uuid) to authenticated;
grant execute on function public.is_workspace_owner(uuid) to authenticated;
grant execute on function public.is_page_public(uuid) to anon, authenticated;
grant execute on function public.shares_workspace_with(uuid) to authenticated;
grant execute on function public.workspace_id_from_storage_path(text) to authenticated;
