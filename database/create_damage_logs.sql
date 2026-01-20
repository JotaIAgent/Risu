
-- Migration: Create damage_logs table
-- Tracks specific damage occurrences linked to items, customers, and rentals.

CREATE TABLE IF NOT EXISTS public.damage_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) NOT NULL,
    rental_id UUID REFERENCES public.rentals(id) ON DELETE SET NULL,
    item_id UUID REFERENCES public.items(id) ON DELETE CASCADE NOT NULL,
    customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
    severity TEXT NOT NULL CHECK (severity IN ('partial', 'total')),
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now())
);

-- Enable RLS
ALTER TABLE public.damage_logs ENABLE ROW LEVEL SECURITY;

-- Policies
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'damage_logs' AND policyname = 'Users can manage their own damage logs'
    ) THEN
        CREATE POLICY "Users can manage their own damage logs" 
            ON public.damage_logs FOR ALL USING (auth.uid() = user_id);
    END IF;
END $$;
