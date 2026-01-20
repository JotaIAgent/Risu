-- REMOVE DADOS DO USUÁRIO ADMIN (João Pedro) DAS MÉTRICAS FINANCEIRAS
-- Este script deleta a assinatura associada ao email do admin para garantir que os dados financeiros sejam apenas de clientes reais.

-- 1. Identificar e deletar assinatura do usuário admin
DELETE FROM public.saas_subscriptions
WHERE user_id IN (
    SELECT id FROM public.profiles WHERE email = 'joaopedro.faggionato@gmail.com'
);

-- 2. Garantir que o perfil de admin esteja limpo de dados de assinatura (opcional, mas bom pra consistência)
UPDATE public.profiles
SET 
    account_type = 'partner',
    terms_accepted = TRUE
WHERE email = 'joaopedro.faggionato@gmail.com';

-- 3. Confirmação
SELECT 'Dados de assinatura do Admin removidos com sucesso!' as status;
