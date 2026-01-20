-- FIX: Relax status constraint and fix trial trigger
-- Run this in Supabase SQL Editor

-- 1. Identify and drop the status check constraint
-- Since the name might vary, we find it first and drop it.
DO $$
DECLARE
    constraint_name_var text;
BEGIN
    SELECT conname INTO constraint_name_var
    FROM pg_constraint
    WHERE conrelid = 'public.saas_subscriptions'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) LIKE '%status%';

    IF constraint_name_var IS NOT NULL THEN
        EXECUTE 'ALTER TABLE public.saas_subscriptions DROP CONSTRAINT ' || constraint_name_var;
    END IF;
END $$;

-- 2. Add the updated constraint including 'trialing' and 'incomplete'
ALTER TABLE public.saas_subscriptions 
ADD CONSTRAINT saas_subscriptions_status_check 
CHECK (status IN ('active', 'past_due', 'canceled', 'suspended', 'trialing', 'incomplete'));

-- 3. Update the handle_new_user trigger function
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- 3.1 Create Profile
  INSERT INTO public.profiles (
    id, email, role, full_name, person_type, tax_id, whatsapp, 
    company_name, city, state, terms_accepted, referral_source, 
    main_objective, company_size, account_type
  )
  VALUES (
    new.id, new.email, 'user',
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

  -- 3.2 Create Subscription (Default to 3 days from creation)
  INSERT INTO public.saas_subscriptions (
    user_id, status, plan_name, billing_cycle, amount_cents, current_period_end
  )
  VALUES (
    new.id, 
    'trialing',
    'Período de Teste',
    COALESCE(new.raw_user_meta_data->>'billing_cycle', 'monthly'),
    COALESCE((new.raw_user_meta_data->>'custom_amount_cents')::integer, 9990),
    new.created_at + interval '3 days'
  );

  -- 3.3 Create Tenant Settings
  INSERT INTO public.tenant_settings (user_id)
  VALUES (new.id)
  ON CONFLICT (user_id) DO NOTHING;

  -- 3.4 Create Default Account
  INSERT INTO public.accounts (user_id, name, type, is_default)
  VALUES (new.id, 'Caixa Principal', 'checking', true)
  ON CONFLICT DO NOTHING;

  RETURN new;
EXCEPTION WHEN OTHERS THEN
  -- We don't want to block signup, but we want to know what failed
  RAISE WARNING 'handle_new_user failed for user %: %', new.id, SQLERRM;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
