import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { PaymentProviderFactory } from '../_shared/gateway_adapters.ts'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

console.log("Create Checkout Function v3 (Multi-Gateway)")

serve(async (req: Request) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const { priceId, successUrl, cancelUrl } = await req.json()

        const authHeader = req.headers.get('Authorization')
        if (!authHeader) {
            return new Response(JSON.stringify({ error: 'No authorization header' }), {
                status: 401,
                headers: { ...corsHeaders, "Content-Type": "application/json" }
            })
        }

        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_ANON_KEY') ?? '',
            { global: { headers: { Authorization: authHeader } } }
        )

        const supabaseAdmin = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        const { data: { user }, error: userError } = await supabaseClient.auth.getUser()
        if (userError || !user) {
            console.error('User error:', userError)
            return new Response(JSON.stringify({ error: 'Invalid user token' }), {
                status: 401,
                headers: { ...corsHeaders, "Content-Type": "application/json" }
            })
        }

        console.log('User authenticated:', user.email)

        // Fetch User Profile for tax_id and full_name
        const { data: profile } = await supabaseAdmin
            .from('profiles')
            .select('tax_id, full_name')
            .eq('id', user.id)
            .single()

        // Initialize Payment Provider via Factory
        const activeGatewayName = (Deno.env.get('ACTIVE_GATEWAY') || 'stripe').toLowerCase()
        const provider = PaymentProviderFactory.getProvider();

        // 5. Check if customer exists in DB for the ACTIVE gateway
        const { data: subscription, error: subFetchError } = await supabaseAdmin
            .from('saas_subscriptions')
            .select('gateway_customer_id, gateway_name, status')
            .eq('user_id', user.id)
            .maybeSingle()

        if (subFetchError) {
            console.error('Subscription fetch error:', subFetchError)
        }

        // We only reuse the customerId if the gateway matches
        let customerId = (subscription?.gateway_name === activeGatewayName)
            ? subscription?.gateway_customer_id
            : null

        // 6. Create Customer if not exists or if gateway changed
        if (!customerId) {
            console.log(`No customerId for ${activeGatewayName} found, creating new customer via provider for:`, user.email)
            try {
                customerId = await provider.createCustomer(
                    user.email!,
                    profile?.full_name || user.user_metadata?.full_name,
                    profile?.tax_id,
                    { supabase_user_id: user.id }
                )

                console.log('Provider customer created:', customerId)

                // Save to DB (update the gateway_name to match)
                const { error: upsertError } = await supabaseAdmin
                    .from('saas_subscriptions')
                    .upsert({
                        user_id: user.id,
                        gateway_customer_id: customerId,
                        gateway_name: activeGatewayName,
                        status: subscription?.status || 'incomplete'
                    })

                if (upsertError) {
                    console.error('Failed to save customerId to DB:', upsertError)
                }
            } catch (providerErr: any) {
                console.error('Customer creation failed:', providerErr)
                throw new Error(`Provider Customer Error: ${providerErr.message || String(providerErr)}`)
            }
        }

        console.log('Using Customer ID:', customerId)

        // 7. Create Checkout Session / URL
        try {
            const result = await provider.createCheckout({
                customerId,
                priceId,
                successUrl,
                cancelUrl,
                metadata: {
                    supabase_user_id: user.id
                }
            })

            console.log('Checkout session created:', result.sessionId)

            return new Response(
                JSON.stringify({
                    sessionId: result.sessionId,
                    url: result.url,
                    gateway: result.gateway
                }),
                { headers: { ...corsHeaders, "Content-Type": "application/json" } },
            )
        } catch (checkoutErr: any) {
            console.error('Checkout Error:', checkoutErr)
            return new Response(JSON.stringify({
                error: `Checkout Error: ${checkoutErr.message || String(checkoutErr)}`,
                type: 'checkout_error',
                details: checkoutErr
            }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
                status: 400,
            })
        }
    } catch (error) {
        console.error('Function execution failed:', error)
        return new Response(JSON.stringify({
            error: error instanceof Error ? error.message : String(error),
            type: 'runtime_error'
        }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 400,
        })
    }
})
