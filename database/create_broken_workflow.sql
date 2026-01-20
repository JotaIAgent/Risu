-- Add broken_quantity to items table
ALTER TABLE public.items 
ADD COLUMN IF NOT EXISTS broken_quantity INTEGER DEFAULT 0;

-- Create broken_logs table to track items that are broken but not yet in maintenance
CREATE TABLE IF NOT EXISTS public.broken_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) NOT NULL,
    item_id UUID REFERENCES public.items(id) ON DELETE CASCADE NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1,
    entry_date TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()),
    status TEXT DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'CLOSED')),
    closed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now())
);

-- Enable RLS
ALTER TABLE public.broken_logs ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can manage their own broken logs" 
    ON public.broken_logs 
    FOR ALL 
    USING (auth.uid() = user_id);

-- Add unique index for faster lookups on open logs
CREATE INDEX IF NOT EXISTS idx_broken_logs_open ON public.broken_logs (item_id) WHERE (status = 'OPEN');
