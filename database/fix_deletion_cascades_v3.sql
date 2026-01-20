-- FIX FINAL DE EXCLUSÃO DE USUÁRIO (V3 - DEFINITIVO)
-- Este script atualiza TODAS as chaves estrangeiras para ON DELETE CASCADE.
-- Inclui tabelas esquecidas anteriormente: damage_logs, lost_logs, broken_logs.

BEGIN;

-- ==============================================================================
-- 1. TABELAS CORE (Estoque, Clientes, Contratos)
-- ==============================================================================

-- Rentals (Contratos)
ALTER TABLE public.rentals DROP CONSTRAINT IF EXISTS rentals_user_id_fkey;
ALTER TABLE public.rentals ADD CONSTRAINT rentals_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- Items (Estoque)
ALTER TABLE public.items DROP CONSTRAINT IF EXISTS items_user_id_fkey;
ALTER TABLE public.items ADD CONSTRAINT items_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- Customers (Clientes)
ALTER TABLE public.customers DROP CONSTRAINT IF EXISTS customers_user_id_fkey;
ALTER TABLE public.customers ADD CONSTRAINT customers_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


-- ==============================================================================
-- 2. TABELAS DE LOGÍSTICA E MANUTENÇÃO (Novas Encontradas)
-- ==============================================================================

-- Damage Logs (Danos)
ALTER TABLE public.damage_logs DROP CONSTRAINT IF EXISTS damage_logs_user_id_fkey;
ALTER TABLE public.damage_logs ADD CONSTRAINT damage_logs_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- Lost Logs (Perdas)
ALTER TABLE public.lost_logs DROP CONSTRAINT IF EXISTS lost_logs_user_id_fkey;
ALTER TABLE public.lost_logs ADD CONSTRAINT lost_logs_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- Broken Logs (Quebras)
ALTER TABLE public.broken_logs DROP CONSTRAINT IF EXISTS broken_logs_user_id_fkey;
ALTER TABLE public.broken_logs ADD CONSTRAINT broken_logs_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- Maintenance Logs (Manutenção)
ALTER TABLE public.maintenance_logs DROP CONSTRAINT IF EXISTS maintenance_logs_user_id_fkey;
ALTER TABLE public.maintenance_logs ADD CONSTRAINT maintenance_logs_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


-- ==============================================================================
-- 3. TABELAS DE WHATSAPP E INTEGRAÇÕES
-- ==============================================================================

-- WhatsApp Templates
ALTER TABLE public.whatsapp_templates DROP CONSTRAINT IF EXISTS whatsapp_templates_user_id_fkey;
ALTER TABLE public.whatsapp_templates ADD CONSTRAINT whatsapp_templates_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- WhatsApp Logs
ALTER TABLE public.whatsapp_logs DROP CONSTRAINT IF EXISTS whatsapp_logs_user_id_fkey;
ALTER TABLE public.whatsapp_logs ADD CONSTRAINT whatsapp_logs_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


-- ==============================================================================
-- 4. TABELAS DE CONFIGURAÇÃO E ADMIN
-- ==============================================================================

-- Tenant Settings (Configurações da Empresa)
ALTER TABLE public.tenant_settings DROP CONSTRAINT IF EXISTS tenant_settings_user_id_fkey;
ALTER TABLE public.tenant_settings ADD CONSTRAINT tenant_settings_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- SaaS Admin Logs
ALTER TABLE public.saas_admin_logs DROP CONSTRAINT IF EXISTS saas_admin_logs_admin_id_fkey;
ALTER TABLE public.saas_admin_logs ADD CONSTRAINT saas_admin_logs_admin_id_fkey 
    FOREIGN KEY (admin_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- SaaS Global Config
ALTER TABLE public.saas_config DROP CONSTRAINT IF EXISTS saas_config_updated_by_fkey;
ALTER TABLE public.saas_config ADD CONSTRAINT saas_config_updated_by_fkey 
    FOREIGN KEY (updated_by) REFERENCES auth.users(id) ON DELETE SET NULL;

COMMIT;
