
-- 1. Enable Global Visibility for Admins on Items
DROP POLICY IF EXISTS "Admins can view all items" ON public.items;
CREATE POLICY "Admins can view all items" ON public.items
FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- 2. Enable Global Visibility for Admins on Customers
DROP POLICY IF EXISTS "Admins can view all customers" ON public.customers;
CREATE POLICY "Admins can view all customers" ON public.customers
FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- 3. Enable Global Visibility for Admins on Rentals
DROP POLICY IF EXISTS "Admins can view all rentals" ON public.rentals;
CREATE POLICY "Admins can view all rentals" ON public.rentals
FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- 4. Ensure Admin can see all subscriptions for Finance metrics
DROP POLICY IF EXISTS "Admins can view all subscriptions" ON public.saas_subscriptions;
CREATE POLICY "Admins can view all subscriptions" ON public.saas_subscriptions
FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);
