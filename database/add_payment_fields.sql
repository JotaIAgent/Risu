
-- Add payment method, discount, and down payment fields to rentals
alter table public.rentals
add column if not exists payment_method text default 'Dinheiro',
add column if not exists discount numeric default 0,
add column if not exists discount_type text default 'value',
add column if not exists down_payment numeric default 0;
