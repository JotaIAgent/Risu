-- Migration: Add shipping_cost column to rentals
-- Goal: Allow tracking of delivery fees independently

ALTER TABLE public.rentals ADD COLUMN IF NOT EXISTS shipping_cost NUMERIC(10,2) DEFAULT 0;

-- Optional: Update existing rentals to have 0 if needed (though DEFAULT 0 handles it)
UPDATE public.rentals SET shipping_cost = 0 WHERE shipping_cost IS NULL;
