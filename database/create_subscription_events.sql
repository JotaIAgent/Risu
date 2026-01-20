-- Criar tabela de eventos de assinatura
CREATE TABLE IF NOT EXISTS subscription_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL, -- 'subscribed', 'canceled', 'renewed', 'plan_changed', 'payment_failed', 'payment_succeeded'
    description TEXT,
    plan_name TEXT,
    amount_cents INTEGER,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index para consultas rápidas
CREATE INDEX IF NOT EXISTS idx_subscription_events_user_id ON subscription_events(user_id);
CREATE INDEX IF NOT EXISTS idx_subscription_events_created_at ON subscription_events(created_at DESC);

-- RLS policies
ALTER TABLE subscription_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own events" ON subscription_events;
CREATE POLICY "Users can read own events"
ON subscription_events
FOR SELECT
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service can insert events" ON subscription_events;
CREATE POLICY "Service can insert events"
ON subscription_events
FOR INSERT
WITH CHECK (true);

-- Inserir evento de teste para o usuário atual (opcional, remova se não quiser)
-- INSERT INTO subscription_events (user_id, event_type, description, plan_name, amount_cents)
-- VALUES ('081df9e5-9bc2-476f-962d-595007e2405a', 'subscribed', 'Assinatura iniciada', 'Risu Mensal', 9990);
