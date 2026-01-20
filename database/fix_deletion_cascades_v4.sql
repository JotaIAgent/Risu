-- FIX FINAL DE EXCLUSÃO DE USUÁRIO (V4 - O RESGATE)
-- Inclui tabela DRIVERS (Logística) encontrada na auditoria.

BEGIN;

-- 1. Tabela DRIVERS (Logística) - CULPADO DEVE SER ESSE
ALTER TABLE public.drivers DROP CONSTRAINT IF EXISTS drivers_user_id_fkey;
ALTER TABLE public.drivers ADD CONSTRAINT drivers_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- 2. Recaptulando Logística (Damage, Lost, Broken)
ALTER TABLE public.damage_logs DROP CONSTRAINT IF EXISTS damage_logs_user_id_fkey;
ALTER TABLE public.damage_logs ADD CONSTRAINT damage_logs_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.lost_logs DROP CONSTRAINT IF EXISTS lost_logs_user_id_fkey;
ALTER TABLE public.lost_logs ADD CONSTRAINT lost_logs_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.broken_logs DROP CONSTRAINT IF EXISTS broken_logs_user_id_fkey;
ALTER TABLE public.broken_logs ADD CONSTRAINT broken_logs_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- 3. Core
ALTER TABLE public.rentals DROP CONSTRAINT IF EXISTS rentals_user_id_fkey;
ALTER TABLE public.rentals ADD CONSTRAINT rentals_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.items DROP CONSTRAINT IF EXISTS items_user_id_fkey;
ALTER TABLE public.items ADD CONSTRAINT items_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.customers DROP CONSTRAINT IF EXISTS customers_user_id_fkey;
ALTER TABLE public.customers ADD CONSTRAINT customers_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

COMMIT;
