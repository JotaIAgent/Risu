
-- Migration: Add city column to customers
-- Allows filtering and categorization of customers by location.

ALTER TABLE public.customers 
ADD COLUMN IF NOT EXISTS city text;
