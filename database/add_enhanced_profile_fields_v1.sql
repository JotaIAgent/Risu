-- Migration: Add enhanced profile fields
-- This script adds fields for comprehensive tenant data collection and updates the automatic profile creation trigger.

-- 1. Add new columns to public.profiles
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
ADD COLUMN IF NOT EXISTS company_size text;

-- 2. Update the handle_new_user function to map auth metadata to profile columns
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
    company_size
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
    new.raw_user_meta_data->>'company_size'
  );
  
  -- Create initial subscription
  INSERT INTO public.saas_subscriptions (user_id, status)
  VALUES (new.id, 'active');
  
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Note: The trigger 'on_auth_user_created' already exists from create_admin_schema.sql
-- and points to this function, so no need to recreate the trigger.
