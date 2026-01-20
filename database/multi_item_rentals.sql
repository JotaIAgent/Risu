
-- Table for items within a rental
create table if not exists public.rental_items (
    id uuid default gen_random_uuid() primary key,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    rental_id uuid references public.rentals(id) on delete cascade not null,
    item_id uuid references public.items(id) not null,
    quantity int default 1 not null,
    unit_price numeric not null,
    user_id uuid references auth.users(id) not null
);

-- Enable RLS
alter table public.rental_items enable row level security;

-- RLS Policies
drop policy if exists "Users can manage their own rental items" on public.rental_items;

create policy "Users can manage their own rental items"
on public.rental_items for all
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

-- Optional: Add a total_value cache to rentals if not exists
alter table public.rentals add column if not exists total_value numeric default 0;
