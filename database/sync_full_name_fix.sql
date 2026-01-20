UPDATE public.profiles p
SET 
  full_name = COALESCE(u.raw_user_meta_data->>'full_name', p.full_name)
FROM auth.users u
WHERE p.id = u.id 
  AND (p.full_name IS NULL OR p.full_name = '' OR p.full_name = split_part(p.email, '@', 1));

-- Additionally sync other metadata fields if they are missing in profile but exist in auth
UPDATE public.profiles p
SET 
  tax_id = COALESCE(p.tax_id, u.raw_user_meta_data->>'tax_id'),
  whatsapp = COALESCE(p.whatsapp, u.raw_user_meta_data->>'whatsapp'),
  company_name = COALESCE(p.company_name, u.raw_user_meta_data->>'company_name'),
  city = COALESCE(p.city, u.raw_user_meta_data->>'city'),
  state = COALESCE(p.state, u.raw_user_meta_data->>'state')
FROM auth.users u
WHERE p.id = u.id;
