
-- Create storage bucket for rental contracts
insert into storage.buckets (id, name, public)
values ('rental-contracts', 'rental-contracts', true)
on conflict (id) do nothing;

-- Set up RLS policies for rental-contracts bucket
create policy "Anyone can upload contracts"
on storage.objects for insert
with check (bucket_id = 'rental-contracts');

create policy "Anyone can view contracts"
on storage.objects for select
using (bucket_id = 'rental-contracts');

create policy "Authenticated users can delete their contracts"
on storage.objects for delete
using (bucket_id = 'rental-contracts' and auth.role() = 'authenticated');
