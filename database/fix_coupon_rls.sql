-- ==============================================================================
-- FIX: REGRAS DE ACESSO E CONSTRAINTS DE CUPONS
-- Execute este script no SQL Editor do Supabase para corrigir o erro de RLS.
-- ==============================================================================

-- 1. Corrigir constraint de tipo de cupom (de 'fixed_value' para 'fixed')
ALTER TABLE public.saas_coupons 
DROP CONSTRAINT IF EXISTS saas_coupons_type_check;

ALTER TABLE public.saas_coupons 
ADD CONSTRAINT saas_coupons_type_check CHECK (type IN ('percentage', 'fixed'));

-- 2. Garantir que o usuário Master tenha o role de 'admin' no banco
UPDATE public.profiles
SET role = 'admin'
WHERE email = 'joaopedro.faggionato@gmail.com';

-- 3. Atualizar Políticas de RLS para usar 'role' em vez de 'account_type'
DROP POLICY IF EXISTS "Admins can manage coupons" ON public.saas_coupons;
CREATE POLICY "Admins can manage coupons" 
ON public.saas_coupons 
TO authenticated
USING ( 
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
)
WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

DROP POLICY IF EXISTS "Admins can view all usages" ON public.saas_coupon_usages;
CREATE POLICY "Admins can view all usages" 
ON public.saas_coupon_usages 
FOR SELECT 
TO authenticated
USING ( 
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- 4. Confirmação
SELECT 'Políticas RLS e Constraints atualizadas com sucesso!' as status;
