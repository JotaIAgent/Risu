-- ==============================================================================
-- DECOUPLE PAYMENT GATEWAYS
-- This script renames Stripe-specific columns to generic gateway columns
-- to support multiple providers (ASAAS, Mercado Pago, etc.)
-- ==============================================================================

-- 1. Rename columns
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'saas_subscriptions' AND column_name = 'stripe_customer_id') THEN
        ALTER TABLE public.saas_subscriptions RENAME COLUMN stripe_customer_id TO gateway_customer_id;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'saas_subscriptions' AND column_name = 'stripe_subscription_id') THEN
        ALTER TABLE public.saas_subscriptions RENAME COLUMN stripe_subscription_id TO gateway_subscription_id;
    END IF;
END $$;

-- 2. Add gateway_name column
ALTER TABLE public.saas_subscriptions 
ADD COLUMN IF NOT EXISTS gateway_name text DEFAULT 'stripe';

-- 3. Update comments/documentation (optional but helpful)
COMMENT ON COLUMN public.saas_subscriptions.gateway_customer_id IS 'ID reference for the customer in the payment gateway (Stripe, ASAAS, etc)';
COMMENT ON COLUMN public.saas_subscriptions.gateway_subscription_id IS 'ID reference for the subscription/invoice in the payment gateway';
COMMENT ON COLUMN public.saas_subscriptions.gateway_name IS 'The active gateway used for this subscription (e.g., stripe, asaas, mercadopago)';
