-- Migration: Add missing columns to user_settings
-- This script adds owner details and address columns required by the Profile page.

ALTER TABLE public.user_settings 
ADD COLUMN IF NOT EXISTS owner_name text,
ADD COLUMN IF NOT EXISTS owner_phone text,
ADD COLUMN IF NOT EXISTS owner_cpf_cnpj text,
ADD COLUMN IF NOT EXISTS owner_cep text,
ADD COLUMN IF NOT EXISTS owner_street text,
ADD COLUMN IF NOT EXISTS owner_number text,
ADD COLUMN IF NOT EXISTS owner_complement text,
ADD COLUMN IF NOT EXISTS owner_neighborhood text,
ADD COLUMN IF NOT EXISTS owner_city text,
ADD COLUMN IF NOT EXISTS owner_state text,
ADD COLUMN IF NOT EXISTS late_fee_type text DEFAULT 'percent',
ADD COLUMN IF NOT EXISTS late_fee_value numeric DEFAULT 0;
