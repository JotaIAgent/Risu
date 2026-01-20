
-- Migration: Add WhatsApp Message Templates and History
-- Allows users to save reusable templates and tracks message history.

-- 1. Create message_templates table
CREATE TABLE IF NOT EXISTS public.whatsapp_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) NOT NULL,
    name TEXT NOT NULL, -- e.g., 'Orçamento', 'Cobrança', 'Lembrete Devolução'
    content TEXT NOT NULL,
    category TEXT DEFAULT 'custom', -- 'budget', 'confirmation', 'reminder', 'custom'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now())
);

-- 2. Create whatsapp_logs table for history
CREATE TABLE IF NOT EXISTS public.whatsapp_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) NOT NULL,
    customer_id UUID REFERENCES public.customers(id) ON DELETE CASCADE,
    rental_id UUID REFERENCES public.rentals(id) ON DELETE SET NULL,
    template_name TEXT,
    content TEXT NOT NULL,
    status TEXT DEFAULT 'sent', -- 'sent', 'error'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now())
);

-- 3. Enable RLS
ALTER TABLE public.whatsapp_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_logs ENABLE ROW LEVEL SECURITY;

-- 4. Policies
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'whatsapp_templates' AND policyname = 'Users can manage their own whatsapp templates') THEN
        CREATE POLICY "Users can manage their own whatsapp templates" 
            ON public.whatsapp_templates FOR ALL USING (auth.uid() = user_id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'whatsapp_logs' AND policyname = 'Users can view their own whatsapp logs') THEN
        CREATE POLICY "Users can view their own whatsapp logs" 
            ON public.whatsapp_logs FOR ALL USING (auth.uid() = user_id);
    END IF;
END $$;

-- 5. Insert default templates
INSERT INTO public.whatsapp_templates (user_id, name, category, content)
SELECT 
    (SELECT id FROM auth.users LIMIT 1), -- fallback, user will need to re-save if empty
    'Boas-vindas',
    'confirmation',
    'Olá {nome}, seja bem-vindo à nossa loja! Segue o resumo do seu pedido: {aluguel_id}.'
ON CONFLICT DO NOTHING;
