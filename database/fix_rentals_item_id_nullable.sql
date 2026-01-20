-- Migration: Make item_id nullable in rentals table to support multi-item rentals (Quotes)
ALTER TABLE public.rentals ALTER COLUMN item_id DROP NOT NULL;
