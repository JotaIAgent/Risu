-- Migração para corrigir erro de exclusão de usuário (Database error deleting user)
-- O erro acontece porque a tabela 'tenant_settings' não estava configurada para deletar os dados quando o usuário é excluído.

BEGIN;

-- 1. Corrigir tabela tenant_settings
-- Remove a restrição antiga (que bloqueiava a exclusão)
ALTER TABLE public.tenant_settings
DROP CONSTRAINT IF EXISTS tenant_settings_user_id_fkey;

-- Adiciona a nova restrição com CASCADE (deleta configurações se o user for deletado)
ALTER TABLE public.tenant_settings
ADD CONSTRAINT tenant_settings_user_id_fkey
    FOREIGN KEY (user_id)
    REFERENCES auth.users(id)
    ON DELETE CASCADE;

-- 2. Corrigir tabela saas_admin_logs (caso o usuário tenha logs)
ALTER TABLE public.saas_admin_logs
DROP CONSTRAINT IF EXISTS saas_admin_logs_admin_id_fkey;

ALTER TABLE public.saas_admin_logs
ADD CONSTRAINT saas_admin_logs_admin_id_fkey
    FOREIGN KEY (admin_id)
    REFERENCES auth.users(id)
    ON DELETE CASCADE; -- ou SET NULL se quiser manter o histórico

-- 3. Corrigir saas_config (caso o usuário tenha editado configs globais)
ALTER TABLE public.saas_config
DROP CONSTRAINT IF EXISTS saas_config_updated_by_fkey;

ALTER TABLE public.saas_config
ADD CONSTRAINT saas_config_updated_by_fkey
    FOREIGN KEY (updated_by)
    REFERENCES auth.users(id)
    ON DELETE SET NULL;

COMMIT;
