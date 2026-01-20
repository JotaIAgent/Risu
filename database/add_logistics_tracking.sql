-- Migration: Add logistics tracking columns to rentals table
-- This script adds fields for detailed logistics management: status, driver, signature, and route order.

ALTER TABLE public.rentals 
ADD COLUMN IF NOT EXISTS logistics_status text DEFAULT 'pending', -- pending, in_transit, delivered, returned
ADD COLUMN IF NOT EXISTS driver_name text,
ADD COLUMN IF NOT EXISTS signature_url text,
ADD COLUMN IF NOT EXISTS delivery_order integer;

-- Index for faster filtering by status
CREATE INDEX IF NOT EXISTS idx_rentals_logistics_status ON public.rentals(logistics_status);
