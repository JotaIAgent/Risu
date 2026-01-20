
-- Migration: Add direction to whatsapp_logs and support incoming messages
-- This allows distinguishing between messages sent by the system/user and messages received from the customer.

ALTER TABLE public.whatsapp_logs 
ADD COLUMN IF NOT EXISTS direction TEXT DEFAULT 'outgoing'; -- 'outgoing' (sent) or 'incoming' (received)

-- Update existing logs to be 'outgoing'
UPDATE public.whatsapp_logs SET direction = 'outgoing' WHERE direction IS NULL;

-- Ensure RLS allows the system (or users) to insert incoming messages if needed
-- (Usually handled by a service role or a webhook function)
