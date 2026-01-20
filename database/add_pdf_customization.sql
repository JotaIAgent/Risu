
-- Add logo and color customization fields
alter table public.user_settings 
add column if not exists contract_logo_url text,
add column if not exists contract_primary_color text default '#14b8a6',
add column if not exists contract_secondary_color text default '#0d9488';
