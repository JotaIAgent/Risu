-- Migration: Split driver_id into delivery and collection drivers
-- This allows tracking who did the delivery separate from who did the collection.

ALTER TABLE public.rentals 
ADD COLUMN IF NOT EXISTS delivery_driver_id UUID REFERENCES public.drivers(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS collection_driver_id UUID REFERENCES public.drivers(id) ON DELETE SET NULL;

-- Create indices for performance
CREATE INDEX IF NOT EXISTS idx_rentals_delivery_driver_id ON public.rentals(delivery_driver_id);
CREATE INDEX IF NOT EXISTS idx_rentals_collection_driver_id ON public.rentals(collection_driver_id);

-- DATA MIGRATION Strategy:
-- 1. If we have a 'driver_id', assume it's the delivery_driver (most common case).
-- 2. If the status implies collection phase (returning/returned) AND we have a driver_id, 
--    it implies the current driver_id MIGHT be the collector, but it's ambiguous.
--    Safe bet: specific mapping or just copy to delivery for now to preserve "Responsible".

-- Migrating existing driver_id to delivery_driver_id as a baseline
UPDATE public.rentals 
SET delivery_driver_id = driver_id 
WHERE driver_id IS NOT NULL AND delivery_driver_id IS NULL;

-- Note: We are NOT dropping 'driver_id' yet to prevent breaking other legacy logic instantly, 
-- but frontend will switch to using the new columns.
