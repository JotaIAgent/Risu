ALTER TABLE public.user_settings 
ADD COLUMN IF NOT EXISTS late_fee_type TEXT DEFAULT 'percent', -- 'percent' or 'fixed'
ADD COLUMN IF NOT EXISTS late_fee_value NUMERIC(10,2) DEFAULT 0;
