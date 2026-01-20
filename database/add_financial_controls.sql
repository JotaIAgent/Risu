-- Migration: Add financial control fields to rentals
-- payment_status: PENDING, PARTIAL, PAID
-- security_deposit_value: The amount held as security
-- security_deposit_status: PENDING, PAID, RETURNED

ALTER TABLE public.rentals ADD COLUMN IF NOT EXISTS payment_status text DEFAULT 'PENDING' CHECK (payment_status IN ('PENDING', 'PARTIAL', 'PAID'));
ALTER TABLE public.rentals ADD COLUMN IF NOT EXISTS security_deposit_value numeric DEFAULT 0;
ALTER TABLE public.rentals ADD COLUMN IF NOT EXISTS security_deposit_status text DEFAULT 'PENDING' CHECK (security_deposit_status IN ('PENDING', 'PAID', 'RETURNED'));

-- Index for filtering
CREATE INDEX IF NOT EXISTS idx_rentals_payment_status ON public.rentals(payment_status);
