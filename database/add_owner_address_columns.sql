
-- Migration: Add owner address columns to user_settings
-- This script adds columns to store the company's address for pickups.

ALTER TABLE public.user_settings 
ADD COLUMN IF NOT EXISTS owner_cep text,
ADD COLUMN IF NOT EXISTS owner_street text,
ADD COLUMN IF NOT EXISTS owner_number text,
ADD COLUMN IF NOT EXISTS owner_complement text,
ADD COLUMN IF NOT EXISTS owner_neighborhood text,
ADD COLUMN IF NOT EXISTS owner_city text,
ADD COLUMN IF NOT EXISTS owner_state text;
