-- Verificar e corrigir RLS para saas_subscriptions
-- Este script garante que usuários podem ler sua própria subscription

-- 1. Verificar status atual da subscription
SELECT user_id, status, stripe_customer_id, stripe_subscription_id, updated_at
FROM saas_subscriptions
WHERE user_id = '081df9e5-9bc2-476f-962d-595007e2405a';

-- 2. Se precisar atualizar manualmente
UPDATE saas_subscriptions
SET status = 'active'
WHERE user_id = '081df9e5-9bc2-476f-962d-595007e2405a';

-- 3. Garantir RLS policy correta para leitura
DROP POLICY IF EXISTS "Users can read own subscription" ON saas_subscriptions;
CREATE POLICY "Users can read own subscription"
ON saas_subscriptions
FOR SELECT
USING (auth.uid() = user_id);

-- 4. Garantir policy para service key update (webhooks)
DROP POLICY IF EXISTS "Service can update subscriptions" ON saas_subscriptions;
CREATE POLICY "Service can update subscriptions"
ON saas_subscriptions
FOR UPDATE
USING (true)
WITH CHECK (true);

-- 5. Verificar se RLS está habilitado
ALTER TABLE saas_subscriptions ENABLE ROW LEVEL SECURITY;
