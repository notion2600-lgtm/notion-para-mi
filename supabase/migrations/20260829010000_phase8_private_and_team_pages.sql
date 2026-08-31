-- Fase 8: páginas privadas y páginas compartidas del equipo

alter table public.pages
add column if not exists visibility text not null default 'private'
check (visibility in ('private', 'team'));

drop policy if exists "pages_select_members" on public.pages;
drop policy if exists "pages_insert_editors" on public.pages;
drop policy if exists "pages_update_editors" on public.pages;
drop policy if exists "pages_delete_editors" on public.pages;

create policy "pages_select_members"
on public.pages for select
to authenticated
using (
  public.is_workspace_member(workspace_id)
  and (visibility = 'team' or created_by = (select auth.uid()))
);

create policy "pages_insert_editors"
on public.pages for insert
to authenticated
with check (
  public.can_edit_workspace(workspace_id)
  and created_by = (select auth.uid())
);

create policy "pages_update_editors"
on public.pages for update
to authenticated
using (
  public.can_edit_workspace(workspace_id)
  and (visibility = 'team' or created_by = (select auth.uid()))
)
with check (
  public.can_edit_workspace(workspace_id)
  and (visibility = 'team' or created_by = (select auth.uid()))
);

create policy "pages_delete_editors"
on public.pages for delete
to authenticated
using (
  public.can_edit_workspace(workspace_id)
  and (visibility = 'team' or created_by = (select auth.uid()))
);

create or replace function public.can_access_workspace_file(object_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.files
    join public.pages on pages.id = files.page_id
    where files.storage_path = object_name
      and public.is_workspace_member(files.workspace_id)
      and (pages.visibility = 'team' or pages.created_by = auth.uid())
  );
$$;

drop policy if exists "files_select_members" on public.files;
create policy "files_select_members"
on public.files for select
to authenticated
using (
  page_id is not null
  and exists (
    select 1 from public.pages
    where pages.id = files.page_id
  )
);

drop policy if exists "workspace_files_select_members" on storage.objects;
create policy "workspace_files_select_members"
on storage.objects for select
to authenticated
using (
  bucket_id = 'workspace-files'
  and public.can_access_workspace_file(name)
);

grant execute on function public.can_access_workspace_file(text) to authenticated;
