-- Add return_observations column to track historical notes for each rental
ALTER TABLE public.rentals ADD COLUMN IF NOT EXISTS return_observations TEXT;
