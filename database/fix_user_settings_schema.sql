
-- Unified Migration: Fix missing columns and add daily toggle to collection_schedule
-- This script ensures all necessary columns exist in user_settings to avoid 400 Bad Request errors.

ALTER TABLE public.user_settings 
ADD COLUMN IF NOT EXISTS payment_alert_message text DEFAULT 'Olá {nome}, identificamos um pagamento pendente referente ao seu aluguel #{aluguel_id} no valor de R$ {valor_pendente}. Por favor, entre em contato para regularizar.',
ADD COLUMN IF NOT EXISTS return_alert_message text DEFAULT 'Olá {nome}, lembramos que o prazo para devolução dos itens do aluguel #{aluguel_id} venceu no dia {data_devolucao}. Quando podemos realizar a coleta?',
ADD COLUMN IF NOT EXISTS collection_schedule jsonb DEFAULT '{
  "reminder_days": [0, 5],
  "daily_after_days": 10,
  "daily_enabled": true
}'::jsonb;

-- Update existing rows that might have the old schema or nulls
UPDATE public.user_settings 
SET collection_schedule = '{
  "reminder_days": [0, 5],
  "daily_after_days": 10,
  "daily_enabled": true
}'::jsonb
WHERE collection_schedule IS NULL;
