-- Update check constraint for status column in rentals table
-- First drop the existing constraint
ALTER TABLE rentals DROP CONSTRAINT IF EXISTS rentals_status_check;

-- Add the new constraint with all valid statuses
ALTER TABLE rentals ADD CONSTRAINT rentals_status_check 
    CHECK (status IN (
        'pending',      -- Aguardando pagamento/confirmação (Locação)
        'confirmed',    -- Confirmado/Pago (Locação)
        'in_progress',  -- Em andamento/Itens retirados (Locação)
        'completed',    -- Finalizado/Devolvido (Locação)
        'canceled',     -- Cancelado (Geral)
        
        -- New Statuses for Quotes
        'draft',        -- Rascunho
        'sent',         -- Enviado
        'approved',     -- Aprovado pelo cliente
        'refused',      -- Recusado pelo cliente
        'expired',      -- Expirado
        'converted'     -- Convertido em locação
    ));

-- Comment on column for clarity
COMMENT ON COLUMN rentals.status IS 'Lifecycle status: pending, confirmed, in_progress, completed, canceled, draft, sent, approved, refused, expired, converted';
