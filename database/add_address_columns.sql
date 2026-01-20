
-- Migration: Add address columns to rentals
-- This script adds columns to store the event/delivery address.

ALTER TABLE public.rentals 
ADD COLUMN IF NOT EXISTS address_cep text,
ADD COLUMN IF NOT EXISTS address_street text,
ADD COLUMN IF NOT EXISTS address_number text,
ADD COLUMN IF NOT EXISTS address_complement text,
ADD COLUMN IF NOT EXISTS address_neighborhood text,
ADD COLUMN IF NOT EXISTS address_city text,
ADD COLUMN IF NOT EXISTS address_state text;
