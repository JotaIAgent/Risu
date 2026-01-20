
-- Add email field to customers
alter table public.customers
add column if not exists email text;
