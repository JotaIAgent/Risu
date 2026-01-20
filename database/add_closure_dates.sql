-- Add closed_at column to maintenance_logs and lost_logs for precise history tracking
ALTER TABLE public.maintenance_logs ADD COLUMN IF NOT EXISTS closed_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.lost_logs ADD COLUMN IF NOT EXISTS closed_at TIMESTAMP WITH TIME ZONE;

-- Add comment for documentation
COMMENT ON COLUMN public.maintenance_logs.closed_at IS 'Timestamp when the maintenance batch was (partially) closed.';
COMMENT ON COLUMN public.lost_logs.closed_at IS 'Timestamp when the loss/breakage batch was (partially) closed.';
