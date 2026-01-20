
-- 1. Profiles table to handle Roles
create table if not exists public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  email text,
  role text check (role in ('admin', 'user')) default 'user',
  is_suspended boolean default false,
  full_name text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS on profiles
alter table public.profiles enable row level security;

-- Policies for profiles
create policy "Users can view their own profile" on public.profiles
  for select using (auth.uid() = id);

create policy "Admins can view all profiles" on public.profiles
  for select using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

create policy "Admins can update all profiles" on public.profiles
  for update using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- 2. SaaS Subscriptions
create table if not exists public.saas_subscriptions (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  plan_type text default 'mensal',
  status text check (status in ('active', 'past_due', 'canceled', 'suspended')) default 'active',
  current_period_start timestamp with time zone,
  current_period_end timestamp with time zone,
  amount_cents integer default 9990, -- R$ 99,90 in cents
  last_payment_status text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.saas_subscriptions enable row level security;

-- Only admins can see/manage subscriptions globally
create policy "Admins can manage all subscriptions" on public.saas_subscriptions
  for all using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

create policy "Users can view their own subscription" on public.saas_subscriptions
  for select using (auth.uid() = user_id);

-- 3. SaaS Support Tickets
create table if not exists public.saas_support_tickets (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  subject text not null,
  message text not null,
  status text check (status in ('open', 'in_progress', 'resolved')) default 'open',
  priority text check (priority in ('low', 'medium', 'high', 'urgent')) default 'medium',
  admin_notes text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.saas_support_tickets enable row level security;

create policy "Users can see their own tickets" on public.saas_support_tickets
  for select using (auth.uid() = user_id);

create policy "Users can create tickets" on public.saas_support_tickets
  for insert with check (auth.uid() = user_id);

create policy "Admins can manage all tickets" on public.saas_support_tickets
  for all using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- 4. SaaS Admin Logs
create table if not exists public.saas_admin_logs (
  id uuid default uuid_generate_v4() primary key,
  admin_id uuid references auth.users(id) not null,
  action text not null,
  target_user_id uuid,
  details jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.saas_admin_logs enable row level security;
create policy "Only admins can see logs" on public.saas_admin_logs
  for select using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- 5. Global Settings
create table if not exists public.saas_global_settings (
    key text primary key,
    value jsonb,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Trigger to automatically create a profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, role)
  values (new.id, new.email, 'user');
  
  insert into public.saas_subscriptions (user_id, status)
  values (new.id, 'active');
  
  return new;
end;
$$ language plpgsql security definer;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
