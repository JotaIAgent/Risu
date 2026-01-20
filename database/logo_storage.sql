
-- Create storage bucket for contract logos
insert into storage.buckets (id, name, public)
values ('contract-logos', 'contract-logos', true)
on conflict (id) do nothing;

-- Drop existing policies if any
drop policy if exists "Authenticated users can upload logos" on storage.objects;
drop policy if exists "Anyone can view logos" on storage.objects;
drop policy if exists "Users can update their own logos" on storage.objects;
drop policy if exists "Users can delete their own logos" on storage.objects;

-- Set up RLS policies for contract-logos bucket
create policy "Allow authenticated uploads to contract-logos"
on storage.objects for insert
to authenticated
with check (bucket_id = 'contract-logos');

create policy "Allow public read access to contract-logos"
on storage.objects for select
to public
using (bucket_id = 'contract-logos');

create policy "Allow authenticated users to update in contract-logos"
on storage.objects for update
to authenticated
using (bucket_id = 'contract-logos');

create policy "Allow authenticated users to delete in contract-logos"
on storage.objects for delete
to authenticated
using (bucket_id = 'contract-logos');
