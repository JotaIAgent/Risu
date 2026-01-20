
-- NUCLEAR MULTITENANCY LOCK (VER 6.1)
-- This script WIPES all loose permissions and seals every account's data.

-- 1. FORCE CLEANUP: Drop every single policy in the public schema
DO $$ 
DECLARE 
    tbl record;
    pol record;
BEGIN 
    FOR tbl IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') 
    LOOP
        FOR pol IN (SELECT policyname FROM pg_policies WHERE tablename = tbl.tablename AND schemaname = 'public') 
        LOOP 
            -- We use a safe drop that doesn't care about dependencies
            EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, tbl.tablename); 
        END LOOP; 
    END LOOP; 
END $$;

-- 2. RESET RLS (Disable then Re-enable to clear state)
DO $$ 
DECLARE 
    tbl record;
BEGIN 
    FOR tbl IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') 
    LOOP
        EXECUTE format('ALTER TABLE public.%I DISABLE ROW LEVEL SECURITY', tbl.tablename); 
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tbl.tablename); 
    END LOOP; 
END $$;

-- 3. APPLY STRICT ISOLATION (USER_ID BASED)
DO $$ 
DECLARE 
    tbl record;
BEGIN 
    FOR tbl IN (
        SELECT table_name 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND column_name = 'user_id'
        AND table_name NOT IN ('profiles') -- Profiles uses 'id' instead of 'user_id'
    ) 
    LOOP
        -- OWNER ACCESS: Full access to own data
        EXECUTE format('CREATE POLICY %I_owner_policy ON public.%I FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)', tbl.table_name, tbl.table_name);
        
        -- MASTER ADMIN: Read-only global access
        EXECUTE format('CREATE POLICY %I_master_admin_view ON public.%I FOR SELECT USING ((auth.jwt() ->> ''email'') = ''joaopedro.faggionato@gmail.com'')', tbl.table_name, tbl.table_name);
    END LOOP; 
END $$;

-- 4. SPECIAL CASE: PROFILES
CREATE POLICY "profiles_owner_policy" ON public.profiles FOR ALL USING (auth.uid() = id);
CREATE POLICY "profiles_master_admin_policy" ON public.profiles FOR ALL USING ((auth.jwt() ->> 'email') = 'joaopedro.faggionato@gmail.com');

-- 5. RE-SYNC ADMIN ROLES
UPDATE public.profiles SET role = 'admin' WHERE email = 'joaopedro.faggionato@gmail.com';
UPDATE public.profiles SET role = 'user' WHERE email != 'joaopedro.faggionato@gmail.com';

-- 6. VERIFICATION (Optional check in logs)
-- SELECT count(*) FROM pg_policies WHERE schemaname = 'public';
