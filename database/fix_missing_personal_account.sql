-- Fix Missing Personal Account
-- The previous migration (evolve_finance_v2) missed creating the Personal Account.
-- This script fixes that by creating a 'Conta Pessoal' for any user who has a Business account but no Personal account.

CREATE OR REPLACE FUNCTION fix_missing_personal_account()
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
    acc_record record;
BEGIN
    -- Iterate over users who have at least one account but NO personal account
    FOR acc_record IN 
        SELECT DISTINCT user_id 
        FROM accounts 
        WHERE user_id NOT IN (
            SELECT user_id FROM accounts WHERE context = 'personal'
        )
    LOOP
        INSERT INTO accounts (user_id, name, context, type, is_default, balance, color)
        VALUES (acc_record.user_id, 'Conta Pessoal', 'personal', 'bank', false, 0, 'purple');
        
    END LOOP;
END;
$$;

-- Run the fix
SELECT fix_missing_personal_account();

-- Drop the function
DROP FUNCTION fix_missing_personal_account();
