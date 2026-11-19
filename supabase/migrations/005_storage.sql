-- TABYLGA 005: хранилище файлов (Supabase Storage).
--
-- Путь файла: <user_id>/<uuid>.<ext>. Клиент сжимает фото до ~1600 px и ~500 КБ,
-- сервер дополнительно ограничивает размер и тип файла на уровне бакета.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('listing-images', 'listing-images', true,  2097152, array['image/jpeg', 'image/png', 'image/webp']),
  ('avatars',        'avatars',        true,  1048576, array['image/jpeg', 'image/png', 'image/webp']),
  ('chat-images',    'chat-images',    false, 2097152, array['image/jpeg', 'image/png', 'image/webp']),
  ('receipts',       'receipts',       false, 3145728, array['image/jpeg', 'image/png', 'image/webp']),
  ('payment-qr',     'payment-qr',     true,  1048576, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create function public._storage_path_ok(p_name text) returns boolean
language sql immutable set search_path = '' as $$
  select p_name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|jpeg|png|webp)$'
$$;
grant execute on function public._storage_path_ok(text) to anon, authenticated;

-- Загрузка: только в свою папку и только по шаблону пути.
create policy tabylga_upload_own on storage.objects for insert to authenticated
  with check (
    bucket_id in ('listing-images', 'avatars', 'chat-images', 'receipts')
    and (storage.foldername(name))[1] = auth.uid()::text
    and public._storage_path_ok(name)
  );

-- QR-коды реквизитов загружает только admin.
create policy tabylga_qr_admin_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'payment-qr' and public.is_super_admin());
create policy tabylga_qr_admin_delete on storage.objects for delete to authenticated
  using (bucket_id = 'payment-qr' and public.is_super_admin());

-- Чтение публичных бакетов.
create policy tabylga_public_read on storage.objects for select to anon, authenticated
  using (bucket_id in ('listing-images', 'avatars', 'payment-qr'));

-- Фото в чатах: автор или участник чата / обращения, где фото отправлено.
create policy tabylga_chat_images_read on storage.objects for select to authenticated
  using (
    bucket_id = 'chat-images' and (
      (storage.foldername(name))[1] = auth.uid()::text
      or exists (
        select 1 from public.messages m
         where m.image_path = storage.objects.name
           and ((m.chat_id is not null and public.is_chat_member(m.chat_id))
             or (m.support_chat_id is not null and public.can_access_support_chat(m.support_chat_id))))
    )
  );

-- Чеки: владелец и admin.
create policy tabylga_receipts_read on storage.objects for select to authenticated
  using (bucket_id = 'receipts' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_super_admin()));

-- Удаление своих файлов: аватары — всегда; фото объявлений — пока не привязаны к объявлению.
create policy tabylga_delete_own on storage.objects for delete to authenticated
  using (
    (storage.foldername(name))[1] = auth.uid()::text and (
      bucket_id = 'avatars'
      or (bucket_id = 'listing-images'
          and not exists (select 1 from public.listing_images li where li.path = storage.objects.name))
    )
  );
