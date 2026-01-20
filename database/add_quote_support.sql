
-- Add type column to rentals table to distinguish between rentals and quotes
ALTER TABLE public.rentals ADD COLUMN IF NOT EXISTS type text DEFAULT 'rental';

-- Add check constraint for type
ALTER TABLE public.rentals DROP CONSTRAINT IF EXISTS rentals_type_check;
ALTER TABLE public.rentals ADD CONSTRAINT rentals_type_check CHECK (type IN ('rental', 'quote'));

-- Add column to store quote PDF if needed
ALTER TABLE public.rentals ADD COLUMN IF NOT EXISTS quote_url text;

-- Add index for better filtering
CREATE INDEX IF NOT EXISTS idx_rentals_type ON public.rentals(type);
