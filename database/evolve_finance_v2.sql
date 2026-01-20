-- Evolve Finance Module V2: Multi-Account Support

-- 1. Create Accounts Table
create table if not exists accounts (
    id uuid default gen_random_uuid() primary key,
    user_id uuid references auth.users(id) on delete cascade,
    name text not null,
    context text not null check (context in ('business', 'personal')),
    type text not null check (type in ('general', 'bank', 'card', 'deposit_fund')),
    is_default boolean default false,
    balance numeric default 0,
    color text, -- For UI badging
    created_at timestamptz default timezone('utc'::text, now()) not null
);

-- Enable RLS on accounts
alter table accounts enable row level security;

create policy "Users can view their own accounts"
    on accounts for select
    using (auth.uid() = user_id);

create policy "Users can manage their own accounts"
    on accounts for all
    using (auth.uid() = user_id);

-- 2. Modify Financial Transactions
-- Add columns for account linking
alter table financial_transactions 
add column if not exists account_id uuid references accounts(id) on delete cascade,
add column if not exists related_account_id uuid references accounts(id) on delete set null; -- For transfers

-- Update Type Check to include 'transfer'
-- Postgres doesn't easily allow altering check constraints, so we drop and re-add
alter table financial_transactions drop constraint if exists financial_transactions_type_check;
alter table financial_transactions add constraint financial_transactions_type_check 
    check (type in ('income', 'expense', 'transfer'));

-- 3. Migration Logic (Function to run once)
create or replace function migrate_finance_v2()
returns void
language plpgsql
as $$
declare
    business_account_id uuid;
    deposit_account_id uuid;
    user_record record;
begin
    -- Iterate over distinct users who have transactions but no accounts yet
    for user_record in 
        select distinct user_id 
        from financial_transactions 
        where account_id is null
    loop
        -- A. Create Default Business Account
        insert into accounts (user_id, name, context, type, is_default, color)
        values (user_record.user_id, 'Conta Empresa', 'business', 'general', true, 'blue')
        returning id into business_account_id;

        -- B. Create Deposit Fund Account (Fundo Caução)
        insert into accounts (user_id, name, context, type, is_default, color)
        values (user_record.user_id, 'Fundo Caução', 'business', 'deposit_fund', false, 'purple')
        returning id into deposit_account_id;

        -- C. Migrate Transactions
        -- 1. Standard Transactions -> Business Account
        update financial_transactions
        set account_id = business_account_id
        where user_id = user_record.user_id 
          and category != 'Caução' 
          and account_id is null;

        -- 2. Deposit Transactions -> Fundo Caução
        update financial_transactions
        set account_id = deposit_account_id
        where user_id = user_record.user_id 
          and category = 'Caução' 
          and account_id is null;
          
    end loop;
end;
$$;

-- Run migration
select migrate_finance_v2();

-- Drop migration function
drop function migrate_finance_v2();

-- Make account_id required for future (optional, might require cleanup first)
-- alter table financial_transactions alter column account_id set not null;
