-- FIX: Trigger Unificado para Novos Usuários
-- Este script corrige o trigger handle_new_user para:
-- 1. Criar perfil completo com todos os campos do signup
-- 2. Criar assinatura com status 'incomplete' (aguardando pagamento)
-- 3. Criar tenant_settings
-- 4. Criar conta financeira padrão

-- 1. Garantir que todos os campos existem na tabela profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS full_name text,
ADD COLUMN IF NOT EXISTS person_type text CHECK (person_type IN ('PF', 'PJ')),
ADD COLUMN IF NOT EXISTS tax_id text,
ADD COLUMN IF NOT EXISTS whatsapp text,
ADD COLUMN IF NOT EXISTS company_name text,
ADD COLUMN IF NOT EXISTS city text,
ADD COLUMN IF NOT EXISTS state text,
ADD COLUMN IF NOT EXISTS terms_accepted boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS referral_source text,
ADD COLUMN IF NOT EXISTS main_objective text,
ADD COLUMN IF NOT EXISTS company_size text,
ADD COLUMN IF NOT EXISTS account_type text DEFAULT 'common',
ADD COLUMN IF NOT EXISTS last_login_at timestamp with time zone;

-- 2. Criar o Trigger Unificado
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Criar Perfil Completo
  INSERT INTO public.profiles (
    id, 
    email, 
    role,
    full_name,
    person_type,
    tax_id,
    whatsapp,
    company_name,
    city,
    state,
    terms_accepted,
    referral_source,
    main_objective,
    company_size,
    account_type
  )
  VALUES (
    new.id, 
    new.email, 
    'user',
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'person_type',
    new.raw_user_meta_data->>'tax_id',
    new.raw_user_meta_data->>'whatsapp',
    new.raw_user_meta_data->>'company_name',
    new.raw_user_meta_data->>'city',
    new.raw_user_meta_data->>'state',
    COALESCE((new.raw_user_meta_data->>'terms_accepted')::boolean, false),
    new.raw_user_meta_data->>'referral_source',
    new.raw_user_meta_data->>'main_objective',
    new.raw_user_meta_data->>'company_size',
    COALESCE(new.raw_user_meta_data->>'account_type', 'common')
  );
  
  -- Criar Assinatura com status 'trialing' (Teste Grátis de 3 dias)
  INSERT INTO public.saas_subscriptions (
    user_id, 
    status,
    plan_name,
    billing_cycle,
    amount_cents,
    current_period_end
  )
  VALUES (
    new.id, 
    'trialing',
    'Período de Teste',
    COALESCE(new.raw_user_meta_data->>'billing_cycle', 'monthly'),
    COALESCE((new.raw_user_meta_data->>'custom_amount_cents')::integer, 9990),
    now() + interval '3 days'
  );
  
  -- Criar Configurações do Tenant
  INSERT INTO public.tenant_settings (user_id)
  VALUES (new.id)
  ON CONFLICT (user_id) DO NOTHING;

  -- Criar Conta Financeira Padrão (Se tabela existir)
  INSERT INTO public.accounts (user_id, name, type, is_default)
  VALUES (new.id, 'Caixa Principal', 'checking', true)
  ON CONFLICT DO NOTHING;
  
  RETURN new;
EXCEPTION WHEN OTHERS THEN
  -- Log error but don't block signup
  RAISE WARNING 'handle_new_user partial failure for user %: %', new.id, SQLERRM;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Garantir que o Trigger está ativo
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
