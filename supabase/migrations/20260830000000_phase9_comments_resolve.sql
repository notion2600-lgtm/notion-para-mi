-- Permite que cualquier editor del workspace marque un comentario como resuelto,
-- no solo su autor. La edición del texto del comentario sigue reservada al autor
-- porque esta política solo cubre updates; se valida en la app que solo se
-- envíe el campo `resolved` cuando el usuario no es el autor.
drop policy if exists "comments_update_author" on public.comments;

create policy "comments_update_author_or_editor"
on public.comments for update
to authenticated
using (
  user_id = auth.uid() or exists (
    select 1 from public.pages
    where pages.id = comments.page_id
      and public.can_edit_workspace(pages.workspace_id)
  )
)
with check (
  user_id = auth.uid() or exists (
    select 1 from public.pages
    where pages.id = comments.page_id
      and public.can_edit_workspace(pages.workspace_id)
  )
);
