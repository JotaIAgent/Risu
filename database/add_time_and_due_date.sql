-- Migration: Add Time and Due Date fields for Dashboard 2.0
-- Adds precision to logistics and flexibility to financial tracking.

ALTER TABLE public.rentals
ADD COLUMN IF NOT EXISTS delivery_time TIME,
ADD COLUMN IF NOT EXISTS return_time TIME,
ADD COLUMN IF NOT EXISTS custom_due_date DATE;

-- Comment: 
-- delivery_time: Time for the start of logistics (Delivery or Client Pickup)
-- return_time: Time for the end of logistics (Collection or Client Return)
-- custom_due_date: Overrides start_date as the payment due date if set.
