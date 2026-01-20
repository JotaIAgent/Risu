
-- Add total_quantity to items
alter table public.items
add column if not exists total_quantity int default 1;

-- Add quantity to rentals
alter table public.rentals
add column if not exists quantity int default 1;
