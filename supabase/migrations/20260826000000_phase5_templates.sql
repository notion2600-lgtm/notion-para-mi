-- Fase 5: plantillas persistentes, cinco plantillas iniciales y RLS.

create table public.page_templates (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces(id) on delete cascade,
  created_by uuid references auth.users(id) on delete cascade,
  name text not null check (length(btrim(name)) > 0),
  description text not null default '',
  icon text not null default '📄',
  snapshot jsonb not null check (jsonb_typeof(snapshot) = 'object'),
  is_builtin boolean not null default false,
  created_at timestamptz not null default now(),
  check (
    (is_builtin and workspace_id is null and created_by is null)
    or
    (not is_builtin and workspace_id is not null and created_by is not null)
  )
);

create index page_templates_workspace_idx
on public.page_templates(workspace_id, created_at desc);

alter table public.page_templates enable row level security;

create policy "templates_select_builtin_or_members"
on public.page_templates for select
to authenticated
using (
  is_builtin
  or (workspace_id is not null and public.is_workspace_member(workspace_id))
);

create policy "templates_insert_editors"
on public.page_templates for insert
to authenticated
with check (
  not is_builtin
  and created_by = auth.uid()
  and workspace_id is not null
  and public.can_edit_workspace(workspace_id)
);

create policy "templates_update_editors"
on public.page_templates for update
to authenticated
using (
  not is_builtin
  and workspace_id is not null
  and public.can_edit_workspace(workspace_id)
)
with check (
  not is_builtin
  and created_by = auth.uid()
  and workspace_id is not null
  and public.can_edit_workspace(workspace_id)
);

create policy "templates_delete_editors"
on public.page_templates for delete
to authenticated
using (
  not is_builtin
  and workspace_id is not null
  and public.can_edit_workspace(workspace_id)
);

grant select, insert, update, delete on public.page_templates to authenticated;

insert into public.page_templates (
  id, name, description, icon, snapshot, is_builtin
)
values
(
  '10000000-0000-4000-8000-000000000001',
  'Tareas',
  'Tablero para organizar pendientes por estado y fecha.',
  '✅',
  jsonb_build_object(
    'pages', jsonb_build_array(jsonb_build_object(
      'source_id', 'root', 'parent_source_id', null,
      'parent_database_source_id', null, 'type', 'database',
      'title', 'Tareas', 'icon', '✅', 'cover_url', null,
      'content', null, 'plain_text', '', 'properties', '{}'::jsonb,
      'position', 1000
    )),
    'properties', jsonb_build_array(
      jsonb_build_object('source_id', 'status', 'page_source_id', 'root', 'name', 'Estado', 'type', 'status', 'config', jsonb_build_object('hidden', false, 'width', 180, 'options', jsonb_build_array(jsonb_build_object('id', 'todo', 'label', 'Por hacer', 'color', 'gray'), jsonb_build_object('id', 'doing', 'label', 'En curso', 'color', 'blue'), jsonb_build_object('id', 'done', 'label', 'Listo', 'color', 'green'))), 'position', 1000),
      jsonb_build_object('source_id', 'due', 'page_source_id', 'root', 'name', 'Fecha límite', 'type', 'date', 'config', jsonb_build_object('hidden', false, 'width', 180, 'range', false), 'position', 2000),
      jsonb_build_object('source_id', 'owner', 'page_source_id', 'root', 'name', 'Responsable', 'type', 'person', 'config', jsonb_build_object('hidden', false, 'width', 180), 'position', 3000)
    ),
    'views', jsonb_build_array(
      jsonb_build_object('source_id', 'table', 'page_source_id', 'root', 'name', 'Tabla', 'type', 'table', 'filters', jsonb_build_object('mode', 'and', 'rules', jsonb_build_array()), 'sorts', jsonb_build_array(), 'group_by_source_id', null, 'visible_property_source_ids', jsonb_build_array(), 'position', 1000),
      jsonb_build_object('source_id', 'board', 'page_source_id', 'root', 'name', 'Tablero', 'type', 'board', 'filters', jsonb_build_object('mode', 'and', 'rules', jsonb_build_array()), 'sorts', jsonb_build_array(), 'group_by_source_id', 'status', 'visible_property_source_ids', jsonb_build_array('status', 'due', 'owner'), 'position', 2000)
    )
  ),
  true
),
(
  '10000000-0000-4000-8000-000000000002',
  'CRM simple',
  'Base de clientes con etapa, correo, teléfono y valor.',
  '🤝',
  jsonb_build_object(
    'pages', jsonb_build_array(jsonb_build_object('source_id', 'root', 'parent_source_id', null, 'parent_database_source_id', null, 'type', 'database', 'title', 'CRM simple', 'icon', '🤝', 'cover_url', null, 'content', null, 'plain_text', '', 'properties', '{}'::jsonb, 'position', 1000)),
    'properties', jsonb_build_array(
      jsonb_build_object('source_id', 'stage', 'page_source_id', 'root', 'name', 'Etapa', 'type', 'status', 'config', jsonb_build_object('hidden', false, 'width', 180, 'options', jsonb_build_array(jsonb_build_object('id', 'lead', 'label', 'Prospecto', 'color', 'gray'), jsonb_build_object('id', 'contact', 'label', 'Contactado', 'color', 'blue'), jsonb_build_object('id', 'client', 'label', 'Cliente', 'color', 'green'))), 'position', 1000),
      jsonb_build_object('source_id', 'email', 'page_source_id', 'root', 'name', 'Email', 'type', 'email', 'config', jsonb_build_object('hidden', false, 'width', 200), 'position', 2000),
      jsonb_build_object('source_id', 'phone', 'page_source_id', 'root', 'name', 'Teléfono', 'type', 'phone', 'config', jsonb_build_object('hidden', false, 'width', 180), 'position', 3000),
      jsonb_build_object('source_id', 'value', 'page_source_id', 'root', 'name', 'Valor', 'type', 'number', 'config', jsonb_build_object('hidden', false, 'width', 160, 'numberFormat', 'currency'), 'position', 4000)
    ),
    'views', jsonb_build_array(jsonb_build_object('source_id', 'table', 'page_source_id', 'root', 'name', 'Clientes', 'type', 'table', 'filters', jsonb_build_object('mode', 'and', 'rules', jsonb_build_array()), 'sorts', jsonb_build_array(), 'group_by_source_id', null, 'visible_property_source_ids', jsonb_build_array(), 'position', 1000))
  ),
  true
),
(
  '10000000-0000-4000-8000-000000000003',
  'Calendario de contenido',
  'Plan editorial con canal, estado y fecha de publicación.',
  '🗓️',
  jsonb_build_object(
    'pages', jsonb_build_array(jsonb_build_object('source_id', 'root', 'parent_source_id', null, 'parent_database_source_id', null, 'type', 'database', 'title', 'Calendario de contenido', 'icon', '🗓️', 'cover_url', null, 'content', null, 'plain_text', '', 'properties', '{}'::jsonb, 'position', 1000)),
    'properties', jsonb_build_array(
      jsonb_build_object('source_id', 'publish', 'page_source_id', 'root', 'name', 'Publicación', 'type', 'date', 'config', jsonb_build_object('hidden', false, 'width', 180, 'range', false), 'position', 1000),
      jsonb_build_object('source_id', 'channel', 'page_source_id', 'root', 'name', 'Canal', 'type', 'select', 'config', jsonb_build_object('hidden', false, 'width', 180, 'options', jsonb_build_array(jsonb_build_object('id', 'instagram', 'label', 'Instagram', 'color', 'pink'), jsonb_build_object('id', 'linkedin', 'label', 'LinkedIn', 'color', 'blue'), jsonb_build_object('id', 'web', 'label', 'Web', 'color', 'green'))), 'position', 2000),
      jsonb_build_object('source_id', 'status', 'page_source_id', 'root', 'name', 'Estado', 'type', 'status', 'config', jsonb_build_object('hidden', false, 'width', 180, 'options', jsonb_build_array(jsonb_build_object('id', 'idea', 'label', 'Idea', 'color', 'gray'), jsonb_build_object('id', 'draft', 'label', 'Borrador', 'color', 'amber'), jsonb_build_object('id', 'ready', 'label', 'Listo', 'color', 'green'))), 'position', 3000)
    ),
    'views', jsonb_build_array(
      jsonb_build_object('source_id', 'calendar', 'page_source_id', 'root', 'name', 'Calendario', 'type', 'calendar', 'filters', jsonb_build_object('mode', 'and', 'rules', jsonb_build_array(), 'calendarMode', 'month'), 'sorts', jsonb_build_array(), 'group_by_source_id', 'publish', 'visible_property_source_ids', jsonb_build_array('channel', 'status'), 'position', 1000),
      jsonb_build_object('source_id', 'table', 'page_source_id', 'root', 'name', 'Contenido', 'type', 'table', 'filters', jsonb_build_object('mode', 'and', 'rules', jsonb_build_array()), 'sorts', jsonb_build_array(), 'group_by_source_id', null, 'visible_property_source_ids', jsonb_build_array(), 'position', 2000)
    )
  ),
  true
),
(
  '10000000-0000-4000-8000-000000000004',
  'Notas de reunión',
  'Agenda, decisiones y próximos pasos para cada reunión.',
  '📝',
  jsonb_build_object(
    'pages', jsonb_build_array(jsonb_build_object(
      'source_id', 'root', 'parent_source_id', null, 'parent_database_source_id', null,
      'type', 'doc', 'title', 'Notas de reunión', 'icon', '📝', 'cover_url', null,
      'content', jsonb_build_array(
        jsonb_build_object('type', 'heading', 'props', jsonb_build_object('level', 2), 'content', 'Agenda'),
        jsonb_build_object('type', 'bulletListItem', 'content', 'Tema principal'),
        jsonb_build_object('type', 'heading', 'props', jsonb_build_object('level', 2), 'content', 'Decisiones'),
        jsonb_build_object('type', 'paragraph', 'content', ''),
        jsonb_build_object('type', 'heading', 'props', jsonb_build_object('level', 2), 'content', 'Próximos pasos'),
        jsonb_build_object('type', 'checkListItem', 'props', jsonb_build_object('checked', false), 'content', 'Acción pendiente')
      ),
      'plain_text', 'Agenda Tema principal Decisiones Próximos pasos Acción pendiente',
      'properties', '{}'::jsonb, 'position', 1000
    )),
    'properties', jsonb_build_array(), 'views', jsonb_build_array()
  ),
  true
),
(
  '10000000-0000-4000-8000-000000000005',
  'Metas trimestrales',
  'Estructura para definir objetivos, métricas y avances.',
  '🎯',
  jsonb_build_object(
    'pages', jsonb_build_array(jsonb_build_object(
      'source_id', 'root', 'parent_source_id', null, 'parent_database_source_id', null,
      'type', 'doc', 'title', 'Metas trimestrales', 'icon', '🎯', 'cover_url', null,
      'content', jsonb_build_array(
        jsonb_build_object('type', 'heading', 'props', jsonb_build_object('level', 2), 'content', 'Objetivo principal'),
        jsonb_build_object('type', 'paragraph', 'content', 'Describe el resultado que quieres conseguir.'),
        jsonb_build_object('type', 'heading', 'props', jsonb_build_object('level', 2), 'content', 'Resultados clave'),
        jsonb_build_object('type', 'checkListItem', 'props', jsonb_build_object('checked', false), 'content', 'Resultado medible 1'),
        jsonb_build_object('type', 'checkListItem', 'props', jsonb_build_object('checked', false), 'content', 'Resultado medible 2'),
        jsonb_build_object('type', 'heading', 'props', jsonb_build_object('level', 2), 'content', 'Revisión semanal')
      ),
      'plain_text', 'Objetivo principal Resultados clave Revisión semanal',
      'properties', '{}'::jsonb, 'position', 1000
    )),
    'properties', jsonb_build_array(), 'views', jsonb_build_array()
  ),
  true
)
on conflict (id) do nothing;
