-- Add reason column to maintenance_logs to distinguish between 'broken' and 'routine'
ALTER TABLE public.maintenance_logs 
ADD COLUMN IF NOT EXISTS reason TEXT CHECK (reason IN ('ROUTINE', 'BROKEN', 'OTHER')) DEFAULT 'ROUTINE';

-- Ensure we can query by reason for analytics
CREATE INDEX IF NOT EXISTS idx_maintenance_logs_reason ON public.maintenance_logs (reason);
