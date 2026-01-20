
-- NUCLEAR FIX FOR RLS RECURSION (VER 4.0 - THE DEFINITIVE ONE)
-- This version eliminates ALL subqueries to public.profiles within policies to stop recursion.

-- 1. Reset everything
ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Profiles: Owner" ON public.profiles;
DROP POLICY IF EXISTS "Profiles: Master Admin" ON public.profiles;
DROP POLICY IF EXISTS "Profiles: Other Admins" ON public.profiles;
DROP POLICY IF EXISTS "Profiles: User Self" ON public.profiles;
DROP POLICY IF EXISTS "Profiles: Admin Global" ON public.profiles;
DROP POLICY IF EXISTS "Profiles: User Own" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;

-- 2. RE-ENABLE RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 3. APPLY NON-RECURSIVE POLICIES
-- Policy A: Every user can see and update their own profile (ZERO RECURSION)
CREATE POLICY "profiles_self_access" ON public.profiles
FOR ALL USING (auth.uid() = id);

-- Policy B: Master Admin bypass using JWT (ZERO RECURSION)
-- This uses the email straight from the login token, bypassing any table lookups.
CREATE POLICY "profiles_master_admin_access" ON public.profiles
FOR ALL USING (
  (auth.jwt() ->> 'email') = 'joaopedro.faggionato@gmail.com'
);

-- 4. APPLY SAFE GLOBAL POLICIES FOR OTHER TABLES
-- RENTALS
ALTER TABLE public.rentals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Rentals: Owner" ON public.rentals;
DROP POLICY IF EXISTS "Rentals: Global Admin" ON public.rentals;
CREATE POLICY "rentals_owner_access" ON public.rentals FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "rentals_admin_access" ON public.rentals FOR SELECT USING (
  (auth.jwt() ->> 'email') = 'joaopedro.faggionato@gmail.com'
);

-- ITEMS
ALTER TABLE public.items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Items: Owner" ON public.items;
DROP POLICY IF EXISTS "Items: Global Admin" ON public.items;
CREATE POLICY "items_owner_access" ON public.items FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "items_admin_access" ON public.items FOR SELECT USING (
  (auth.jwt() ->> 'email') = 'joaopedro.faggionato@gmail.com'
);

-- CUSTOMERS
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Customers: Owner" ON public.customers;
DROP POLICY IF EXISTS "Customers: Global Admin" ON public.customers;
CREATE POLICY "customers_owner_access" ON public.customers FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "customers_admin_access" ON public.customers FOR SELECT USING (
  (auth.jwt() ->> 'email') = 'joaopedro.faggionato@gmail.com'
);

-- 5. FINAL DATA PATCH
-- Ensure the role is correct in the table (for frontend use)
UPDATE public.profiles SET role = 'admin' WHERE email = 'joaopedro.faggionato@gmail.com';
