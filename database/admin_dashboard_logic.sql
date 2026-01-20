
-- ADMIN DASHBOARD ANALYTICS LOGIC (VER 1.0)
-- This script prepares the DB for SaaS metrics like Churn and MRR trends.

-- 1. Add updated_at to track status changes (Critical for Churn logic)
ALTER TABLE public.saas_subscriptions 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now());

-- 2. Create trigger to update updated_at on change
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'UPDATE') THEN
    NEW.updated_at = now();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_saas_subscriptions_updated_at ON public.saas_subscriptions;
CREATE TRIGGER tr_saas_subscriptions_updated_at
  BEFORE UPDATE ON public.saas_subscriptions
  FOR EACH ROW EXECUTE PROCEDURE public.handle_updated_at();

-- 3. Ensure profiles has updated_at for activity feed consistency
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now());

DROP TRIGGER IF EXISTS tr_profiles_updated_at ON public.profiles;
CREATE TRIGGER tr_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE PROCEDURE public.handle_updated_at();
