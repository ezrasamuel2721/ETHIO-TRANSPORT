update storage.buckets set public=true where id='complaint-evidence';

drop policy if exists "anonymous complaint evidence uploads" on storage.objects;
create policy "anonymous complaint evidence uploads"
on storage.objects for insert to anon, authenticated
with check (
  bucket_id = 'complaint-evidence'
  and (storage.foldername(name))[1] is not null
);