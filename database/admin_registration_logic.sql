-- Migration: Add fields for Admin Manual Registration
-- This script adds columns to support specialized admin controls for user accounts.

-- 1. Add account_type to public.profiles
-- default is 'common' (standard user). 'premium' and 'partner' are for admin assignment.
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS account_type text CHECK (account_type IN ('common', 'premium', 'partner')) DEFAULT 'common';

-- 2. Add custom billing fields to public.saas_subscriptions
-- custom_amount_cents: Allows admin to override standard pricing
-- billing_cycle: 'monthly', 'quarterly', 'annual'
ALTER TABLE public.saas_subscriptions
ADD COLUMN IF NOT EXISTS custom_amount_cents integer,
ADD COLUMN IF NOT EXISTS billing_cycle text CHECK (billing_cycle IN ('monthly', 'quarterly', 'annual')) DEFAULT 'monthly';

-- 3. Update handle_new_user to respect initial metadata for account_type if provided (e.g. via Admin API)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
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
    account_type -- New field
  )
  VALUES (
    new.id, 
    new.email, 
    'user', -- role is always 'user' by default logic, admin can change later or via specific admin function
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
    COALESCE(new.raw_user_meta_data->>'account_type', 'common') -- Default to common
  );
  
  -- Create initial subscription
  INSERT INTO public.saas_subscriptions (
    user_id, 
    status,
    billing_cycle,
    amount_cents
  )
  VALUES (
    new.id, 
    'active',
    COALESCE(new.raw_user_meta_data->>'billing_cycle', 'monthly'),
    COALESCE((new.raw_user_meta_data->>'custom_amount_cents')::integer, 9990)
  );
  
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
