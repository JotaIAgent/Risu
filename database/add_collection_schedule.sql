
-- Add collection schedule settings to user_settings
ALTER TABLE public.user_settings 
ADD COLUMN IF NOT EXISTS collection_schedule jsonb DEFAULT '{
  "reminder_days": [0, 5],
  "daily_after_days": 10,
  "enabled": true
}'::jsonb;
