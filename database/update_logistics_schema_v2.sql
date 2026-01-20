-- Migration: Logistics System Upgrade v2
-- 1. Create Drivers Table
-- 2. Update Rentals with detailed logistics status and driver association

-- 1. Create Drivers Table
CREATE TABLE IF NOT EXISTS public.drivers (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) NOT NULL, -- Owner of the record
    name TEXT NOT NULL,
    cpf TEXT,
    phone TEXT,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- RLS for Drivers
ALTER TABLE public.drivers ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'drivers' AND policyname = 'Users can manage their own drivers'
    ) THEN
        CREATE POLICY "Users can manage their own drivers"
            ON public.drivers FOR ALL
            USING (auth.uid() = user_id)
            WITH CHECK (auth.uid() = user_id);
    END IF;
END $$;

-- 2. Update Rentals Table
-- Add driver_id
ALTER TABLE public.rentals 
ADD COLUMN IF NOT EXISTS driver_id UUID REFERENCES public.drivers(id) ON DELETE SET NULL;

-- DATA MIGRATION: Update existing statuses to new format to avoid constraint violations
-- 1. Map known values
UPDATE public.rentals SET logistics_status = 'step_3_in_transit' WHERE logistics_status = 'in_transit';
UPDATE public.rentals SET logistics_status = 'step_4_delivered' WHERE logistics_status = 'delivered';
UPDATE public.rentals SET logistics_status = 'step_7_returned' WHERE logistics_status = 'returned';

-- 2. Catch-all: Set any other unknown value to 'pending' (the safe default)
UPDATE public.rentals 
SET logistics_status = 'pending' 
WHERE logistics_status NOT IN (
    'pending', 
    'step_1_preparation', 
    'step_2_to_deliver', 
    'step_3_in_transit', 
    'step_4_delivered', 
    'step_5_to_return', 
    'step_6_returning', 
    'step_7_returned'
);

-- Update logistics_status check constraint to support full lifecycle
-- First, drop existing constraint if it exists (generic name assumption)
ALTER TABLE public.rentals DROP CONSTRAINT IF EXISTS rentals_logistics_status_check;

-- Add new constraint with expanded statuses
ALTER TABLE public.rentals 
ADD CONSTRAINT rentals_logistics_status_check 
CHECK (logistics_status IN (
    'pending',              -- Legacy/Default
    'step_1_preparation',   -- A separar
    'step_2_to_deliver',    -- A entregar (Ready to go)
    'step_3_in_transit',    -- Em rota de entrega
    'step_4_delivered',     -- Entregue
    'step_5_to_return',     -- A retirar (Waiting for collection)
    'step_6_returning',     -- Em rota de devolução
    'step_7_returned'       -- Devolvido/Retirado
));

-- Create index for driver filtering
CREATE INDEX IF NOT EXISTS idx_rentals_driver_id ON public.rentals(driver_id);
