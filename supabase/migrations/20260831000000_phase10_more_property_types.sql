-- Añade los tipos de propiedad "files" (adjuntos), "created_by" y "last_edited_by".
-- "created_by"/"last_edited_by" son de solo lectura calculadas por la app;
-- "files" guarda una lista de rutas de Storage en pages.properties[propertyId].
alter table public.pages add column if not exists updated_by uuid references auth.users(id);
update public.pages set updated_by = created_by where updated_by is null;

alter table public.db_properties drop constraint db_properties_type_check;

alter table public.db_properties add constraint db_properties_type_check check (
  type in (
    'text', 'number', 'select', 'multi_select', 'status', 'date',
    'checkbox', 'url', 'email', 'phone', 'person', 'relation',
    'created_time', 'last_edited_time', 'files', 'created_by', 'last_edited_by'
  )
);
