ALTER TABLE user_settings 
ADD COLUMN IF NOT EXISTS whatsapp_logistics_message TEXT;

-- Create an index if needed, though unlikely for a settings table
