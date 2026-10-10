-- 0003_storage: buckets privados para el logo del negocio y los comprobantes de gastos.
-- Se sirven con signed URLs; solo el usuario autenticado puede leer y escribir.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('negocio', 'negocio', false, 1048576, array['image/png', 'image/jpeg']),
  ('comprobantes', 'comprobantes', false, 5242880, array['image/png', 'image/jpeg', 'application/pdf'])
on conflict (id) do nothing;

create policy "archivos_select_authenticated" on storage.objects
  for select to authenticated using (bucket_id in ('negocio', 'comprobantes'));

create policy "archivos_insert_authenticated" on storage.objects
  for insert to authenticated with check (bucket_id in ('negocio', 'comprobantes'));

create policy "archivos_update_authenticated" on storage.objects
  for update to authenticated
  using (bucket_id in ('negocio', 'comprobantes'))
  with check (bucket_id in ('negocio', 'comprobantes'));

create policy "archivos_delete_authenticated" on storage.objects
  for delete to authenticated using (bucket_id in ('negocio', 'comprobantes'));
