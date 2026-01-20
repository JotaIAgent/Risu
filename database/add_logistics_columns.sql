
-- Migration: Add logistics columns to rentals
-- This script adds delivery_type and return_type columns to track how items are moved.

ALTER TABLE public.rentals 
ADD COLUMN IF NOT EXISTS delivery_type text DEFAULT 'pickup', -- 'pickup' (client comes) or 'delivery' (we deliver)
ADD COLUMN IF NOT EXISTS return_type text DEFAULT 'return'; -- 'return' (client returns) or 'collection' (we collect)

-- Add check constraints to ensure only valid types are used
ALTER TABLE public.rentals
DROP CONSTRAINT IF EXISTS check_delivery_type,
ADD CONSTRAINT check_delivery_type CHECK (delivery_type IN ('pickup', 'delivery'));

ALTER TABLE public.rentals
DROP CONSTRAINT IF EXISTS check_return_type,
ADD CONSTRAINT check_return_type CHECK (return_type IN ('return', 'collection'));
