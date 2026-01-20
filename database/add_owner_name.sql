
-- Add owner_name field to user_settings
alter table public.user_settings
add column if not exists owner_name text;
