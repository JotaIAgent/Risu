-- Add replacement_value to items
ALTER TABLE public.items 
ADD COLUMN IF NOT EXISTS replacement_value NUMERIC(10,2) DEFAULT 0;

-- Update log tables to link to rentals
ALTER TABLE public.broken_logs 
ADD COLUMN IF NOT EXISTS rental_id UUID REFERENCES public.rentals(id) ON DELETE SET NULL;

ALTER TABLE public.lost_logs 
ADD COLUMN IF NOT EXISTS rental_id UUID REFERENCES public.rentals(id) ON DELETE SET NULL;

ALTER TABLE public.maintenance_logs 
ADD COLUMN IF NOT EXISTS rental_id UUID REFERENCES public.rentals(id) ON DELETE SET NULL;

-- Add damage_fee to rentals
ALTER TABLE public.rentals
ADD COLUMN IF NOT EXISTS damage_fee NUMERIC(10,2) DEFAULT 0;

-- Create rental_checklists table
CREATE TABLE IF NOT EXISTS public.rental_checklists (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) NOT NULL,
    rental_id UUID REFERENCES public.rentals(id) ON DELETE CASCADE NOT NULL,
    item_id UUID REFERENCES public.items(id) ON DELETE CASCADE NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('CHECKOUT', 'CHECKIN')),
    status TEXT NOT NULL DEFAULT 'OK', -- OK, DIRTY, BROKEN, PARTIAL
    observations TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now())
);

-- Create rental_photos table
CREATE TABLE IF NOT EXISTS public.rental_photos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) NOT NULL,
    rental_id UUID REFERENCES public.rentals(id) ON DELETE CASCADE NOT NULL,
    photo_url TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('CHECKOUT', 'CHECKIN')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now())
);

-- Create storage bucket for rental evidence
INSERT INTO storage.buckets (id, name, public)
VALUES ('rental-evidence', 'rental-evidence', true)
ON CONFLICT (id) DO NOTHING;

-- Set up RLS policies for rental-evidence bucket
DO $$
BEGIN
    DROP POLICY IF EXISTS "Allow authenticated uploads to rental-evidence" ON storage.objects;
    DROP POLICY IF EXISTS "Allow public read access to rental-evidence" ON storage.objects;
    DROP POLICY IF EXISTS "Allow authenticated users to delete in rental-evidence" ON storage.objects;
EXCEPTION
    WHEN undefined_object THEN null;
END $$;

CREATE POLICY "Allow authenticated uploads to rental-evidence"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'rental-evidence');

CREATE POLICY "Allow public read access to rental-evidence"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'rental-evidence');

CREATE POLICY "Allow authenticated users to delete in rental-evidence"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'rental-evidence');

-- Enable RLS for new tables
ALTER TABLE public.rental_checklists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rental_photos ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can manage their own rental checklists" 
    ON public.rental_checklists FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own rental photos" 
    ON public.rental_photos FOR ALL USING (auth.uid() = user_id);
