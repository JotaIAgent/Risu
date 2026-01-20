
-- NUCLEAR SECURITY & MULTITENANCY FIX (VER 6.0 - COMPREHENSIVE)
-- This script WIPES all ghost policies and enforces strict data isolation across ALL tables.

-- 1. DYNAMIC CLEANUP: Drop ALL policies from ALL tables in 'public' schema
DO $$ 
DECLARE 
    tbl record;
    pol record;
BEGIN 
    -- Loop through all tables in public schema
    FOR tbl IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') 
    LOOP
        FOR pol IN (SELECT policyname FROM pg_policies WHERE tablename = tbl.tablename AND schemaname = 'public') 
        LOOP 
            EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, tbl.tablename); 
        END LOOP; 
    END LOOP; 
END $$;

-- 2. ENFORCE RLS ON ALL CORE TABLES
DO $$ 
DECLARE 
    tbl record;
BEGIN 
    FOR tbl IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') 
    LOOP
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tbl.tablename); 
    END LOOP; 
END $$;

-- 3. APPLY STRICT MULTITENANCY RULES

-- Group A: Tables with 'user_id' column
DO $$ 
DECLARE 
    tbl record;
BEGIN 
    FOR tbl IN (
        SELECT table_name 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND column_name = 'user_id'
        AND table_name NOT IN ('profiles') -- Handles profiles separately below
    ) 
    LOOP
        -- Regular User Policy
        EXECUTE format('CREATE POLICY %I_owner_isolation ON public.%I FOR ALL USING (auth.uid() = user_id)', tbl.table_name, tbl.table_name);
        -- Master Admin Policy
        EXECUTE format('CREATE POLICY %I_master_admin_access ON public.%I FOR SELECT USING ((auth.jwt() ->> ''email'') = ''joaopedro.faggionato@gmail.com'')', tbl.table_name, tbl.table_name);
    END LOOP; 
END $$;

-- Group B: Special Tables (profiles, sub-tables)

-- PROFILES (Isolated by ID)
CREATE POLICY "profiles_owner_isolation" ON public.profiles FOR ALL USING (auth.uid() = id);
CREATE POLICY "profiles_master_admin_access" ON public.profiles FOR ALL USING ((auth.jwt() ->> 'email') = 'joaopedro.faggionato@gmail.com');

-- RENTAL_ITEMS & LOGS (Should be linked via RLS on parent if possible, but let's secure if user_id is missing)
-- Note: If some tables like 'rental_items' don't have 'user_id', we might need to add it or join, 
-- but for now, the most critical tables (customers, rentals, items) are covered by 'Group A'.

-- 4. FIX MASTER DATA & ROLE INTEGRITY
UPDATE public.profiles SET role = 'admin' WHERE email = 'joaopedro.faggionato@gmail.com';
UPDATE public.profiles SET role = 'user' WHERE email != 'joaopedro.faggionato@gmail.com';

-- 5. ENSURE RLS FOR SUBSCRIPTIONS & SUPPORT (They use user_id)
-- Already covered by the 'Group A' loop above.
