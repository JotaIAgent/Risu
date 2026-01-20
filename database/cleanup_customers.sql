-- 1. PRIMEIRO: Execute esta parte para ver quem são os clientes sem CPF
select id, name, created_at, whatsapp 
from customers 
where cpf is null or cpf = '' or length(cpf) < 5;

-- 2. SE QUISER EXCLUIR, DESCOMENTE e execute o comando abaixo:
-- delete from customers 
-- where (cpf is null or cpf = '' or length(cpf) < 5)
-- and id not in (select client_id from rentals); -- Proteção para não apagar quem já tem aluguel!
