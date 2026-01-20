-- Fix Schema: Ensure all new columns for Rental Form exist
-- This script adds columns if they are missing to prevent "Error creating rental"

-- 1. Logistics and Dates
ALTER TABLE public.rentals
ADD COLUMN IF NOT EXISTS delivery_time TIME,
ADD COLUMN IF NOT EXISTS return_time TIME,
ADD COLUMN IF NOT EXISTS custom_due_date DATE;

-- 2. Security Deposit (Caução)
ALTER TABLE public.rentals
ADD COLUMN IF NOT EXISTS security_deposit_value numeric(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS security_deposit_status text DEFAULT 'PENDING';
-- Optional check constraint for status?
-- ALTER TABLE public.rentals DROP CONSTRAINT IF EXISTS security_status_check;
-- ALTER TABLE public.rentals ADD CONSTRAINT security_status_check CHECK (security_deposit_status IN ('PENDING', 'PAID', 'RETURNED', 'NONE'));

-- 3. Fees (Damage/Lost/Late)
ALTER TABLE public.rentals
ADD COLUMN IF NOT EXISTS damage_fee numeric(10,2) DEFAULT 0;

-- 4. Ensure rental_items have fine columns (just in case)
ALTER TABLE public.rental_items
ADD COLUMN IF NOT EXISTS lost_fine numeric(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS damage_fine numeric(10,2) DEFAULT 0;

-- 5. Ensure items table has fine columns
ALTER TABLE public.items
ADD COLUMN IF NOT EXISTS lost_fine numeric(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS damage_fine numeric(10,2) DEFAULT 0;
