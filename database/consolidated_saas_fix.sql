-- ==============================================================================
-- CONSOLIDATED SAAS FIX SCRIPT (TRIAL & CHECKOUT)
-- This script fixes the schema and trigger logic to ensure:
-- 1. Correct 3-day trial activation for new users.
-- 2. Support for Stripe checkout (incomplete status).
-- 3. Presence of all columns required by the application code.
-- ==============================================================================

-- 1. ENSURE PROFILES SCHEMA
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS full_name text,
ADD COLUMN IF NOT EXISTS person_type text CHECK (person_type IN ('PF', 'PJ')),
ADD COLUMN IF NOT EXISTS tax_id text,
ADD COLUMN IF NOT EXISTS whatsapp text,
ADD COLUMN IF NOT EXISTS company_name text,
ADD COLUMN IF NOT EXISTS city text,
ADD COLUMN IF NOT EXISTS state text,
ADD COLUMN IF NOT EXISTS terms_accepted boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS referral_source text,
ADD COLUMN IF NOT EXISTS main_objective text,
ADD COLUMN IF NOT EXISTS company_size text,
ADD COLUMN IF NOT EXISTS account_type text DEFAULT 'common',
ADD COLUMN IF NOT EXISTS last_login_at timestamp with time zone;

-- 2. ENSURE SAAS_SUBSCRIPTIONS SCHEMA
ALTER TABLE public.saas_subscriptions 
ADD COLUMN IF NOT EXISTS plan_name text,
ADD COLUMN IF NOT EXISTS plan_type text DEFAULT 'mensal',
ADD COLUMN IF NOT EXISTS billing_cycle text DEFAULT 'monthly',
ADD COLUMN IF NOT EXISTS amount_cents integer DEFAULT 9990,
ADD COLUMN IF NOT EXISTS custom_amount_cents integer,
ADD COLUMN IF NOT EXISTS stripe_customer_id text,
ADD COLUMN IF NOT EXISTS stripe_subscription_id text,
ADD COLUMN IF NOT EXISTS payment_method text DEFAULT 'credit_card',
ADD COLUMN IF NOT EXISTS origin text DEFAULT 'site',
ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT timezone('utc'::text, now());

-- 3. FIX STATUS CONSTRAINT
-- First, get the constraint name for the status column (usually saas_subscriptions_status_check or similar)
DO $$
DECLARE
    const_name TEXT;
BEGIN
    SELECT conname INTO const_name
    FROM pg_constraint
    WHERE conrelid = 'public.saas_subscriptions'::regclass
      AND pg_get_constraintdef(oid) LIKE '%status%';
      
    IF const_name IS NOT NULL THEN
        EXECUTE 'ALTER TABLE public.saas_subscriptions DROP CONSTRAINT ' || const_name;
    END IF;
END $$;

-- Add the corrected constraint including 'trialing' and 'incomplete'
ALTER TABLE public.saas_subscriptions 
ADD CONSTRAINT saas_subscriptions_status_check 
CHECK (status IN ('active', 'past_due', 'canceled', 'suspended', 'trialing', 'incomplete', 'past_due_active'));

-- 4. CONSOLIDATED TRIGGER FUNCTION
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
    new_user_id UUID;
BEGIN
    new_user_id := new.id;

    -- A. Create Profile
    INSERT INTO public.profiles (
        id, 
        email, 
        role,
        full_name,
        person_type,
        tax_id,
        whatsapp,
        company_name,
        city,
        state,
        terms_accepted,
        referral_source,
        main_objective,
        company_size,
        account_type
    )
    VALUES (
        new_user_id, 
        new.email, 
        'user',
        new.raw_user_meta_data->>'full_name',
        new.raw_user_meta_data->>'person_type',
        new.raw_user_meta_data->>'tax_id',
        new.raw_user_meta_data->>'whatsapp',
        new.raw_user_meta_data->>'company_name',
        new.raw_user_meta_data->>'city',
        new.raw_user_meta_data->>'state',
        COALESCE((new.raw_user_meta_data->>'terms_accepted')::boolean, false),
        new.raw_user_meta_data->>'referral_source',
        new.raw_user_meta_data->>'main_objective',
        new.raw_user_meta_data->>'company_size',
        COALESCE(new.raw_user_meta_data->>'account_type', 'common')
    );
    
    -- B. Create 3-Day Trial Subscription
    INSERT INTO public.saas_subscriptions (
        user_id, 
        status,
        plan_name,
        billing_cycle,
        amount_cents,
        current_period_end,
        origin
    )
    VALUES (
        new_user_id, 
        'trialing',
        'Período de Teste',
        'monthly',
        9990,
        new.created_at + interval '3 days',
        'site'
    );
    
    -- C. Create Default Tenant Settings
    INSERT INTO public.tenant_settings (user_id)
    VALUES (new_user_id)
    ON CONFLICT (user_id) DO NOTHING;

    -- D. Create Default Financial Accounts
    -- Account 1: Enterprise
    INSERT INTO public.accounts (user_id, name, context, type, is_default, color, balance)
    VALUES (new_user_id, 'Conta Empresa', 'business', 'general', true, 'blue', 0)
    ON CONFLICT DO NOTHING;

    -- Account 2: Security Deposit
    INSERT INTO public.accounts (user_id, name, context, type, is_default, color, balance)
    VALUES (new_user_id, 'Fundo Caução', 'business', 'deposit_fund', false, 'purple', 0)
    ON CONFLICT DO NOTHING;

    -- Account 3: Personal
    INSERT INTO public.accounts (user_id, name, context, type, is_default, color, balance)
    VALUES (new_user_id, 'Conta Pessoal', 'personal', 'general', false, 'emerald', 0)
    ON CONFLICT DO NOTHING;
    
    RETURN new;
EXCEPTION WHEN OTHERS THEN
    -- Log partial failure but don't block the auth.user creation
    RAISE WARNING 'handle_new_user failed: %', SQLERRM;
    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. ENSURE TRIGGER IS ACTIVE
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 6. BACKFILL & FIX EXISTING USERS
-- A. Create missing subscriptions
INSERT INTO public.saas_subscriptions (user_id, status, plan_name, billing_cycle, amount_cents, current_period_end)
SELECT p.id, 'trialing', 'Período de Teste', 'monthly', 9990, p.created_at + interval '3 days'
FROM public.profiles p
LEFT JOIN public.saas_subscriptions s ON p.id = s.user_id
WHERE s.id IS NULL AND p.role = 'user'
ON CONFLICT DO NOTHING;

-- B. Force 'trialing' status for users created in last 3 days who are currently 'active' (old default)
UPDATE public.saas_subscriptions s
SET status = 'trialing',
    plan_name = 'Período de Teste',
    current_period_end = p.created_at + interval '3 days'
FROM public.profiles p
WHERE s.user_id = p.id
  AND p.created_at > now() - interval '3 days'
  AND s.status = 'active';

-- SELECT result
SELECT 'Consolidated fix applied! Try registering a new user OR check your trial now.' as message;
