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

        // 2. Initialize Supabase Clients
        // Client with user token for auth validation
        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_ANON_KEY') ?? '',
            { global: { headers: { Authorization: authHeader } } }
        )

        // Admin client to bypass RLS for subscription management
        const supabaseAdmin = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
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

        // 5. Check if customer exists in DB - Using Admin to be sure
        const { data: subscription, error: subFetchError } = await supabaseAdmin
            .from('saas_subscriptions')
            .select('stripe_customer_id')
            .eq('user_id', user.id)
            .maybeSingle()

        if (subFetchError) {
            console.error('Subscription fetch error:', subFetchError)
        }

        let customerId = subscription?.stripe_customer_id

        // 6. Create Stripe Customer if not exists
        if (!customerId) {
            console.log('No customerId found, creating new Stripe customer for:', user.email)
            try {
                const customer = await stripe.customers.create({
                    email: user.email,
                    metadata: {
                        supabase_user_id: user.id
                    }
                })
                customerId = customer.id
                console.log('Stripe customer created:', customerId)

                // Save to DB (Upsert using ADMIN to bypass RLS)
                const { error: upsertError } = await supabaseAdmin
                    .from('saas_subscriptions')
                    .upsert({
                        user_id: user.id,
                        stripe_customer_id: customerId,
                        status: subscription?.status || 'incomplete'
                    })

                if (upsertError) {
                    console.error('Failed to save customerId to DB (Admin):', upsertError)
                } else {
                    console.log('CustomerID saved to DB (Admin)')
                }
            } catch (stripeErr: any) {
                console.error('Stripe customer creation failed:', stripeErr)
                throw new Error(`Stripe Customer Error: ${stripeErr.message || String(stripeErr)}`)
            }
        }

        console.log('Using Customer ID:', customerId)
        console.log('Price ID:', priceId)

        // 7. Create Checkout Session
        try {
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
        } catch (checkoutErr: any) {
            console.error('Stripe Checkout Error:', checkoutErr)
            return new Response(JSON.stringify({
                error: `Checkout Error: ${checkoutErr.message || String(checkoutErr)}`,
                type: 'stripe_checkout_error',
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
            type: 'runtime_error',
            stack: error instanceof Error ? error.stack : undefined
        }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 400,
        })
    }
})
