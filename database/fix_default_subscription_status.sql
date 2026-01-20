-- FIX: Alterar status padrão de novos usuários para 'incomplete'
-- Antes estava 'active', permitindo acesso gratuito automático.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Cria Perfil
  INSERT INTO public.profiles (id, email, role)
  VALUES (new.id, new.email, 'user');
  
  -- Cria Assinatura com status 'incomplete' (aguardando pagamento)
  INSERT INTO public.saas_subscriptions (user_id, status)
  VALUES (new.id, 'incomplete');
  
  -- Cria Configurações do Tenant (Garante que não falte no futuro)
  INSERT INTO public.tenant_settings (user_id)
  VALUES (new.id)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
