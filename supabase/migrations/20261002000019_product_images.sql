-- Photos for products the barcode databases do not know. One public-by-link bucket (unguessable file names), files are small JPEGs
-- (the app shrinks them on the phone). Only people in the home can add, list or delete files, and only inside their own home's folder.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('product-images', 'product-images', true, 1048576, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "household product images read" on storage.objects;
drop policy if exists "household product images insert" on storage.objects;
drop policy if exists "household product images delete" on storage.objects;
create policy "household product images read" on storage.objects for select to authenticated
  using (bucket_id = 'product-images' and (storage.foldername(name))[1] = (select private.my_household())::text);
create policy "household product images insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'product-images' and (storage.foldername(name))[1] = (select private.my_household())::text);
create policy "household product images delete" on storage.objects for delete to authenticated
  using (bucket_id = 'product-images' and (storage.foldername(name))[1] = (select private.my_household())::text);
