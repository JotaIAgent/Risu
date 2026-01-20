-- Migrate Refunds (Expenses)
INSERT INTO financial_transactions (user_id, type, category, amount, description, date, rental_id, created_at)
SELECT 
    r.user_id,
    'expense' as type,
    'Reembolso' as category,
    r.refund_value as amount,
    'Reembolso Cancelamento #' || substring(r.id::text, 1, 8) as description,
    r.created_at::date as date, -- Using creation date or cancellation date? We only have created_at.
    r.id as rental_id,
    r.created_at
FROM rentals r
WHERE 
    r.refund_value > 0 
    AND NOT EXISTS (
        SELECT 1 FROM financial_transactions ft 
        WHERE ft.rental_id = r.id AND ft.category = 'Reembolso'
    );

-- Migrate Security Deposit Returns (Expenses)
-- Assuming security_deposit_value contains the amount
INSERT INTO financial_transactions (user_id, type, category, amount, description, date, rental_id, created_at)
SELECT 
    r.user_id,
    'expense' as type,
    'Caução' as category,
    COALESCE(r.security_deposit_value, 0) as amount,
    'Devolução Caução #' || substring(r.id::text, 1, 8) as description,
    r.created_at::date as date, -- Approximation
    r.id as rental_id,
    r.created_at
FROM rentals r
WHERE 
    r.security_deposit_status = 'RETURNED'
    AND COALESCE(r.security_deposit_value, 0) > 0
    AND NOT EXISTS (
        SELECT 1 FROM financial_transactions ft 
        WHERE ft.rental_id = r.id AND ft.category = 'Caução' AND ft.type = 'expense'
    );

-- Migrate Security Deposit Payments (Income)
INSERT INTO financial_transactions (user_id, type, category, amount, description, date, rental_id, created_at)
SELECT 
    r.user_id,
    'income' as type,
    'Caução' as category,
    COALESCE(r.security_deposit_value, 0) as amount,
    'Recebimento Caução #' || substring(r.id::text, 1, 8) as description,
    r.created_at::date as date,
    r.id as rental_id,
    r.created_at
FROM rentals r
WHERE 
    r.security_deposit_status = 'PAID'
    AND COALESCE(r.security_deposit_value, 0) > 0
    AND NOT EXISTS (
        SELECT 1 FROM financial_transactions ft 
        WHERE ft.rental_id = r.id AND ft.category = 'Caução' AND ft.type = 'income'
    );
