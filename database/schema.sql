
-- Enable necessary extensions
create extension if not exists "uuid-ossp";

-- Table: items
create table public.items (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users(id) not null,
  name text not null,
  photo_url text,
  daily_price numeric(10,2) not null check (daily_price >= 0),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Table: customers
create table public.customers (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users(id) not null,
  name text not null,
  whatsapp text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Table: rentals
create table public.rentals (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users(id) not null,
  client_id uuid references public.customers(id) not null,
  item_id uuid references public.items(id) not null,
  start_date date not null,
  end_date date not null,
  status text check (status in ('active', 'completed', 'canceled')) default 'active',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  constraint rental_dates_check check (end_date >= start_date)
);

-- Enable RLS
alter table public.items enable row level security;
alter table public.customers enable row level security;
alter table public.rentals enable row level security;

-- Policies for items
create policy "Users can view their own items"
  on public.items for select
  using (auth.uid() = user_id);

create policy "Users can insert their own items"
  on public.items for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own items"
  on public.items for update
  using (auth.uid() = user_id);

create policy "Users can delete their own items"
  on public.items for delete
  using (auth.uid() = user_id);

-- Policies for customers
create policy "Users can view their own customers"
  on public.customers for select
  using (auth.uid() = user_id);

create policy "Users can insert their own customers"
  on public.customers for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own customers"
  on public.customers for update
  using (auth.uid() = user_id);

create policy "Users can delete their own customers"
  on public.customers for delete
  using (auth.uid() = user_id);

-- Policies for rentals
create policy "Users can view their own rentals"
  on public.rentals for select
  using (auth.uid() = user_id);

create policy "Users can insert their own rentals"
  on public.rentals for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own rentals"
  on public.rentals for update
  using (auth.uid() = user_id);

create policy "Users can delete their own rentals"
  on public.rentals for delete
  using (auth.uid() = user_id);
