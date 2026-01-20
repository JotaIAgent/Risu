
-- NUCLEAR FIX FOR RLS RECURSION AND INFINITE LOADING
-- Run this in the Supabase SQL Editor

-- 1. Create a security definer function to check admin role without RLS recursion
CREATE OR REPLACE FUNCTION public.check_is_admin(user_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM public.profiles 
    WHERE id = user_uuid 
    AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Disable RLS temporarily to avoid conflicts during reset
ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.items DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.rentals DISABLE ROW LEVEL SECURITY;

-- 3. Drop all problematic policies
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can view their own items" ON public.items;
DROP POLICY IF EXISTS "Admins can view all items" ON public.items;
DROP POLICY IF EXISTS "Users can view their own customers" ON public.customers;
DROP POLICY IF EXISTS "Admins can view all customers" ON public.customers;
DROP POLICY IF EXISTS "Users can view their own rentals" ON public.rentals;
DROP POLICY IF EXISTS "Admins can view all rentals" ON public.rentals;

-- 4. Re-enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rentals ENABLE ROW LEVEL SECURITY;

-- 5. Create new SAFE policies for PROFILES
CREATE POLICY "Profiles: Users can view self" ON public.profiles
FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Profiles: Admins can view all" ON public.profiles
FOR SELECT USING (public.check_is_admin(auth.uid()));

CREATE POLICY "Profiles: Admins can update all" ON public.profiles
FOR UPDATE USING (public.check_is_admin(auth.uid()));

-- 6. Create new SAFE policies for ITEMS
CREATE POLICY "Items: Users can manage own" ON public.items
FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Items: Admins can view all" ON public.items
FOR SELECT USING (public.check_is_admin(auth.uid()));

-- 7. Create new SAFE policies for CUSTOMERS
CREATE POLICY "Customers: Users can manage own" ON public.customers
FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Customers: Admins can view all" ON public.customers
FOR SELECT USING (public.check_is_admin(auth.uid()));

-- 8. Create new SAFE policies for RENTALS
CREATE POLICY "Rentals: Users can manage own" ON public.rentals
FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Rentals: Admins can view all" ON public.rentals
FOR SELECT USING (public.check_is_admin(auth.uid()));

-- 9. Force Admin Role for the Master Email (Just in case)
UPDATE public.profiles 
SET role = 'admin' 
WHERE email = 'joaopedro.faggionato@gmail.com';
