-- Fase 7: colaboración de equipo, invitaciones y sincronización en tiempo real

create table if not exists public.workspace_invitations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  email text not null,
  role text not null check (role in ('editor', 'viewer')),
  token uuid not null unique default gen_random_uuid(),
  invited_by uuid not null references auth.users(id) on delete cascade,
  expires_at timestamptz not null default (now() + interval '7 days'),
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  check (email = lower(btrim(email)))
);

create unique index if not exists workspace_invitations_pending_email_idx
on public.workspace_invitations (workspace_id, lower(email))
where accepted_at is null;

create index if not exists workspace_invitations_workspace_idx
on public.workspace_invitations (workspace_id, created_at desc);

alter table public.workspace_invitations enable row level security;

create policy "workspace_invitations_select_owner"
on public.workspace_invitations for select
to authenticated
using (public.is_workspace_owner(workspace_id));

create policy "workspace_invitations_insert_owner"
on public.workspace_invitations for insert
to authenticated
with check (
  public.is_workspace_owner(workspace_id)
  and invited_by = (select auth.uid())
);

create policy "workspace_invitations_update_owner"
on public.workspace_invitations for update
to authenticated
using (public.is_workspace_owner(workspace_id))
with check (public.is_workspace_owner(workspace_id));

create policy "workspace_invitations_delete_owner"
on public.workspace_invitations for delete
to authenticated
using (public.is_workspace_owner(workspace_id));

create or replace function public.get_workspace_invitation(invitation_token uuid)
returns table (
  workspace_id uuid,
  workspace_name text,
  workspace_icon text,
  invited_email text,
  invited_role text,
  expires_at timestamptz,
  accepted_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    invitations.workspace_id,
    workspaces.name,
    workspaces.icon,
    invitations.email,
    invitations.role,
    invitations.expires_at,
    invitations.accepted_at
  from public.workspace_invitations invitations
  join public.workspaces workspaces on workspaces.id = invitations.workspace_id
  where invitations.token = invitation_token
  limit 1;
$$;

create or replace function public.accept_workspace_invitation(invitation_token uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  invitation public.workspace_invitations%rowtype;
  account_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
begin
  if auth.uid() is null then
    raise exception 'Debes iniciar sesión para aceptar la invitación';
  end if;

  select * into invitation
  from public.workspace_invitations
  where token = invitation_token
  for update;

  if invitation.id is null then
    raise exception 'La invitación no existe';
  end if;
  if invitation.accepted_at is not null then
    raise exception 'La invitación ya fue utilizada';
  end if;
  if invitation.expires_at <= now() then
    raise exception 'La invitación ha vencido';
  end if;
  if account_email <> invitation.email then
    raise exception 'Inicia sesión con % para aceptar esta invitación', invitation.email;
  end if;

  insert into public.workspace_members (workspace_id, user_id, role)
  values (invitation.workspace_id, auth.uid(), invitation.role)
  on conflict (workspace_id, user_id) do update
  set role = case
    when public.workspace_members.role = 'owner' then public.workspace_members.role
    else excluded.role
  end;

  update public.workspace_invitations
  set accepted_at = now()
  where id = invitation.id;

  return invitation.workspace_id;
end;
$$;

create or replace function public.list_workspace_members(target_workspace_id uuid)
returns table (
  user_id uuid,
  full_name text,
  avatar_url text,
  role text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    members.user_id,
    profiles.full_name,
    profiles.avatar_url,
    members.role
  from public.workspace_members members
  join public.profiles profiles on profiles.id = members.user_id
  where members.workspace_id = target_workspace_id
    and public.is_workspace_member(target_workspace_id)
  order by
    case members.role when 'owner' then 0 when 'editor' then 1 else 2 end,
    profiles.full_name;
$$;

grant select, insert, update, delete on public.workspace_invitations to authenticated;
grant execute on function public.get_workspace_invitation(uuid) to anon, authenticated;
grant execute on function public.accept_workspace_invitation(uuid) to authenticated;
grant execute on function public.list_workspace_members(uuid) to authenticated;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'pages'
  ) then
    alter publication supabase_realtime add table public.pages;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'db_properties'
  ) then
    alter publication supabase_realtime add table public.db_properties;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'db_views'
  ) then
    alter publication supabase_realtime add table public.db_views;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'workspace_members'
  ) then
    alter publication supabase_realtime add table public.workspace_members;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'workspace_invitations'
  ) then
    alter publication supabase_realtime add table public.workspace_invitations;
  end if;
end
$$;
