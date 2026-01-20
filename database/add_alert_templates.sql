
-- Add customizable WhatsApp alert templates to user_settings
ALTER TABLE public.user_settings 
ADD COLUMN IF NOT EXISTS payment_alert_message text DEFAULT 'Olá {nome}, identificamos um pagamento pendente referente ao seu aluguel #{aluguel_id} no valor de R$ {valor_pendente}. Por favor, entre em contato para regularizar.',
ADD COLUMN IF NOT EXISTS return_alert_message text DEFAULT 'Olá {nome}, lembramos que o prazo para devolução dos itens do aluguel #{aluguel_id} venceu no dia {data_devolucao}. Quando podemos realizar a coleta?';
