-- Fix rentals table (Critical for Quotes vs Rentals logic)
ALTER TABLE public.rentals 
ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'rental';

-- Fix rental_checklists (rename type -> stage if needed)
DO $$
BEGIN
    -- Only rename if 'type' exists and 'stage' does not
    IF EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = 'rental_checklists' AND column_name = 'type') THEN
        ALTER TABLE public.rental_checklists RENAME COLUMN type TO stage;
    -- If 'stage' implies it's already correct, do nothing. If neither exists, add 'stage'
    ELSIF NOT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = 'rental_checklists' AND column_name = 'stage') THEN
        ALTER TABLE public.rental_checklists ADD COLUMN stage TEXT DEFAULT 'CHECKOUT';
    END IF;
END $$;

-- Fix rental_photos (rename type -> stage if needed)
DO $$
BEGIN
    IF EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = 'rental_photos' AND column_name = 'type') THEN
        ALTER TABLE public.rental_photos RENAME COLUMN type TO stage;
    ELSIF NOT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = 'rental_photos' AND column_name = 'stage') THEN
        ALTER TABLE public.rental_photos ADD COLUMN stage TEXT DEFAULT 'CHECKOUT';
    END IF;
END $$;

-- Add quantity to checklists (The original fix needed)
ALTER TABLE public.rental_checklists
ADD COLUMN IF NOT EXISTS quantity NUMERIC(10,2) DEFAULT 0;

-- Add rental_item_id to checklists (Needed for split quantities per item)
ALTER TABLE public.rental_checklists
ADD COLUMN IF NOT EXISTS rental_item_id UUID REFERENCES public.rental_items(id) ON DELETE SET NULL;
