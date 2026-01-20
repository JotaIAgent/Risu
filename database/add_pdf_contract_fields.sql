
-- Add message template fields for PDF contract flow
alter table public.user_settings 
add column if not exists pdf_message text default 'Segue em anexo o contrato de aluguel. Por favor, leia com atenção.',
add column if not exists signature_message text default 'Para assinar digitalmente, você pode usar o Assinador Gov.br: https://www.gov.br/governodigital/pt-br/identidade/assinatura-eletronica ou qualquer ferramenta de sua preferência.',
add column if not exists upload_message text default 'Após assinar, envie o documento de volta através deste link: {upload_link}';

-- Add contract_status to rentals table to track signature status
alter table public.rentals
add column if not exists contract_status text default 'pending' check (contract_status in ('pending', 'sent', 'signed', 'completed'));

-- Add signed_contract_url to store the uploaded signed PDF
alter table public.rentals
add column if not exists signed_contract_url text;
