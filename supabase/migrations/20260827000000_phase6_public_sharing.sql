-- Fase 6: compartir subárboles públicos y permitir leer sus archivos privados
-- mediante URLs firmadas, sin exponer otras páginas del workspace.

create or replace function public.is_page_public(target_page_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  with recursive ancestors as (
    select id, parent_page_id, parent_database_id
    from public.pages
    where id = target_page_id

    union

    select parent.id, parent.parent_page_id, parent.parent_database_id
    from public.pages parent
    join ancestors child
      on parent.id = coalesce(child.parent_page_id, child.parent_database_id)
  )
  select exists (
    select 1
    from ancestors
    join public.page_shares
      on page_shares.page_id = ancestors.id
    where page_shares.is_public = true
  );
$$;

create or replace function public.is_storage_object_public(object_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.files
    where files.storage_path = object_name
      and files.page_id is not null
      and public.is_page_public(files.page_id)
  );
$$;

create policy "db_properties_select_public"
on public.db_properties for select
to anon
using (public.is_page_public(page_id));

create policy "db_views_select_public"
on public.db_views for select
to anon
using (public.is_page_public(page_id));

drop policy if exists "workspace_files_select_public" on storage.objects;

create policy "workspace_files_select_public"
on storage.objects for select
to anon
using (
  bucket_id = 'workspace-files'
  and public.is_storage_object_public(name)
);

grant select on public.db_properties, public.db_views to anon;
grant execute on function public.is_page_public(uuid) to anon, authenticated;
grant execute on function public.is_storage_object_public(text) to anon, authenticated;
