import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@14.14.0?target=deno'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

console.log("Create Checkout Function v2")

serve(async (req: Request) => {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const { priceId, successUrl, cancelUrl } = await req.json()

        // 1. Auth Header Check
        const authHeader = req.headers.get('Authorization')
        if (!authHeader) {
            return new Response(JSON.stringify({ error: 'No authorization header' }), {
                status: 401,
                headers: { ...corsHeaders, "Content-Type": "application/json" }
            })
        }

        // 2. Initialize Supabase Client
        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_ANON_KEY') ?? '',
            { global: { headers: { Authorization: authHeader } } }
        )

        // 3. Get User
        const { data: { user }, error: userError } = await supabaseClient.auth.getUser()
        if (userError || !user) {
            console.error('User error:', userError)
            return new Response(JSON.stringify({ error: 'Invalid user token' }), {
                status: 401,
                headers: { ...corsHeaders, "Content-Type": "application/json" }
            })
        }

        console.log('User authenticated:', user.email)

        // 4. Initialize Stripe
        const stripeKey = Deno.env.get('STRIPE_SECRET_KEY')
        if (!stripeKey) {
            return new Response(JSON.stringify({ error: 'Stripe not configured' }), {
                status: 500,
                headers: { ...corsHeaders, "Content-Type": "application/json" }
            })
        }

        const stripe = new Stripe(stripeKey, {
            apiVersion: '2023-10-16',
        })

        // 5. Check if customer exists in DB
        const { data: subscription } = await supabaseClient
            .from('saas_subscriptions')
            .select('stripe_customer_id')
            .eq('user_id', user.id)
            .maybeSingle()

        let customerId = subscription?.stripe_customer_id

        // 6. Create Stripe Customer if not exists
        if (!customerId) {
            console.log('Creating new Stripe customer for:', user.email)
            const customer = await stripe.customers.create({
                email: user.email,
                metadata: {
                    supabase_user_id: user.id
                }
            })
            customerId = customer.id

            // Save to DB
            await supabaseClient
                .from('saas_subscriptions')
                .update({ stripe_customer_id: customerId })
                .eq('user_id', user.id)
        }

        console.log('Customer ID:', customerId)

        // 7. Create Checkout Session
        const session = await stripe.checkout.sessions.create({
            customer: customerId,
            line_items: [
                {
                    price: priceId,
                    quantity: 1,
                },
            ],
            mode: 'subscription',
            success_url: successUrl,
            cancel_url: cancelUrl,
            metadata: {
                supabase_user_id: user.id
            },
            subscription_data: {
                metadata: {
                    supabase_user_id: user.id
                }
            }
        })

        console.log('Checkout session created:', session.id)

        return new Response(
            JSON.stringify({ sessionId: session.id, url: session.url }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        )
    } catch (error) {
        console.error('Function error:', error)
        return new Response(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 400,
        })
    }
})
