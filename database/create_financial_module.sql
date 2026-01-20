-- Create financial_transactions table
CREATE TABLE IF NOT EXISTS financial_transactions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
    category TEXT NOT NULL, -- e.g., 'Maintenance', 'Bill', 'Purchase', 'Other', 'Rental Income' (though rental income usually calc from rentals)
    amount NUMERIC NOT NULL,
    description TEXT,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    item_id UUID REFERENCES items(id) ON DELETE SET NULL, -- Optional link to an item (e.g., for maintenance costs)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE financial_transactions ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own transactions" 
    ON financial_transactions FOR SELECT 
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own transactions" 
    ON financial_transactions FOR INSERT 
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own transactions" 
    ON financial_transactions FOR UPDATE 
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own transactions" 
    ON financial_transactions FOR DELETE 
    USING (auth.uid() = user_id);

-- Add purchase_price column to items table if it doesn't exist
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'items' AND column_name = 'purchase_price') THEN
        ALTER TABLE items ADD COLUMN purchase_price NUMERIC DEFAULT 0;
    END IF;
END $$;
