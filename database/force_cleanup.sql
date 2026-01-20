-- TENTATIVA DE EXCLUSÃO MAIS FORTE

-- 1. Apagar clientes sem CPF que NÃO têm alugueis (Seguro)
DELETE FROM customers 
WHERE (cpf IS NULL OR cpf = '' OR length(cpf) < 5)
AND id NOT IN (SELECT client_id FROM rentals);

-- 2. Verificar se sobrou alguém (provavelmente porque tem histórico de aluguel)
SELECT id, name, created_at, 'TEM ALUGUEL' as motivo
FROM customers 
WHERE (cpf IS NULL OR cpf = '' OR length(cpf) < 5);

-- SE A LISTA ACIMA RETORNAR ALGUÉM E VOCÊ QUISER APAGAR MESMO ASSIM (PERDENDO HISTÓRICO):
-- Descomente as linhas abaixo com MUITO CUIDADO:

-- DELETE FROM rentals WHERE client_id IN (SELECT id FROM customers WHERE cpf IS NULL OR cpf = '' OR length(cpf) < 5);
-- DELETE FROM customers WHERE cpf IS NULL OR cpf = '' OR length(cpf) < 5;
