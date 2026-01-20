-- Drop first to allow return type change
drop function if exists get_customers_with_stats_v2();

-- Function to get customers with financial and operational stats
create or replace function get_customers_with_stats_v2()
returns table (
  id uuid,
  created_at timestamptz,
  name text,
  email text,
  whatsapp text,
  cpf text,
  customer_city text,
  customer_state text,
  observations text,
  is_vip boolean,
  total_rentals bigint,
  last_rental_date date,
  total_spent numeric,
  outstanding_balance numeric
)
language plpgsql
security definer -- Added security definer to avoid RLS issues
as $$
begin
  return query
  select 
    c.id,
    c.created_at,
    c.name,
    c.email,
    c.whatsapp,
    c.cpf,
    c.customer_city,
    c.customer_state,
    c.observations,
    c.is_vip,
    count(r.id) as total_rentals,
    max(r.start_date) as last_rental_date,
    coalesce(sum(r.total_value) filter (where r.status != 'canceled'), 0) as total_spent,
    coalesce(sum(r.total_value - coalesce(r.down_payment, 0)) filter (where r.status != 'canceled' and (r.total_value - coalesce(r.down_payment, 0)) > 0.01), 0) as outstanding_balance
  from customers c
  left join rentals r on c.id = r.client_id
  group by c.id;
end;
$$;
