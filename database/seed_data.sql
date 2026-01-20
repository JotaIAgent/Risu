
-- Seed Data & Schema Patch for Micro-SaaS Rental Management
-- Run this in Supabase SQL Editor

-- 0. Patch Schema (Add ALL missing tables/columns required by Dashboard)
do $$
begin
    -- Add 'type' column if not exists
    if not exists (select 1 from information_schema.columns where table_name='rentals' and column_name='type') then
        alter table public.rentals add column type text default 'rental';
    end if;

    -- Add 'total_value' column if not exists
    if not exists (select 1 from information_schema.columns where table_name='rentals' and column_name='total_value') then
        alter table public.rentals add column total_value numeric(10,2) default 0;
    end if;
    
    -- Add 'delivery_time' and 'return_time' if not exists
    if not exists (select 1 from information_schema.columns where table_name='rentals' and column_name='delivery_time') then
        alter table public.rentals add column delivery_time time;
    end if;
     if not exists (select 1 from information_schema.columns where table_name='rentals' and column_name='return_time') then
        alter table public.rentals add column return_time time;
    end if;
    
    -- Add checklist columns
    if not exists (select 1 from information_schema.columns where table_name='rentals' and column_name='checklist_status_out') then
        alter table public.rentals add column checklist_status_out boolean default false;
    end if;
    if not exists (select 1 from information_schema.columns where table_name='rentals' and column_name='checklist_status_in') then
        alter table public.rentals add column checklist_status_in boolean default false;
    end if;

    -- Create 'rental_items' table if not exists
    if not exists (select 1 from information_schema.tables where table_name='rental_items') then
        create table public.rental_items (
            id uuid default uuid_generate_v4() primary key,
            rental_id uuid references public.rentals(id) on delete cascade not null,
            item_id uuid references public.items(id) not null,
            quantity integer not null default 1,
            unit_price numeric(10,2) not null default 0,
            user_id uuid references auth.users(id) not null
        );
        alter table public.rental_items enable row level security;
        create policy "Users can view own rental items" on public.rental_items for select using (auth.uid() = user_id);
    else
         -- Ensure user_id exists if table is there
         if not exists (select 1 from information_schema.columns where table_name='rental_items' and column_name='user_id') then
             alter table public.rental_items add column user_id uuid references auth.users(id);
             -- We can't easily enforce not null on existing rows without default, so leave nullable or update it?
             -- ideally we update existing to current user then set not null.
             -- update public.rental_items set user_id = auth.uid() where user_id is null; 
         end if;
    end if;

    -- Create 'broken_logs' table if not exists
    if not exists (select 1 from information_schema.tables where table_name='broken_logs') then
        create table public.broken_logs (
            id uuid default uuid_generate_v4() primary key,
            item_id uuid references public.items(id) not null,
            quantity integer not null default 1,
            description text,
            status text DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'RESOLVED')),
            entry_date timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
            user_id uuid REFERENCES auth.users(id)
        );
        alter table public.broken_logs enable row level security;
        create policy "Users can view own broken logs" on public.broken_logs for select using (auth.uid() = user_id);
    else
        -- Make sure 'description' column exists if table already existed
        if not exists (select 1 from information_schema.columns where table_name='broken_logs' and column_name='description') then
             alter table public.broken_logs add column description text;
        end if;
    end if;
end $$;

-- 1. Seed Data
do $$
declare
  v_user_id uuid;
  v_customer1_id uuid;
  v_customer2_id uuid;
  v_customer3_id uuid;
  v_item1_id uuid;
  v_item2_id uuid;
  v_item3_id uuid;
  v_item_broken_id uuid;
  v_item_inactive_id uuid;
  v_rental1_id uuid;
  v_rental2_id uuid;
  v_rental3_id uuid;
begin
  -- Get User ID (Pick the LATEST created user)
  select id into v_user_id from auth.users order by created_at desc limit 1;

  if v_user_id is null then
    raise exception 'No users found. Please sign up in the app first.';
  end if;

  raise notice 'Seeding for User ID: %', v_user_id;

  -- Insert Items (Check individually to handle incremental updates)
  if not exists (select 1 from public.items where name = 'Cadeira Tiffany Dourada' and user_id = v_user_id) then
      insert into public.items (user_id, name, daily_price) values (v_user_id, 'Cadeira Tiffany Dourada', 15.00);
  end if;
  if not exists (select 1 from public.items where name = 'Mesa Redonda 1,20m' and user_id = v_user_id) then
      insert into public.items (user_id, name, daily_price) values (v_user_id, 'Mesa Redonda 1,20m', 45.00);
  end if;
  if not exists (select 1 from public.items where name = 'Toalha Branca' and user_id = v_user_id) then
      insert into public.items (user_id, name, daily_price) values (v_user_id, 'Toalha Branca', 8.00);
  end if;
  
  -- Insert New Items for Operational Alerts
  if not exists (select 1 from public.items where name = 'Taça Quebrada Exemplo' and user_id = v_user_id) then
      insert into public.items (user_id, name, daily_price) values (v_user_id, 'Taça Quebrada Exemplo', 5.00);
  end if;
  if not exists (select 1 from public.items where name = 'Item Parado (Velho)' and user_id = v_user_id) then
      insert into public.items (user_id, name, daily_price) values (v_user_id, 'Item Parado (Velho)', 10.00);
  end if;

  select id into v_item1_id from public.items where name = 'Cadeira Tiffany Dourada' and user_id = v_user_id limit 1;
  select id into v_item2_id from public.items where name = 'Mesa Redonda 1,20m' and user_id = v_user_id limit 1;
  select id into v_item3_id from public.items where name = 'Toalha Branca' and user_id = v_user_id limit 1;
  select id into v_item_broken_id from public.items where name = 'Taça Quebrada Exemplo' and user_id = v_user_id limit 1;
  select id into v_item_inactive_id from public.items where name = 'Item Parado (Velho)' and user_id = v_user_id limit 1;

  -- Update Inactive Item creation date to be OLD (so it shows as inactive)
  update public.items set created_at = (now() - interval '60 days') where id = v_item_inactive_id;

  -- Insert Customers
  if not exists (select 1 from public.customers where name = 'Maria Silva' and user_id = v_user_id) then
      insert into public.customers (user_id, name, whatsapp) values
        (v_user_id, 'Maria Silva', '11999999999'),
        (v_user_id, 'Buffet Delícias', '11988888888'),
        (v_user_id, 'João Santos', '11977777777');
  end if;

  select id into v_customer1_id from public.customers where name = 'Maria Silva' and user_id = v_user_id limit 1;
  select id into v_customer2_id from public.customers where name = 'Buffet Delícias' and user_id = v_user_id limit 1;
  select id into v_customer3_id from public.customers where name = 'João Santos' and user_id = v_user_id limit 1;

  -- Insert Broken Log
  if not exists (select 1 from public.broken_logs where item_id = v_item_broken_id and status = 'OPEN') then
      insert into public.broken_logs (user_id, item_id, quantity, description, status, entry_date)
      values (v_user_id, v_item_broken_id, 2, 'Quebrou na entrega', 'OPEN', now());
  end if;

  -- Insert Rentals
  if v_customer1_id is not null and v_item1_id is not null then
      
      -- 1. Active Rental (Today) - Checklist Out PENDING
      if not exists (select 1 from public.rentals where client_id = v_customer1_id and start_date = ((now())::date)) then
          insert into public.rentals (user_id, client_id, item_id, start_date, end_date, status, type, total_value, delivery_time, checklist_status_out)
          values (v_user_id, v_customer1_id, v_item1_id, now(), (now() + interval '2 days'), 'active', 'rental', 450.00, '09:00:00', false)
          returning id into v_rental1_id;
          
          if v_rental1_id is not null then
              insert into public.rental_items (rental_id, item_id, quantity, unit_price, user_id) values (v_rental1_id, v_item1_id, 30, 15.00, v_user_id); 
          end if;
      end if;
      
      -- 2. Pending Quote
       if not exists (select 1 from public.rentals where client_id = v_customer2_id and type = 'quote') then
          insert into public.rentals (user_id, client_id, item_id, start_date, end_date, status, type, total_value, checklist_status_out)
          values (v_user_id, v_customer2_id, v_item2_id, (now() + interval '7 days'), (now() + interval '7 days'), 'active', 'quote', 1200.00, false)
          returning id into v_rental2_id;
          
          if v_rental2_id is not null then
              insert into public.rental_items (rental_id, item_id, quantity, unit_price, user_id) values (v_rental2_id, v_item2_id, 10, 45.00, v_user_id); 
          end if;
      end if;
      
      -- 3. Completed/Late Rental (Ended Yesterday) - Checklist In PENDING
       if not exists (select 1 from public.rentals where client_id = v_customer3_id and end_date = ((now() - interval '1 day')::date)) then
          insert into public.rentals (user_id, client_id, item_id, start_date, end_date, status, type, total_value, checklist_status_out, checklist_status_in)
          values (v_user_id, v_customer3_id, v_item3_id, (now() - interval '3 days'), (now() - interval '1 day'), 'active', 'rental', 200.00, true, false)
          returning id into v_rental3_id;
          
          if v_rental3_id is not null then
              insert into public.rental_items (rental_id, item_id, quantity, unit_price, user_id) values (v_rental3_id, v_item3_id, 20, 8.00, v_user_id); 
          end if;
      end if;

      raise notice 'Seed completed with Operational Alerts data.';
  end if;
end $$;

