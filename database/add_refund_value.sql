-- Add refund_value column to rentals table
ALTER TABLE public.rentals 
ADD COLUMN IF NOT EXISTS refund_value NUMERIC DEFAULT 0;

-- Update existing records if necessary (optional)
-- UPDATE public.rentals SET refund_value = 0 WHERE refund_value IS NULL;
