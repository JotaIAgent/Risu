-- Migration: Agenda Structure Update
-- Purpose: Add fields required for robust Agenda/Calendar operations.

-- 1. Payment Status Tracking
ALTER TABLE public.rentals
ADD COLUMN IF NOT EXISTS payment_status text DEFAULT 'pending' CHECK (payment_status IN ('pending', 'partial', 'paid')),
ADD COLUMN IF NOT EXISTS amount_paid numeric(10,2) DEFAULT 0.00;

-- 2. Event Date (Distinct from logistics dates)
-- If null, application should fallback to start_date.
ALTER TABLE public.rentals
ADD COLUMN IF NOT EXISTS event_date DATE;

-- 3. Logistics Status
-- pending: Nothing happened yet
-- to_deliver: Ready/Scheduled for delivery
-- delivered: Items are with the client
-- to_return: Ready/Scheduled for return
-- returned: Items are back in stock (logistics complete)
ALTER TABLE public.rentals
ADD COLUMN IF NOT EXISTS logistics_status text DEFAULT 'pending' CHECK (logistics_status IN ('pending', 'to_deliver', 'delivered', 'to_return', 'returned'));

-- 4. Update Policies (Ensure RLS covers new columns implicitly via existing table policies)
-- (No action needed usually if policies are on TABLE level, but good to verify availability)

-- 5. Backfill/Seed minimal data for existing records (Optional but recommended)
-- Assume all active rentals have 'pending' logistics if not set.
UPDATE public.rentals 
SET logistics_status = 'pending' 
WHERE logistics_status IS NULL;

-- Assume event_date = start_date for existing records to facilitate migration
UPDATE public.rentals
SET event_date = start_date
WHERE event_date IS NULL;
