
-- Migration: Add Operational Alerts Columns
-- Purpose: Track checklist status for rentals to trigger alerts.

ALTER TABLE public.rentals
ADD COLUMN IF NOT EXISTS checklist_status_out BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS checklist_status_in BOOLEAN DEFAULT FALSE;

-- Ensure broken_logs table exists (it should, but just in case)
CREATE TABLE IF NOT EXISTS public.broken_logs (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    item_id uuid REFERENCES public.items(id) NOT NULL,
    quantity integer NOT NULL DEFAULT 1,
    description text,
    status text DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'RESOLVED')),
    entry_date timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    user_id uuid REFERENCES auth.users(id)
);

-- Enable RLS for broken_logs
ALTER TABLE public.broken_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own broken logs" ON public.broken_logs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own broken logs" ON public.broken_logs FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own broken logs" ON public.broken_logs FOR UPDATE USING (auth.uid() = user_id);
