-- REMOVE DADOS MOCKADOS (TESTE) DO MÓDULO FINANCEIRO
-- Este script limpa as tabelas de custos, taxas e impostos para que você comece do zero.

-- 1. Limpar Custos Recorrentes (Remove 'Servidor AWS', 'Email Marketing', etc)
TRUNCATE TABLE public.saas_recurring_costs;

-- 2. Limpar Taxas de Gateway (Remove 'Stripe', 'PIX Banco Central')
TRUNCATE TABLE public.saas_payment_fees;

-- 3. Limpar Regras de Impostos (Remove 'Imposto Simples', 'ISS')
TRUNCATE TABLE public.saas_taxes;

-- 4. Confirmação
SELECT 'Dados de teste financeiros removidos. Agora o painel deve mostrar R$ 0,00 em tudo.' as status;
