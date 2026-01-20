-- Create lost_logs table to track batches of lost/broken items
CREATE TABLE IF NOT EXISTS public.lost_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) NOT NULL,
    item_id UUID REFERENCES public.items(id) ON DELETE CASCADE NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1,
    entry_date TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()),
    status TEXT DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'CLOSED')),
    resolution TEXT CHECK (resolution IN ('FOUND', 'REPAIRED')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now())
);

-- Enable RLS
ALTER TABLE public.lost_logs ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can manage their own lost logs" 
    ON public.lost_logs 
    FOR ALL 
    USING (auth.uid() = user_id);

-- Index for open logs
CREATE INDEX IF NOT EXISTS idx_lost_logs_open ON public.lost_logs (item_id) WHERE (status = 'OPEN');
