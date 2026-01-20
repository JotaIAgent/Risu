-- Add rental_id column to financial_transactions
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'financial_transactions' AND column_name = 'rental_id') THEN
        ALTER TABLE financial_transactions ADD COLUMN rental_id UUID REFERENCES rentals(id) ON DELETE SET NULL;
    END IF;
END $$;

-- Migrate existing rental payments
-- Only insert if not already exists (to prevent duplicates on multiple runs)
-- We check if a transaction exists for this rental_id with 'Aluguel' category
INSERT INTO financial_transactions (user_id, type, category, amount, description, date, rental_id, created_at)
SELECT 
    r.user_id,
    'income' as type,
    'Aluguel' as category,
    r.down_payment as amount,
    'Receita de Aluguel #' || substring(r.id::text, 1, 8) as description,
    r.created_at::date as date, -- Best approximation for past payments
    r.id as rental_id,
    r.created_at
FROM rentals r
WHERE 
    r.down_payment > 0 
    AND NOT EXISTS (
        SELECT 1 FROM financial_transactions ft 
        WHERE ft.rental_id = r.id
    );
