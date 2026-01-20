-- Create the 'rentals' bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('rentals', 'rentals', true)
ON CONFLICT (id) DO NOTHING;

-- Policy to allow anyone to read files (for proofs/receipts)
CREATE POLICY "Public Access"
ON storage.objects FOR SELECT
USING ( bucket_id = 'rentals' );

-- Policy to allow authenticated users to upload files
CREATE POLICY "Auth Upload"
ON storage.objects FOR INSERT
WITH CHECK ( bucket_id = 'rentals' AND auth.role() = 'authenticated' );

-- Policy to allow authenticated users to update their files (optional but good)
CREATE POLICY "Auth Update"
ON storage.objects FOR UPDATE
USING ( bucket_id = 'rentals' AND auth.role() = 'authenticated' );
