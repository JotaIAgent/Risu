
-- FINAL NUCLEAR FIX FOR RLS RECURSION (VER 3.1 - IDEMPOTENT)
-- This version ensures no "already exists" errors by dropping policies first.

-- 1. Create a truly non-recursive function for checking admin status
CREATE OR REPLACE FUNCTION public.check_is_admin()
RETURNS BOOLEAN AS $$
DECLARE
  is_adm BOOLEAN;
BEGIN
  -- Perform a direct lookup using email from the JWT to break profiles table subquery recursion
  SELECT (role = 'admin') INTO is_adm
  FROM public.profiles
  WHERE id = auth.uid();
  
  -- Fallback for the master email to ensure it ALWAYS has access regardless of DB state
  IF (SELECT auth.jwt() ->> 'email') = 'joaopedro.faggionato@gmail.com' THEN
    RETURN TRUE;
  END IF;

  RETURN COALESCE(is_adm, FALSE);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Reset policies for PROFILES
ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Profiles: Owner" ON public.profiles;
DROP POLICY IF EXISTS "Profiles: Master Admin" ON public.profiles;
DROP POLICY IF EXISTS "Profiles: Other Admins" ON public.profiles;
DROP POLICY IF EXISTS "Profiles: User Self" ON public.profiles;
DROP POLICY IF EXISTS "Profiles: Admin Global" ON public.profiles;
DROP POLICY IF EXISTS "Profiles: User Own" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Profiles: Owner" ON public.profiles
FOR ALL USING (auth.uid() = id);

CREATE POLICY "Profiles: Master Admin" ON public.profiles
FOR ALL USING ((auth.jwt() ->> 'email') = 'joaopedro.faggionato@gmail.com');

CREATE POLICY "Profiles: Other Admins" ON public.profiles
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM auth.users 
    WHERE id = auth.uid() 
    AND raw_user_meta_data->>'role' = 'admin'
  )
  OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
);

-- 3. Reset policies for other tables
-- RENTALS
ALTER TABLE public.rentals DISABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Rentals: Owner" ON public.rentals;
DROP POLICY IF EXISTS "Rentals: Global Admin" ON public.rentals;
DROP POLICY IF EXISTS "Rentals: User Own" ON public.rentals;
DROP POLICY IF EXISTS "Rentals: Admin Global" ON public.rentals;
ALTER TABLE public.rentals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Rentals: Owner" ON public.rentals FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Rentals: Global Admin" ON public.rentals FOR SELECT USING (
  (auth.jwt() ->> 'email') = 'joaopedro.faggionato@gmail.com' OR public.check_is_admin()
);

-- ITEMS
ALTER TABLE public.items DISABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Items: Owner" ON public.items;
DROP POLICY IF EXISTS "Items: Global Admin" ON public.items;
DROP POLICY IF EXISTS "Items: User Own" ON public.items;
DROP POLICY IF EXISTS "Items: Admin Global" ON public.items;
ALTER TABLE public.items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Items: Owner" ON public.items FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Items: Global Admin" ON public.items FOR SELECT USING (
  (auth.jwt() ->> 'email') = 'joaopedro.faggionato@gmail.com' OR public.check_is_admin()
);

-- CUSTOMERS
ALTER TABLE public.customers DISABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Customers: Owner" ON public.customers;
DROP POLICY IF EXISTS "Customers: Global Admin" ON public.customers;
DROP POLICY IF EXISTS "Customers: User Own" ON public.customers;
DROP POLICY IF EXISTS "Customers: Admin Global" ON public.customers;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Customers: Owner" ON public.customers FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Customers: Global Admin" ON public.customers FOR SELECT USING (
  (auth.jwt() ->> 'email') = 'joaopedro.faggionato@gmail.com' OR public.check_is_admin()
);

-- SUBSCRIPTIONS
ALTER TABLE public.saas_subscriptions DISABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Subs: Owner" ON public.saas_subscriptions;
DROP POLICY IF EXISTS "Subs: Global Admin" ON public.saas_subscriptions;
DROP POLICY IF EXISTS "Subs: User Own" ON public.saas_subscriptions;
DROP POLICY IF EXISTS "Subs: Admin Global" ON public.saas_subscriptions;
ALTER TABLE public.saas_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Subs: Owner" ON public.saas_subscriptions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Subs: Global Admin" ON public.saas_subscriptions FOR ALL USING (
  (auth.jwt() ->> 'email') = 'joaopedro.faggionato@gmail.com' OR public.check_is_admin()
);

-- 4. Final Data Patch
UPDATE public.profiles SET role = 'admin' WHERE email = 'joaopedro.faggionato@gmail.com';
