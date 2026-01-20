-- FIX FINAL DE EXCLUSÃO DE USUÁRIO (V5 - THE END)
-- Corrige as tabelas encontradas na auditoria final: `rental_items` e `user_settings`.

BEGIN;

-- 1. Tabela RENTAL_ITEMS (Itens dentro de contratos) - Encontrado em `multi_item_rentals.sql`
ALTER TABLE public.rental_items DROP CONSTRAINT IF EXISTS rental_items_user_id_fkey;
ALTER TABLE public.rental_items ADD CONSTRAINT rental_items_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- 2. Tabela USER_SETTINGS (Se existir, garante o Cascade)
-- Nota: Pode ser um alias antigo de tenant_settings, mas por garantia vamos aplicar.
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_settings') THEN
        ALTER TABLE public.user_settings DROP CONSTRAINT IF EXISTS user_settings_user_id_fkey;
        ALTER TABLE public.user_settings ADD CONSTRAINT user_settings_user_id_fkey 
            FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
    END IF;
END $$;

-- 3. Tabela ACCOUNTS (Módulo Financeiro V2 - evolve_finance_v2.sql)
-- O script original tinha cascade, mas por segurança vamos reaplicar/garantir.
ALTER TABLE public.accounts DROP CONSTRAINT IF EXISTS accounts_user_id_fkey;
ALTER TABLE public.accounts ADD CONSTRAINT accounts_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

COMMIT;
