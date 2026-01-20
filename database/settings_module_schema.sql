-- ==============================================================================
-- Settings Module Schema
-- Description: Creates tables for Tenant Settings (User) and SaaS Config (Admin)
-- ==============================================================================

-- 0. Utilitários
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 1. Tenant Settings (Configurações do Cliente)
-- Armazena preferências de cada usuário/empresa (tenant)
CREATE TABLE IF NOT EXISTS tenant_settings (
    user_id UUID REFERENCES auth.users(id) NOT NULL PRIMARY KEY,
    
    -- Dados da Empresa (para Contratos/PDFs)
    company_name TEXT,
    trading_name TEXT,
    cnpj_cpf TEXT,
    address JSONB DEFAULT '{}', -- { street, number, neighborhood, city, state, zip }
    finance_email TEXT,
    responsible_name TEXT,

    -- Regras de Negócio (Locação)
    default_pickup_time TIME DEFAULT '09:00',
    default_return_time TIME DEFAULT '18:00',
    late_fee_fixed NUMERIC(10,2) DEFAULT 0.00,
    late_fee_daily_percent NUMERIC(5,2) DEFAULT 0.00,
    security_deposit_enabled BOOLEAN DEFAULT FALSE,
    security_deposit_default NUMERIC(10,2) DEFAULT 0.00,
    block_late_items BOOLEAN DEFAULT FALSE, -- Impede nova locação se houver atraso

    -- Personalização (Whitelabel Gráfico)
    primary_color TEXT DEFAULT '#13283b',
    secondary_color TEXT DEFAULT '#f8fafc',
    logo_url TEXT,
    display_name TEXT, -- Nome curto para exibição no sistema

    -- Preferências de Notificação
    notification_preferences JSONB DEFAULT '{"email_new_rental": true, "email_payment": true, "whatsapp_overdue": false}',

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS Policies for tenant_settings
ALTER TABLE tenant_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own settings" 
    ON tenant_settings FOR SELECT 
    USING (auth.uid() = user_id);

CREATE POLICY "Users can update own settings" 
    ON tenant_settings FOR UPDATE 
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own settings" 
    ON tenant_settings FOR INSERT 
    WITH CHECK (auth.uid() = user_id);

-- Trigger para atualizar updated_at
CREATE OR REPLACE TRIGGER update_tenant_settings_modtime
    BEFORE UPDATE ON tenant_settings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- 2. SaaS Config (Configurações Globais do Admin)
-- Tabela Singleton (apenas 1 linha) para configurações do sistema
CREATE TABLE IF NOT EXISTS saas_config (
    id INT PRIMARY KEY DEFAULT 1,
    
    -- Identidade do SaaS
    saas_name TEXT DEFAULT 'Micro SaaS Aluguel',
    support_email TEXT DEFAULT 'suporte@risu.com.br',
    
    -- Controle de Acesso
    maintenance_mode BOOLEAN DEFAULT FALSE, -- Se true, bloqueia login de users não-admin
    allow_new_registrations BOOLEAN DEFAULT TRUE,

    -- Regras Automáticas
    churn_risk_days INT DEFAULT 30, -- Dias sem login para considerar risco
    suspension_days_after_due INT DEFAULT 5, -- Dias após vencimento para suspender conta

    -- Conteúdo Legal (HTML/Markdown)
    terms_of_use_text TEXT,
    privacy_policy_text TEXT,

    updated_at TIMESTAMPTZ DEFAULT NOW(),
    updated_by UUID REFERENCES auth.users(id),
    
    CONSTRAINT single_row CHECK (id = 1) -- Garante apenas 1 linha
);

-- Inserir configuração padrão se não existir
INSERT INTO saas_config (id, saas_name) 
VALUES (1, 'Risu - Gestão de Aluguel') 
ON CONFLICT (id) DO NOTHING;

-- RLS Policies for saas_config
ALTER TABLE saas_config ENABLE ROW LEVEL SECURITY;

-- Todos (autenticados) podem LER a config (para saber se está em manutenção, termos, etc)
CREATE POLICY "Public read access to metrics" 
    ON saas_config FOR SELECT 
    TO authenticated 
    USING (true);

-- Apenas Admin pode ATUALIZAR
CREATE POLICY "Admin update access" 
    ON saas_config FOR UPDATE 
    USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- 3. Função para garantir que todo novo usuário tenha settings (Opcional, mas útil)
CREATE OR REPLACE FUNCTION public.handle_new_user_settings() 
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.tenant_settings (user_id)
  VALUES (new.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger ao criar usuário (ligado a tabela profiles ou auth.users dependendo da arquitetura existente)
-- Assumindo que profiles é criado via trigger do auth.users, podemos ligar neste mesmo momento
-- Mas para segurança, vamos ligar no AFTER INSERT da tabela profiles
CREATE OR REPLACE TRIGGER on_profile_created_settings
  AFTER INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_settings();
