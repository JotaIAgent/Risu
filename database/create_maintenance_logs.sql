-- Create maintenance_logs table to track batches of items in maintenance
CREATE TABLE IF NOT EXISTS public.maintenance_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) NOT NULL,
    item_id UUID REFERENCES public.items(id) ON DELETE CASCADE NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1,
    entry_date TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()),
    status TEXT DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'CLOSED')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now())
);

-- Enable RLS
ALTER TABLE public.maintenance_logs ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can manage their own maintenance logs" 
    ON public.maintenance_logs 
    FOR ALL 
    USING (auth.uid() = user_id);

-- Add unique index for faster lookups on open logs
CREATE INDEX IF NOT EXISTS idx_maintenance_logs_open ON public.maintenance_logs (item_id) WHERE (status = 'OPEN');
