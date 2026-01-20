
-- Add profile fields to user_settings
alter table public.user_settings 
add column if not exists owner_phone text,
add column if not exists owner_cpf_cnpj text;

-- Add CPF to customers
alter table public.customers
add column if not exists cpf text;
