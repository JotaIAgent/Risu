-- Migration: Add granular dates for advanced scheduling
-- Goal: Friday Delivery, Saturday Event, Sunday Return logic

ALTER TABLE public.rentals ADD COLUMN IF NOT EXISTS delivery_date DATE;
ALTER TABLE public.rentals ADD COLUMN IF NOT EXISTS event_date DATE;
ALTER TABLE public.rentals ADD COLUMN IF NOT EXISTS return_date DATE;

-- BACKFILL: Synchronize with existing start/end dates
-- For existing rentals, we assume:
-- delivery_date = start_date
-- event_date = start_date
-- return_date = end_date
UPDATE public.rentals 
SET 
    delivery_date = COALESCE(delivery_date, start_date),
    event_date = COALESCE(event_date, start_date),
    return_date = COALESCE(return_date, end_date)
WHERE delivery_date IS NULL OR event_date IS NULL OR return_date IS NULL;
