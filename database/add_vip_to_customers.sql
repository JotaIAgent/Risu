-- Add VIP column to customers
ALTER TABLE public.customers
ADD COLUMN IF NOT EXISTS is_vip BOOLEAN DEFAULT false;

-- Function to get customers with rental stats
CREATE OR REPLACE FUNCTION public.get_customers_with_stats()
RETURNS TABLE (
  id UUID,
  name TEXT,
  whatsapp TEXT,
  email TEXT,
  cpf TEXT,
  customer_city TEXT,
  customer_state TEXT,
  is_vip BOOLEAN,
  total_rentals BIGINT,
  total_spent NUMERIC,
  last_rental_date DATE
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.id,
    c.name,
    c.whatsapp,
    c.email,
    c.cpf,
    c.customer_city,
    c.customer_state,
    c.is_vip,
    COUNT(r.id) as total_rentals,
    COALESCE(SUM(r.total_price), 0) as total_spent,
    MAX(r.start_date) as last_rental_date
  FROM public.customers c
  LEFT JOIN public.rentals r ON c.id = r.client_id
  WHERE c.user_id = auth.uid() -- Filter by current user
  GROUP BY c.id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
