-- SAAS FINANCIAL MODULE SCHEMA (v1.0)
-- Creates tables for Taxes, Payment Fees, and Recurring Costs.

-- 1. SAAS TAXES (Regras de Impostos)
CREATE TABLE IF NOT EXISTS public.saas_taxes (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    name text NOT NULL,
    type text CHECK (type IN ('percent', 'fixed')) NOT NULL, -- 'percent' or 'fixed'
    value numeric NOT NULL, -- The percentage (e.g., 6.0) or fixed value (e.g., 50.00)
    base_calc text CHECK (base_calc IN ('gross', 'net')) DEFAULT 'gross', -- 'gross' (bruto) or 'net' (líquido)
    active boolean DEFAULT true,
    created_at timestamptz DEFAULT now()
);

-- 2. SAAS PAYMENT FEES (Taxas de Gateway)
CREATE TABLE IF NOT EXISTS public.saas_payment_fees (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    provider_name text NOT NULL, -- 'Stripe', 'Mercado Pago', 'Cielo', etc.
    payment_method text NOT NULL, -- 'credit_card', 'pix', 'boleto', 'all'
    fee_percent numeric DEFAULT 0, -- e.g., 3.99
    fee_fixed numeric DEFAULT 0, -- e.g., 0.50
    active boolean DEFAULT true,
    created_at timestamptz DEFAULT now()
);

-- 3. SAAS RECURRING COSTS (Custos do Software)
CREATE TABLE IF NOT EXISTS public.saas_recurring_costs (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    name text NOT NULL,
    category text NOT NULL, -- 'marketing', 'infra', 'staff', 'tools'
    amount numeric NOT NULL, -- Monthly/Period value
    frequency text CHECK (frequency IN ('monthly', 'yearly', 'one_off')) DEFAULT 'monthly',
    due_day integer, -- Day of the month (1-31)
    active boolean DEFAULT true,
    last_paid_at timestamptz,
    created_at timestamptz DEFAULT now()
);

-- 4. ENABLE RLS
ALTER TABLE public.saas_taxes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saas_payment_fees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saas_recurring_costs ENABLE ROW LEVEL SECURITY;

-- 5. POLICIES (Admin Master Only)
-- We assume the admin master is identified by email 'joaopedro.faggionato@gmail.com'

-- SAAS TAXES
CREATE POLICY "admin_all_saas_taxes" ON public.saas_taxes
FOR ALL USING ((auth.jwt() ->> 'email') = 'joaopedro.faggionato@gmail.com');

-- SAAS PAYMENT FEES
CREATE POLICY "admin_all_saas_payment_fees" ON public.saas_payment_fees
FOR ALL USING ((auth.jwt() ->> 'email') = 'joaopedro.faggionato@gmail.com');

-- SAAS RECURRING COSTS
CREATE POLICY "admin_all_saas_recurring_costs" ON public.saas_recurring_costs
FOR ALL USING ((auth.jwt() ->> 'email') = 'joaopedro.faggionato@gmail.com');

-- 6. MOCK DATA (Seeds)

-- Taxes
INSERT INTO public.saas_taxes (name, type, value, base_calc) VALUES
('Simples Nacional (Anexo III)', 'percent', 6.0, 'gross'),
('Taxa de Alvará (Rateio)', 'fixed', 50.00, 'gross');

-- Payment Fees
INSERT INTO public.saas_payment_fees (provider_name, payment_method, fee_percent, fee_fixed) VALUES
('Stripe Default', 'credit_card', 3.99, 0.50),
('Mercado Pago Pix', 'pix', 0.99, 0.00);

-- Recurring Costs
INSERT INTO public.saas_recurring_costs (name, category, amount, frequency, due_day) VALUES
('Servidor AWS', 'infra', 150.00, 'monthly', 10),
('OpenAI API', 'tools', 50.00, 'monthly', 5),
('Marketing Facebook Ads', 'marketing', 500.00, 'monthly', 1);
