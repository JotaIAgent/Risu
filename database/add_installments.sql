
-- Add installments field to rentals
alter table public.rentals
add column if not exists installments int default 1;
