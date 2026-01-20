-- SUPPORT & FEEDBACK MODULE SCHEMA

-- 1. SUPPORT TICKETS TABLE
create table if not exists public.support_tickets (
    id uuid default gen_random_uuid() primary key,
    
    -- User Context
    user_id uuid references public.profiles(id) on delete set null,
    company_name text, -- Denormalized for easier querying
    
    -- Ticket Content
    category text not null check (category in ('duvida', 'erro', 'financeiro', 'uso', 'outro')),
    subject text not null,
    description text not null,
    
    -- Status & Priority
    priority text not null default 'medium' check (priority in ('low', 'medium', 'high')),
    status text not null default 'open' check (status in ('open', 'in_progress', 'waiting_user', 'resolved', 'closed')),
    
    -- SLAs & Metrics
    sla_due_at timestamptz,
    churn_risk_flag boolean default false,
    satisfaction_score integer check (satisfaction_score between 1 and 5),
    
    -- Timestamps
    created_at timestamptz default timezone('utc'::text, now()) not null,
    updated_at timestamptz default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table public.support_tickets enable row level security;

-- Policies
create policy "Users can view their own tickets"
on public.support_tickets for select
using (auth.uid() = user_id);

create policy "Users can insert their own tickets"
on public.support_tickets for insert
with check (auth.uid() = user_id);

create policy "Users can update their own tickets (rating/closing)"
on public.support_tickets for update
using (auth.uid() = user_id);

create policy "Admins can view all tickets"
on public.support_tickets for select
using (
    auth.jwt() ->> 'email' = 'joaopedro.faggionato@gmail.com' 
    or (select role from public.profiles where id = auth.uid()) = 'admin'
);

create policy "Admins can update all tickets"
on public.support_tickets for update
using (
    auth.jwt() ->> 'email' = 'joaopedro.faggionato@gmail.com'
    or (select role from public.profiles where id = auth.uid()) = 'admin'
);


-- 2. SUPPORT MESSAGES TABLE (Chat History)
create table if not exists public.support_messages (
    id uuid default gen_random_uuid() primary key,
    ticket_id uuid references public.support_tickets(id) on delete cascade not null,
    sender_id uuid references public.profiles(id) on delete set null,
    
    message text not null,
    attachments text[], -- Array of URLs
    is_internal_note boolean default false, -- Visible only to admins
    
    created_at timestamptz default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table public.support_messages enable row level security;

-- Policies
create policy "Users can view messages of their tickets (excluding internal notes)"
on public.support_messages for select
using (
    (select user_id from public.support_tickets where id = ticket_id) = auth.uid()
    and is_internal_note = false
);

create policy "Users can send messages to their tickets"
on public.support_messages for insert
with check (
    (select user_id from public.support_tickets where id = ticket_id) = auth.uid()
    and is_internal_note = false
);

create policy "Admins can view all messages"
on public.support_messages for select
using (
    auth.jwt() ->> 'email' = 'joaopedro.faggionato@gmail.com'
    or (select role from public.profiles where id = auth.uid()) = 'admin'
);

create policy "Admins can insert messages/notes"
on public.support_messages for insert
with check (
    auth.jwt() ->> 'email' = 'joaopedro.faggionato@gmail.com'
    or (select role from public.profiles where id = auth.uid()) = 'admin'
);


-- 3. PRODUCT SUGGESTIONS TABLE
create table if not exists public.product_suggestions (
    id uuid default gen_random_uuid() primary key,
    
    user_id uuid references public.profiles(id) on delete set null,
    company_name text,
    
    type text not null check (type in ('new_feature', 'improvement', 'integration', 'other')),
    description text not null,
    
    -- Impact Assessment
    perceived_impact text not null default 'medium' check (perceived_impact in ('low', 'medium', 'high')),
    admin_impact text default 'low' check (admin_impact in ('low', 'medium', 'high')),
    
    -- Status
    status text not null default 'new' check (status in ('new', 'analyzing', 'planned', 'implemented', 'rejected')),
    
    admin_response text, -- Public response to user
    
    created_at timestamptz default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table public.product_suggestions enable row level security;

-- Policies
create policy "Users can view their own suggestions"
on public.product_suggestions for select
using (auth.uid() = user_id);

create policy "Users can create suggestions"
on public.product_suggestions for insert
with check (auth.uid() = user_id);

create policy "Admins can view and manage all suggestions"
on public.product_suggestions for all
using (
    auth.jwt() ->> 'email' = 'joaopedro.faggionato@gmail.com'
    or (select role from public.profiles where id = auth.uid()) = 'admin'
);

-- 4. INDEXES FOR PERFORMANCE
create index if not exists idx_tickets_user_id on public.support_tickets(user_id);
create index if not exists idx_tickets_status on public.support_tickets(status);
create index if not exists idx_messages_ticket_id on public.support_messages(ticket_id);
create index if not exists idx_suggestions_status on public.product_suggestions(status);

-- 5. TRIGGER FOR SLA CALCULATION (Simple logic)
create or replace function calculate_sla_due()
returns trigger as $$
begin
    -- Only set SLA on creation if not provided
    if NEW.sla_due_at is null then
        if NEW.priority = 'high' then
            NEW.sla_due_at := now() + interval '4 hours';
        elsif NEW.priority = 'medium' then
            NEW.sla_due_at := now() + interval '24 hours';
        else
            NEW.sla_due_at := now() + interval '48 hours';
        end if;
    end if;
    return NEW;
end;
$$ language plpgsql;

create trigger set_sla_on_ticket_insert
before insert on public.support_tickets
for each row execute procedure calculate_sla_due();
