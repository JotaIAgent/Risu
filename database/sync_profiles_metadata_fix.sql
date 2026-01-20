-- FIX: Sync missing profile data from auth.users metadata
-- Run this script to backfill data for users created before the trigger was updated.

-- 1. Ensure all columns exist (Safety Check)
ALTER TABLE public.profiles 
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
ADD COLUMN IF NOT EXISTS account_type text DEFAULT 'common';

-- 2. Force Update Profiles from Auth Metadata
-- This reads the JSON metadata from auth.users and updates the columns in valid public.profiles rows
UPDATE public.profiles p
SET
    person_type = (u.raw_user_meta_data->>'person_type'),
    tax_id = (u.raw_user_meta_data->>'tax_id'),
    whatsapp = (u.raw_user_meta_data->>'whatsapp'),
    company_name = (u.raw_user_meta_data->>'company_name'),
    city = (u.raw_user_meta_data->>'city'),
    state = (u.raw_user_meta_data->>'state'),
    terms_accepted = COALESCE((u.raw_user_meta_data->>'terms_accepted')::boolean, p.terms_accepted),
    referral_source = (u.raw_user_meta_data->>'referral_source'),
    main_objective = (u.raw_user_meta_data->>'main_objective'),
    company_size = (u.raw_user_meta_data->>'company_size'),
    account_type = COALESCE((u.raw_user_meta_data->>'account_type'), p.account_type, 'common')
FROM auth.users u
WHERE p.id = u.id;

-- 3. Re-Verify Trigger Function is up to date (Best Practice)
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
    account_type
  )
  VALUES (
    new.id, 
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
