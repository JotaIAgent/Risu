-- FIX FINAL DE EXCLUSÃO DE USUÁRIO (V2)
-- Este script corrige TODAS as tabelas que impedem a exclusão do usuário.

BEGIN;

-- 1. Tabela RENTALS (Contratos)
ALTER TABLE public.rentals DROP CONSTRAINT IF EXISTS rentals_user_id_fkey;
ALTER TABLE public.rentals ADD CONSTRAINT rentals_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- 2. Tabela ITEMS (Estoque)
ALTER TABLE public.items DROP CONSTRAINT IF EXISTS items_user_id_fkey;
ALTER TABLE public.items ADD CONSTRAINT items_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- 3. Tabela CUSTOMERS (Clientes)
ALTER TABLE public.customers DROP CONSTRAINT IF EXISTS customers_user_id_fkey;
ALTER TABLE public.customers ADD CONSTRAINT customers_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- 4. Tabela WHATSAPP_TEMPLATES
ALTER TABLE public.whatsapp_templates DROP CONSTRAINT IF EXISTS whatsapp_templates_user_id_fkey;
ALTER TABLE public.whatsapp_templates ADD CONSTRAINT whatsapp_templates_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- 5. Tabela WHATSAPP_LOGS
ALTER TABLE public.whatsapp_logs DROP CONSTRAINT IF EXISTS whatsapp_logs_user_id_fkey;
ALTER TABLE public.whatsapp_logs ADD CONSTRAINT whatsapp_logs_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- 6. Tabela MAINTENANCE_LOGS (Manutenção)
ALTER TABLE public.maintenance_logs DROP CONSTRAINT IF EXISTS maintenance_logs_user_id_fkey;
ALTER TABLE public.maintenance_logs ADD CONSTRAINT maintenance_logs_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- Reforço das tabelas anteriores (garantia)
ALTER TABLE public.tenant_settings DROP CONSTRAINT IF EXISTS tenant_settings_user_id_fkey;
ALTER TABLE public.tenant_settings ADD CONSTRAINT tenant_settings_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.saas_admin_logs DROP CONSTRAINT IF EXISTS saas_admin_logs_admin_id_fkey;
ALTER TABLE public.saas_admin_logs ADD CONSTRAINT saas_admin_logs_admin_id_fkey 
    FOREIGN KEY (admin_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.saas_config DROP CONSTRAINT IF EXISTS saas_config_updated_by_fkey;
ALTER TABLE public.saas_config ADD CONSTRAINT saas_config_updated_by_fkey 
    FOREIGN KEY (updated_by) REFERENCES auth.users(id) ON DELETE SET NULL;

COMMIT;
