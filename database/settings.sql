
-- Table to store user integration settings (One row per user)
create table public.user_settings (
  user_id uuid references auth.users(id) primary key,
  evolution_url text,
  evolution_apikey text,
  instance_name text,
  n8n_webhook_url text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table public.user_settings enable row level security;

-- Policies
create policy "Users can view their own settings"
  on public.user_settings for select
  using (auth.uid() = user_id);

create policy "Users can insert their own settings"
  on public.user_settings for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own settings"
  on public.user_settings for update
  using (auth.uid() = user_id);

create policy "Users can delete their own settings"
  on public.user_settings for delete
  using (auth.uid() = user_id);
