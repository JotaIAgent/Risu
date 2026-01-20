
-- Add contract_pdf_template to user_settings for customizable PDF content
alter table public.user_settings 
add column if not exists contract_pdf_template jsonb default '{
  "title": "CONTRATO DE LOCAÇÃO DE EQUIPAMENTO",
  "clauses": [
    "O LOCATÁRIO se compromete a devolver o equipamento nas mesmas condições em que o recebeu, no prazo estabelecido.",
    "Qualquer dano causado ao equipamento será de responsabilidade do LOCATÁRIO.",
    "O atraso na devolução acarretará em multa de 20% sobre o valor da diária por dia de atraso.",
    "O LOCATÁRIO declara ter recebido o equipamento em perfeitas condições de uso."
  ]
}'::jsonb;
