
-- Add contract_template column to user_settings if it doesn't exist
alter table public.user_settings 
add column if not exists contract_template text default 'Ola {cliente}, seu aluguel de {item} esta confirmado para {inicio} ate {fim}. Total: R$ {total}.';
