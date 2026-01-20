
-- Add event_end_date column to rentals table to support multi-day events
ALTER TABLE public.rentals ADD COLUMN IF NOT EXISTS event_end_date DATE;

-- BACKFILL: For existing rentals, event_end_date can be the same as event_date
UPDATE public.rentals 
SET event_end_date = event_date 
WHERE event_end_date IS NULL AND event_date IS NOT NULL;
