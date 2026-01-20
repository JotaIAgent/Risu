-- Migration: Upgrade Rentals Module (Full Option A)

-- 1. EXPAND RENTAL STATUS
-- Drop existing check constraint if it exists (handling potentially different constraint names by trying standard ones or just replacing)
DO $$ 
BEGIN 
    -- Try to drop constraint if name is known, otherwise we might need dynamic SQL or manual intervention. 
    -- Standard naming convention often used: rentals_status_check
    ALTER TABLE public.rentals DROP CONSTRAINT IF EXISTS rentals_status_check;
    ALTER TABLE public.rentals DROP CONSTRAINT IF EXISTS rentals_status_check1; 
EXCEPTION
    WHEN OTHERS THEN NULL;
END $$;

-- Backfill/Migrate old statuses FIRST
-- 'active' -> 'confirmed' (default assumption)
UPDATE public.rentals SET status = 'confirmed' WHERE status = 'active';

-- Add new constraint with expanded statuses
-- 'pending' (converted/draft), 'confirmed' (booked), 'in_progress' (with client), 'completed' (returned/done), 'canceled'
ALTER TABLE public.rentals 
ADD CONSTRAINT rentals_status_check 
CHECK (status IN ('pending', 'confirmed', 'in_progress', 'completed', 'canceled'));

-- 2. CREATE RENTAL HISTORY (Audit Logs)
CREATE TABLE IF NOT EXISTS public.rental_logs (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    rental_id uuid REFERENCES public.rentals(id) ON DELETE CASCADE NOT NULL,
    user_id uuid REFERENCES auth.users(id) NOT NULL,
    action text NOT NULL, -- e.g., 'status_change', 'payment', 'edit'
    previous_value text,
    new_value text,
    details text, -- JSON or text description
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- RLS for Logs
ALTER TABLE public.rental_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own rental logs"
  ON public.rental_logs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own rental logs"
  ON public.rental_logs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- 3. PROOF OF PAYMENT (Financial Transactions)
-- Ensure table exists first (it should, but just in case)
CREATE TABLE IF NOT EXISTS public.financial_transactions (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id uuid REFERENCES auth.users(id) NOT NULL,
    rental_id uuid REFERENCES public.rentals(id) ON DELETE SET NULL,
    type text CHECK (type IN ('income', 'expense')) NOT NULL,
    category text NOT NULL,
    amount numeric(10,2) NOT NULL,
    description text,
    date date NOT NULL,
    item_id uuid REFERENCES public.items(id),
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Add Proof URL column
ALTER TABLE public.financial_transactions
ADD COLUMN IF NOT EXISTS proof_url text;

-- 4. ENSURE CONTRACT URL
ALTER TABLE public.rentals
ADD COLUMN IF NOT EXISTS signed_contract_url text;

-- 5. RLS for Financial Transactions (if not already there)
ALTER TABLE public.financial_transactions ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'financial_transactions') THEN
        CREATE POLICY "Users can manage their own transactions"
        ON public.financial_transactions
        USING (auth.uid() = user_id)
        WITH CHECK (auth.uid() = user_id);
    END IF;
END $$;
