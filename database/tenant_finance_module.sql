-- Tenant Finance Module Tables

-- 1. Recurring Costs (Custos Fixos)
CREATE TABLE IF NOT EXISTS public.tenant_recurring_costs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    category TEXT DEFAULT 'general', -- 'rent', 'utilities', 'payroll', 'marketing', 'software'
    amount DECIMAL(10,2) NOT NULL,
    frequency TEXT DEFAULT 'monthly', -- 'monthly', 'yearly'
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Tax Rules (Impostos)
CREATE TABLE IF NOT EXISTS public.tenant_taxes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL, -- 'Simples Nacional', 'ISS'
    value DECIMAL(10,2) NOT NULL, -- Percentage or Fixed Value
    type TEXT DEFAULT 'percent', -- 'percent', 'fixed'
    base_calc TEXT DEFAULT 'gross', -- 'gross' (revenue), 'net' (revenue - fees)
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Payment Fees (Taxas de Pagamento)
CREATE TABLE IF NOT EXISTS public.tenant_payment_fees (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL, -- 'Machine A', 'Stripe'
    payment_method TEXT DEFAULT 'credit_card', -- 'credit_card', 'debit_card', 'pix', 'boleto', 'all'
    fee_percent DECIMAL(10,2) DEFAULT 0,
    fee_fixed DECIMAL(10,2) DEFAULT 0,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- RLS Policies
ALTER TABLE public.tenant_recurring_costs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_taxes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_payment_fees ENABLE ROW LEVEL SECURITY;

-- Policies for Recurring Costs
CREATE POLICY "Users can view their own recurring costs" ON public.tenant_recurring_costs
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own recurring costs" ON public.tenant_recurring_costs
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own recurring costs" ON public.tenant_recurring_costs
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own recurring costs" ON public.tenant_recurring_costs
    FOR DELETE USING (auth.uid() = user_id);

-- Policies for Taxes
CREATE POLICY "Users can view their own taxes" ON public.tenant_taxes
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own taxes" ON public.tenant_taxes
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own taxes" ON public.tenant_taxes
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own taxes" ON public.tenant_taxes
    FOR DELETE USING (auth.uid() = user_id);

-- Policies for Fees
CREATE POLICY "Users can view their own fees" ON public.tenant_payment_fees
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own fees" ON public.tenant_payment_fees
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own fees" ON public.tenant_payment_fees
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own fees" ON public.tenant_payment_fees
    FOR DELETE USING (auth.uid() = user_id);
