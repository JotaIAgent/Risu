-- ATUALIZAÇÃO DO TRIGGER DE NOVOS USUÁRIOS
-- Objetivo: Criar automaticamente 3 contas financeiras (Carteiras) para todo novo usuário que se cadastrar.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  -- 1. Criar Perfil (Mantendo lógica existente com todos os campos novos)
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
  
  -- 2. Criar Assinatura Inicial (Mantendo lógica existente)
  INSERT INTO public.saas_subscriptions (
    user_id, 
    status,
    billing_cycle,
    amount_cents
  )
  VALUES (
    new.id, 
    'active',
    COALESCE(new.raw_user_meta_data->>'billing_cycle', 'monthly'),
    COALESCE((new.raw_user_meta_data->>'custom_amount_cents')::integer, 9990)
  );

  -- 3. CRIAR CONTAS FINANCEIRAS PADRÃO (NOVO)
  -- Conta 1: Conta Empresa (Geral - Business)
  INSERT INTO public.accounts (user_id, name, context, type, is_default, color, balance)
  VALUES (new.id, 'Conta Empresa', 'business', 'general', true, 'blue', 0);

  -- Conta 2: Fundo Caução (Deposit Fund - Business)
  INSERT INTO public.accounts (user_id, name, context, type, is_default, color, balance)
  VALUES (new.id, 'Fundo Caução', 'business', 'deposit_fund', false, 'purple', 0);

  -- Conta 3: Conta Pessoal (Geral - Personal)
  INSERT INTO public.accounts (user_id, name, context, type, is_default, color, balance)
  VALUES (new.id, 'Conta Pessoal', 'personal', 'general', false, 'emerald', 0);
  
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. BACKFILL: Criar contas para usuários existentes que não tem nenhuma conta (ex: seu usuário de teste atual)
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT id FROM public.profiles WHERE id NOT IN (SELECT distinct user_id FROM public.accounts) LOOP
    -- Conta 1
    INSERT INTO public.accounts (user_id, name, context, type, is_default, color, balance)
    VALUES (r.id, 'Conta Empresa', 'business', 'general', true, 'blue', 0);
    
    -- Conta 2
    INSERT INTO public.accounts (user_id, name, context, type, is_default, color, balance)
    VALUES (r.id, 'Fundo Caução', 'business', 'deposit_fund', false, 'purple', 0);
    
    -- Conta 3
    INSERT INTO public.accounts (user_id, name, context, type, is_default, color, balance)
    VALUES (r.id, 'Conta Pessoal', 'personal', 'general', false, 'emerald', 0);
  END LOOP;

  -- 5. CORREÇÃO (Renomear contas antigas para os novos nomes)
  -- Atualizar Conta Principal -> Conta Empresa
  UPDATE public.accounts 
  SET name = 'Conta Empresa', context = 'business' 
  WHERE name = 'Conta Principal';

  -- Atualizar Fundo de Reserva -> Fundo Caução
  UPDATE public.accounts 
  SET name = 'Fundo Caução', context = 'business' 
  WHERE name = 'Fundo de Reserva';

  -- Atualizar Caixa Físico -> Conta Pessoal
  UPDATE public.accounts 
  SET name = 'Conta Pessoal', context = 'personal' 
  WHERE name = 'Caixa Físico';

END;
$$;

-- Comentário para rodar no SQL Editor:
-- SELECT 'Trigger atualizado, contas criadas e nomes corrigidos com sucesso!' as status;
