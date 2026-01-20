# Guia: Recebendo Mensagens do WhatsApp no App (Evolution API v2)

Este guia foi atualizado para **Evolution API v2.3.7**. Siga EXATAMENTE estes passos para resolver o problema de comunicação.

## 1. Ajuste Final no Banco de Dados (Supabase)

Copie e rode este SQL para criar a função que entende exatamente o formato da Evolution.

```sql
-- 1. Limpeza garantida de versões antigas
DROP FUNCTION IF EXISTS public.handle_evolution_webhook(jsonb);
DROP FUNCTION IF EXISTS public.handle_evolution_webhook(text, text, jsonb);
DROP FUNCTION IF EXISTS public.handle_evolution_webhook(text, text, jsonb, jsonb);
DROP FUNCTION IF EXISTS public.handle_evolution_webhook(text, text, jsonb, jsonb, text, jsonb);

-- 2. Tabela de Debug (Se ainda não existir)
CREATE TABLE IF NOT EXISTS public.whatsapp_webhook_debug (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    received_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    remote_number TEXT,
    content TEXT,
    result TEXT,
    payload JSONB
);

-- 3. FUNÇÃO OFICIAL PARA EVOLUTION API V2
-- Ela recebe os campos como argumentos separados, pois a Evolution manda o JSON solto.
CREATE OR REPLACE FUNCTION public.handle_evolution_webhook(
    event text DEFAULT NULL,
    instance text DEFAULT NULL,
    data jsonb DEFAULT NULL,
    sender jsonb DEFAULT NULL,
    apikey text DEFAULT NULL,
    global_account jsonb DEFAULT NULL,
    destination text DEFAULT NULL,
    date_time text DEFAULT NULL,
    server_url text DEFAULT NULL
)
RETURNS json AS $$
DECLARE
    v_content TEXT;
    v_number TEXT;
    v_customer_id UUID;
    v_user_id UUID;
    v_from_me BOOLEAN;
    v_debug_payload JSONB;
BEGIN
    -- Montar payload para debug com tudo que foi recebido
    v_debug_payload := json_build_object(
        'event', event,
        'instance', instance,
        'data', data,
        'sender', sender
    );

    -- 1. REGISTRA O SINAL (Para sabermos que a Evolution bateu aqui)
    INSERT INTO public.whatsapp_webhook_debug (remote_number, content, result, payload) 
    VALUES ('EVO_V2_CHECK', COALESCE(event, 'no_event'), instance, v_debug_payload);

    -- Verifica se temos dados
    IF data IS NULL THEN 
        RETURN json_build_object('status', 'ignored_no_data'); 
    END IF;

    -- 2. EXTRAIR CONTEÚDO
    v_content := COALESCE(
        data->'message'->>'conversation',
        data->'message'->'extendedTextMessage'->>'text',
        data->'message'->'imageMessage'->>'caption'
    );
    
    -- Ignorar se não for mensagem de texto válida
    IF v_content IS NULL THEN 
        RETURN json_build_object('status', 'ignored_no_content'); 
    END IF;

    v_from_me := (data->'key'->>'fromMe')::boolean;
    
    -- Ignorar mensagens enviadas por MIM (outgoing)
    -- O App já salva elas quando eu envio. Se salvar de novo, duplica.
    IF v_from_me THEN 
        RETURN json_build_object('status', 'ignored_from_me'); 
    END IF;

    v_number := split_part(data->'key'->>'remoteJid', '@', 1);

    -- 3. ENCONTRAR O CLIENTE (Ignorando 9º dígito e 55)
    SELECT id, user_id INTO v_customer_id, v_user_id 
    FROM public.customers 
    WHERE 
        -- Compara os últimos 8 dígitos (ignora DDD, 55 e 9º dígito se houver divergência)
        right(regexp_replace(whatsapp, '\D', '', 'g'), 8) = right(v_number, 8)
    LIMIT 1;

    -- 4. SALVAR A MENSAGEM
    IF v_customer_id IS NOT NULL THEN
        INSERT INTO public.whatsapp_logs (customer_id, user_id, content, direction, status)
        VALUES (v_customer_id, v_user_id, v_content, 'incoming', 'received');
        RETURN json_build_object('status', 'success', 'customer', v_customer_id);
    ELSE
        RETURN json_build_object('status', 'customer_not_found', 'number', v_number);
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Permissões de acesso
GRANT EXECUTE ON FUNCTION public.handle_evolution_webhook(text, text, jsonb, jsonb, text, jsonb, text, text, text) TO anon;
GRANT EXECUTE ON FUNCTION public.handle_evolution_webhook(text, text, jsonb, jsonb, text, jsonb, text, text, text) TO authenticated;
GRANT ALL ON public.whatsapp_webhook_debug TO anon;
GRANT ALL ON public.whatsapp_webhook_debug TO authenticated;
```

## 2. Ajuste CRÍTICO na Evolution API

Vá no painel da Evolution e configure exatamente assim:

1.  **Webhook por Eventos**: **DESLIGADO** (Isso é obrigatório!).
    *   *Por que?* Se ficar ligado, a Evolution muda a URL para `.../handle_evolution_webhook/MESSAGES_UPSERT`, e o Supabase não entende isso. Queremos que ela mande para a URL pura.
    
2.  **Eventos**: Certifique-se de que `MESSAGES_UPSERT` está ativado na lista.

3.  **Webhook Base64**: **DESLIGADO**.

4.  **URL**: `https://[SEU_PROJETO].supabase.co/rest/v1/rpc/handle_evolution_webhook?apikey=[SUA_CHAVE]`

5.  Clique em **SALVAR**.

---

### Teste
Mande uma mensagem do celular. Depois, verifique a tabela de debug:
`SELECT * FROM whatsapp_webhook_debug ORDER BY received_at DESC LIMIT 5;`

Se aparecer "EVO_V2_CHECK", funcionou!
