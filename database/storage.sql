
-- 1. Create a public bucket for inventory images
insert into storage.buckets (id, name, public)
values ('inventory', 'inventory', true)
on conflict (id) do nothing;

-- 2. Enable RLS on objects
alter table storage.objects enable row level security;

-- 3. Policies
-- Allow authenticated users to upload files to 'inventory' bucket
create policy "Users can upload inventory images"
on storage.objects for insert
with check (
  bucket_id = 'inventory' AND
  auth.role() = 'authenticated'
);

-- Allow authenticated users to update their own files
create policy "Users can update their own inventory images"
on storage.objects for update
using (auth.uid() = owner)
with check (bucket_id = 'inventory');

-- Allow authenticated users to delete their own files
create policy "Users can delete their own inventory images"
on storage.objects for delete
using (auth.uid() = owner AND bucket_id = 'inventory');

-- Allow public access to view images (so they load in the app)
create policy "Public can view inventory images"
on storage.objects for select
using (bucket_id = 'inventory');
