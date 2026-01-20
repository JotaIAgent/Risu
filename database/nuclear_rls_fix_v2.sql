
-- COMPLETE NUCLEAR FIX FOR RLS RECURSION (VER 2.0)
-- This script covers ALL tables to ensure no recursive loops remain.

-- 1. Create/Update the security definer function (The "Key" to speed)
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

-- 2. Drop all policies that might cause recursion across all tables
-- PROFILES
DROP POLICY IF EXISTS "Profiles: Users can view self" ON public.profiles;
DROP POLICY IF EXISTS "Profiles: Admins can view all" ON public.profiles;
DROP POLICY IF EXISTS "Profiles: Admins can update all" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;

-- ITEMS
DROP POLICY IF EXISTS "Items: Users can manage own" ON public.items;
DROP POLICY IF EXISTS "Items: Admins can view all" ON public.items;
DROP POLICY IF EXISTS "Users can view their own items" ON public.items;
DROP POLICY IF EXISTS "Admins can view all items" ON public.items;

-- CUSTOMERS
DROP POLICY IF EXISTS "Customers: Users can manage own" ON public.customers;
DROP POLICY IF EXISTS "Customers: Admins can view all" ON public.customers;
DROP POLICY IF EXISTS "Users can view their own customers" ON public.customers;
DROP POLICY IF EXISTS "Admins can view all customers" ON public.customers;

-- RENTALS
DROP POLICY IF EXISTS "Rentals: Users can manage own" ON public.rentals;
DROP POLICY IF EXISTS "Rentals: Admins can view all" ON public.rentals;
DROP POLICY IF EXISTS "Users can view their own rentals" ON public.rentals;
DROP POLICY IF EXISTS "Admins can view all rentals" ON public.rentals;

-- SUBSCRIPTIONS
DROP POLICY IF EXISTS "Users can view their own subscription" ON public.saas_subscriptions;
DROP POLICY IF EXISTS "Admins can manage all subscriptions" ON public.saas_subscriptions;

-- SUPPORT TICKETS
DROP POLICY IF EXISTS "Users can see their own tickets" ON public.saas_support_tickets;
DROP POLICY IF EXISTS "Users can create tickets" ON public.saas_support_tickets;
DROP POLICY IF EXISTS "Admins can manage all tickets" ON public.saas_support_tickets;

-- ADMIN LOGS
DROP POLICY IF EXISTS "Only admins can see logs" ON public.saas_admin_logs;

-- 3. Apply NEW Safe Policies using the function

-- PROFILES
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Profiles: User Self" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Profiles: Admin Global" ON public.profiles FOR ALL USING (public.check_is_admin(auth.uid()));

-- ITEMS
ALTER TABLE public.items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Items: User Own" ON public.items FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Items: Admin Global" ON public.items FOR SELECT USING (public.check_is_admin(auth.uid()));

-- CUSTOMERS
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Customers: User Own" ON public.customers FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Customers: Admin Global" ON public.customers FOR SELECT USING (public.check_is_admin(auth.uid()));

-- RENTALS
ALTER TABLE public.rentals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Rentals: User Own" ON public.rentals FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Rentals: Admin Global" ON public.rentals FOR SELECT USING (public.check_is_admin(auth.uid()));

-- SUBSCRIPTIONS
ALTER TABLE public.saas_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Subs: User Own" ON public.saas_subscriptions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Subs: Admin Global" ON public.saas_subscriptions FOR ALL USING (public.check_is_admin(auth.uid()));

-- SUPPORT TICKETS
ALTER TABLE public.saas_support_tickets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tickets: User Own" ON public.saas_support_tickets FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Tickets: Admin Global" ON public.saas_support_tickets FOR ALL USING (public.check_is_admin(auth.uid()));

-- ADMIN LOGS
ALTER TABLE public.saas_admin_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Logs: Admin Global" ON public.saas_admin_logs FOR SELECT USING (public.check_is_admin(auth.uid()));

-- 4. Final Data Integrity (Fix Master Email)
UPDATE public.profiles SET role = 'admin' WHERE email = 'joaopedro.faggionato@gmail.com';
