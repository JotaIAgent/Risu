
-- NUCLEAR FIX FOR RLS RECURSION (VER 5.0 - DYNAMIC CLEANUP)
-- This version FORCE-DROPS ALL policies on 'profiles' to be absolutely sure.

-- 1. Dynamic Cleanup of ALL policies on the profiles table
DO $$ 
DECLARE 
    pol record;
BEGIN 
    -- Drop every policy on 'profiles' table in 'public' schema
    FOR pol IN (SELECT policyname FROM pg_policies WHERE tablename = 'profiles' AND schemaname = 'public') 
    LOOP 
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.profiles', pol.policyname); 
    END LOOP; 
END $$;

-- 2. RESET RLS
ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 3. APPLY ONLY CLEAN, NON-RECURSIVE POLICIES
-- Rule 1: Self-access (ZERO recursion)
CREATE POLICY "profiles_self_access" ON public.profiles
FOR ALL USING (auth.uid() = id);

-- Rule 2: Master Admin bypass (ZERO recursion - uses JWT email only)
CREATE POLICY "profiles_master_admin_access" ON public.profiles
FOR ALL USING (
  (auth.jwt() ->> 'email') = 'joaopedro.faggionato@gmail.com'
);

-- 4. CLEANUP OTHER TABLES (RENTALS, ITEMS, CUSTOMERS)
-- We use the same logic: check JWT email for admin access.
ALTER TABLE public.rentals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "rentals_owner_access" ON public.rentals;
DROP POLICY IF EXISTS "rentals_admin_access" ON public.rentals;
CREATE POLICY "rentals_owner_access" ON public.rentals FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "rentals_admin_access" ON public.rentals FOR SELECT USING ((auth.jwt() ->> 'email') = 'joaopedro.faggionato@gmail.com');

ALTER TABLE public.items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "items_owner_access" ON public.items;
DROP POLICY IF EXISTS "items_admin_access" ON public.items;
CREATE POLICY "items_owner_access" ON public.items FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "items_admin_access" ON public.items FOR SELECT USING ((auth.jwt() ->> 'email') = 'joaopedro.faggionato@gmail.com');

ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "customers_owner_access" ON public.customers;
DROP POLICY IF EXISTS "customers_admin_access" ON public.customers;
CREATE POLICY "customers_owner_access" ON public.customers FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "customers_admin_access" ON public.customers FOR SELECT USING ((auth.jwt() ->> 'email') = 'joaopedro.faggionato@gmail.com');

-- 5. ENSURE MASTER DATA
UPDATE public.profiles SET role = 'admin' WHERE email = 'joaopedro.faggionato@gmail.com';
