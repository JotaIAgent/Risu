-- ==============================================================================
-- COUPON SYSTEM & SUBSCRIPTION UPDATES
-- ==============================================================================

-- 1. Create Coupons Table
CREATE TABLE IF NOT EXISTS public.saas_coupons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT UNIQUE NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('percentage', 'fixed_value')),
    value DECIMAL(10, 2) NOT NULL,
    valid_from TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    valid_until TIMESTAMP WITH TIME ZONE,
    max_uses INTEGER NOT NULL DEFAULT 100,
    current_uses INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 2. Create Coupon Usage Tracking Table (for Metrics)
CREATE TABLE IF NOT EXISTS public.saas_coupon_usages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    coupon_id UUID REFERENCES public.saas_coupons(id),
    user_id UUID REFERENCES auth.users(id),
    original_amount DECIMAL(10, 2) NOT NULL,
    discount_amount DECIMAL(10, 2) NOT NULL,
    final_amount DECIMAL(10, 2) NOT NULL,
    used_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 3. Add manual_block to profiles for Admin Override
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS manual_block BOOLEAN DEFAULT false;

-- Add pending_coupon to subscriptions to track coupon before confirmation
ALTER TABLE public.saas_subscriptions
ADD COLUMN IF NOT EXISTS pending_coupon TEXT;

-- 4. Enable RLS
ALTER TABLE public.saas_coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saas_coupon_usages ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies
-- Admin can do everything
CREATE POLICY "Admins can manage coupons" 
ON public.saas_coupons 
TO authenticated
USING ( 
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND account_type = 'admin')
);

-- Users can only read active coupons (for validation)
CREATE POLICY "Users can view active coupons" 
ON public.saas_coupons 
FOR SELECT 
TO authenticated
USING (is_active = true AND (valid_until IS NULL OR valid_until > now()));

-- Coupon Usages: Admin sees all, users see their own
CREATE POLICY "Admins can view all usages" 
ON public.saas_coupon_usages 
FOR SELECT 
TO authenticated
USING ( 
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND account_type = 'admin')
);

CREATE POLICY "Users can view their own coupon usage" 
ON public.saas_coupon_usages 
FOR SELECT 
TO authenticated
USING (user_id = auth.uid());

-- 6. Trigger for updated_at on saas_coupons
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_saas_coupons_updated_at
    BEFORE UPDATE ON public.saas_coupons
    FOR EACH ROW
    EXECUTE PROCEDURE update_updated_at_column();

-- 7. RPC to increment usage safely
CREATE OR REPLACE FUNCTION increment_coupon_usage(coupon_id UUID)
RETURNS void AS $$
BEGIN
    UPDATE public.saas_coupons
    SET current_uses = current_uses + 1
    WHERE id = coupon_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
