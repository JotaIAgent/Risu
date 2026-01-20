-- Add status tracking columns to items
alter table public.items 
add column if not exists maintenance_quantity int default 0,
add column if not exists lost_quantity int default 0;

-- Ensure constraints (optional but good practice)
alter table public.items
add constraint stock_logic_check check (
    total_quantity >= (maintenance_quantity + lost_quantity)
);
