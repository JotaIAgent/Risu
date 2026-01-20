-- Add columns to track late rental information when completing a rental
ALTER TABLE public.rentals 
ADD COLUMN IF NOT EXISTS was_late BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS days_late INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS late_fee_amount NUMERIC(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS actual_return_date DATE;
