
-- NUCLEAR SECURITY & MULTITENANCY FIX (VER 7.0 - THE SEAL)
-- This script fixes the RPC data leak and enforces strict isolation.

-- 1. FIX THE VULNERABLE RPC FUNCTION (Customers List)
-- We add 'user_id' filtering to ensure multitenancy even with SECURITY DEFINER.
CREATE OR REPLACE FUNCTION get_customers_with_stats_v2()
RETURNS TABLE (
  id uuid,
  created_at timestamptz,
  name text,
  email text,
  whatsapp text,
  cpf text,
  customer_city text,
  customer_state text,
  observations text,
  is_vip boolean,
  total_rentals bigint,
  last_rental_date date,
  total_spent numeric,
  outstanding_balance numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.id,
    c.created_at,
    c.name,
    c.email,
    c.whatsapp,
    c.cpf,
    c.customer_city,
    c.customer_state,
    c.observations,
    c.is_vip,
    COUNT(r.id) AS total_rentals,
    MAX(r.start_date) AS last_rental_date,
    COALESCE(SUM(r.total_value) FILTER (WHERE r.status != 'canceled'), 0) AS total_spent,
    COALESCE(SUM(r.total_value - COALESCE(r.down_payment, 0)) FILTER (WHERE r.status != 'canceled' AND (r.total_value - COALESCE(r.down_payment, 0)) > 0.01), 0) AS outstanding_balance
  FROM customers c
  LEFT JOIN rentals r ON c.id = r.client_id
  WHERE 
    -- MULTITENANCY FILTER
    c.user_id = auth.uid() 
    OR 
    -- MASTER ADMIN EXCEPTION
    (auth.jwt() ->> 'email') = 'joaopedro.faggionato@gmail.com'
  GROUP BY c.id;
END;
$$;

-- 2. DYNAMIC CLEANUP: Drop ALL policies from ALL tables in 'public' schema (Again, for good measure)
DO $$ 
DECLARE 
    tbl record;
    pol record;
BEGIN 
    FOR tbl IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') 
    LOOP
        FOR pol IN (SELECT policyname FROM pg_policies WHERE tablename = tbl.tablename AND schemaname = 'public') 
        LOOP 
            EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, tbl.tablename); 
        END LOOP; 
    END LOOP; 
END $$;

-- 3. RESET RLS ON ALL TABLES
DO $$ 
DECLARE 
    tbl record;
BEGIN 
    FOR tbl IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') 
    LOOP
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tbl.tablename); 
    END LOOP; 
END $$;

-- 4. APPLY GLOBAL MULTITENANCY SHIELD
DO $$ 
DECLARE 
    tbl record;
BEGIN 
    FOR tbl IN (
        SELECT table_name 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND column_name = 'user_id'
        AND table_name NOT IN ('profiles')
    ) 
    LOOP
        EXECUTE format('CREATE POLICY %I_owner_policy ON public.%I FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)', tbl.table_name, tbl.table_name);
        EXECUTE format('CREATE POLICY %I_master_admin_view ON public.%I FOR SELECT USING ((auth.jwt() ->> ''email'') = ''joaopedro.faggionato@gmail.com'')', tbl.table_name, tbl.table_name);
    END LOOP; 
END $$;

-- 5. SPECIAL CASE: PROFILES
CREATE POLICY "profiles_owner_policy" ON public.profiles FOR ALL USING (auth.uid() = id);
CREATE POLICY "profiles_master_admin_policy" ON public.profiles FOR ALL USING ((auth.jwt() ->> 'email') = 'joaopedro.faggionato@gmail.com');

-- 6. FINAL DATA QUALITY CHECK
UPDATE public.profiles SET role = 'admin' WHERE email = 'joaopedro.faggionato@gmail.com';
UPDATE public.profiles SET role = 'user' WHERE email != 'joaopedro.faggionato@gmail.com';
