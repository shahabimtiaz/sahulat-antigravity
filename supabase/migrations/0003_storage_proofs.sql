-- =====================================================================
-- 0003 — Storage bucket for proof photos
-- =====================================================================

-- Bucket is public-read but write requires service-role OR a signed upload URL.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'proofs',
  'proofs',
  true,
  10 * 1024 * 1024,   -- 10 MB cap
  array['image/jpeg','image/png','image/webp','image/heic']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Anyone can read (object URLs are unguessable and we want renderable photos).
do $$ begin
  create policy "proofs public read"
    on storage.objects for select
    using (bucket_id = 'proofs');
exception when duplicate_object then null; end $$;

-- Anonymous writes are blocked at policy level — server uses service role
-- or issues a short-lived signed upload URL.
do $$ begin
  create policy "proofs service write"
    on storage.objects for insert
    with check (bucket_id = 'proofs' and auth.role() = 'service_role');
exception when duplicate_object then null; end $$;
