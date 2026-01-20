-- Migration: Split replacement_value into distinct fines

-- 1. Add new columns
ALTER TABLE public.items
ADD COLUMN IF NOT EXISTS lost_fine numeric(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS damage_fine numeric(10,2) DEFAULT 0;

-- 2. Migrate existing data (Optional: Use replacement_value as default for both? Or just 0?)
-- User said "remove replacement value", implying a change in logic.
-- Safer Strategy: Copy old value to both just in case, or leave 0 if user wants to set it correctly.
-- Let's copy it so we don't return 0.00 for everything immediately.
UPDATE public.items 
SET lost_fine = replacement_value, damage_fine = replacement_value
WHERE replacement_value IS NOT NULL;

-- 3. Remove old column
-- Note: It is safer to drop it after checking code, but user requested "tire esse valor".
ALTER TABLE public.items
DROP COLUMN IF EXISTS replacement_value;
