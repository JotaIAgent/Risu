
-- 1. Updates on USER_SETTINGS
alter table public.user_settings 
add column if not exists contract_template text default 'Ola {cliente}, seu aluguel de {item} esta confirmado para {inicio} ate {fim}. Total: R$ {total}.',
add column if not exists global_auto_send boolean default true;

-- 2. Updates on CUSTOMERS
alter table public.customers
add column if not exists whatsapp_opt_in boolean default true;
