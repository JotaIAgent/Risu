import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@14.14.0?target=deno'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Plan Mapping for standardization
const PLAN_MAPPING: Record<string, string> = {
    'price_1SqHrZJrvxBiHEjISBIjF1Xg': 'Risu Mensal',
    'price_1SqHtTJrvxBiHEIgyTx6ECr': 'Risu Trimestral',
    'price_1SqHu6JrvxBiHEjIcFJOrE7Y': 'Risu Semestral',
    'price_1SqHuVJrvxBiHEjIUNJCWLFm': 'Risu Anual',
}

console.log("Get Billing Info v3.0 - Full Automation (State Detector)")

serve(async (req: Request) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

    try {
        const authHeader = req.headers.get('Authorization')
        const userClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: authHeader } } })
        const { data: { user } } = await userClient.auth.getUser()
        if (!user) return new Response('Unauthorized', { status: 401 })

        const serviceClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
        const { data: sub } = await serviceClient.from('saas_subscriptions').select('*').eq('user_id', user.id).maybeSingle()
        if (!sub?.stripe_customer_id) return new Response(JSON.stringify({ planName: 'Sem Assinatura', subscriptionStatus: 'none', invoices: [], events: [] }), { status: 200, headers: corsHeaders })

        const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, { apiVersion: '2023-10-16' })

        let planName = sub.plan_name || 'Risu Mensal'
        let status = sub.status
        let nextBillingDate = sub.current_period_end

        if (sub.stripe_subscription_id) {
            const stripeSub = await stripe.subscriptions.retrieve(sub.stripe_subscription_id, { expand: ['items.data.price.product'] })
            status = stripeSub.status
            nextBillingDate = new Date(stripeSub.current_period_end * 1000).toISOString()

            const priceId = stripeSub.items?.data?.[0]?.price?.id
            const prodName = (stripeSub.items?.data?.[0]?.price?.product as any)?.name

            // Standardize name: Mapping -> Product Name -> Catch 'Risu' -> Fallback
            planName = (priceId ? PLAN_MAPPING[priceId] : null) || prodName || 'Risu Mensal'
            if (planName === 'Risu') planName = 'Risu Mensal'

            // --- STATE CHANGE DETECTOR (The Automation Engine) ---
            const { data: lastEvents } = await serviceClient
                .from('subscription_events')
                .select('event_type')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false })
                .limit(1)

            const lastType = lastEvents?.[0]?.event_type
            let eventToLog = null
            let eventDesc = ''

            // Case A: Reactivation (Stripe is active, but last event was a cancellation)
            if (status === 'active' && !stripeSub.cancel_at_period_end && (lastType === 'canceled' || lastType === 'cancellation_scheduled')) {
                eventToLog = 'reactivated'
                eventDesc = 'Assinatura reativada com sucesso direto pela Stripe.'
            }
            // Case B: Scheduled Cancellation (User clicked cancel in portal)
            else if (stripeSub.cancel_at_period_end && lastType !== 'cancellation_scheduled') {
                eventToLog = 'cancellation_scheduled'
                eventDesc = `Cancelamento agendado para ${new Date(stripeSub.current_period_end * 1000).toLocaleDateString('pt-BR')}.`
            }
            // Case C: Final Cancellation (Subscription is now marked as canceled)
            else if (status === 'canceled' && lastType !== 'canceled') {
                eventToLog = 'canceled'
                eventDesc = 'Sua assinatura foi cancelada conforme solicitado.'
            }

            if (eventToLog) {
                console.log(`Auto-logging event: ${eventToLog} for user: ${user.id}`)
                await serviceClient.from('subscription_events').insert({
                    user_id: user.id,
                    event_type: eventToLog,
                    description: eventDesc,
                    plan_name: planName
                })
            }

            // Sync Database with Service Role
            await serviceClient.from('saas_subscriptions').update({
                status: status,
                plan_name: planName,
                current_period_end: nextBillingDate,
                updated_at: new Date().toISOString()
            }).eq('user_id', user.id)
        }

        const invoices = await stripe.invoices.list({ customer: sub.stripe_customer_id, limit: 10 })
        const dbEvents = await serviceClient.from('subscription_events').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(10)

        return new Response(JSON.stringify({
            planName,
            subscriptionStatus: status,
            nextBillingDate,
            invoices: invoices.data.map((i: any) => ({
                id: i.id,
                amount: i.amount_paid / 100,
                created: new Date(i.created * 1000).toISOString(),
                description: i.lines?.data?.[0]?.description || planName,
                pdfUrl: i.invoice_pdf
            })),
            events: dbEvents.data?.map((e: any) => ({
                id: e.id,
                type: 'event',
                eventType: e.event_type,
                description: e.description,
                created: e.created_at
            }))
        }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } })

    } catch (e: unknown) {
        return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } })
    }
})
