import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { PaymentProviderFactory } from '../_shared/gateway_adapters.ts'

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

console.log("Get Billing Info v4.0 - Multi-Gateway Architecture")

serve(async (req: Request) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

    try {
        const authHeader = req.headers.get('Authorization')
        const userClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: authHeader } } })
        const { data: { user } } = await userClient.auth.getUser()
        if (!user) return new Response('Unauthorized', { status: 401 })

        const serviceClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

        // Fetch all subscriptions for the user to handle duplicates
        const { data: subs } = await serviceClient
            .from('saas_subscriptions')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })

        if (!subs || subs.length === 0) {
            return new Response(JSON.stringify({ planName: 'Sem Assinatura', subscriptionStatus: 'none', invoices: [], events: [] }), { status: 200, headers: corsHeaders })
        }

        // Pick the best one: active > trialing > rest. Favor asaas if both active.
        const sub = subs.find(s => s.status === 'active' && s.gateway_name === 'asaas') ||
            subs.find(s => s.status === 'active') ||
            subs.find(s => s.status === 'trialing') ||
            subs[0];

        const provider = PaymentProviderFactory.getProvider(sub.gateway_name);

        let planName = sub.plan_name || 'Plano Profissional'
        let status = sub.status
        let nextBillingDate = sub.current_period_end

        if (sub.gateway_customer_id && sub.gateway_subscription_id) {
            try {
                const gatewaySub = await provider.getSubscriptionStatus(sub.gateway_subscription_id);

                // Mapping
                if (sub.gateway_name === 'stripe') {
                    status = gatewaySub.status
                    nextBillingDate = new Date(gatewaySub.current_period_end * 1000).toISOString()
                    const priceId = gatewaySub.items?.data?.[0]?.price?.id
                    planName = (priceId ? PLAN_MAPPING[priceId] : null) || gatewaySub.items?.data?.[0]?.price?.product?.name || planName
                } else if (sub.gateway_name === 'asaas') {
                    // ASAAS normalization
                    status = (gatewaySub.status === 'ACTIVE' || gatewaySub.status === 'active') ? 'active' : 'inactive'
                    if (gatewaySub.nextDueDate) {
                        nextBillingDate = new Date(gatewaySub.nextDueDate).toISOString()
                    }
                } else {
                    // Generic fallback
                    status = gatewaySub.status || status
                }

                // --- STATE CHANGE DETECTOR ---
                const { data: lastEvents } = await serviceClient
                    .from('subscription_events')
                    .select('event_type')
                    .eq('user_id', user.id)
                    .order('created_at', { ascending: false })
                    .limit(1)

                const lastType = lastEvents?.[0]?.event_type
                let eventToLog = null
                let eventDesc = ''

                // Case-specific logic (currently mostly Stripe-tailored, but generic enough)
                if (status === 'active' && lastType === 'canceled') {
                    eventToLog = 'reactivated'
                    eventDesc = 'Assinatura reativada com sucesso.'
                } else if (status === 'canceled' && lastType !== 'canceled') {
                    eventToLog = 'canceled'
                    eventDesc = 'Sua assinatura foi cancelada.'
                }

                if (eventToLog) {
                    await serviceClient.from('subscription_events').insert({
                        user_id: user.id,
                        event_type: eventToLog,
                        description: eventDesc,
                        plan_name: planName
                    })
                }

                // Sync Database
                await serviceClient.from('saas_subscriptions').update({
                    status: status,
                    plan_name: planName,
                    current_period_end: nextBillingDate,
                    updated_at: new Date().toISOString()
                }).eq('user_id', user.id)
            } catch (err) {
                console.error('Error fetching gateway subscription info:', err);
            }
        }

        const gatewayInvoices = await provider.getInvoices(sub.gateway_customer_id);
        const dbEvents = await serviceClient.from('subscription_events').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(10)

        // Normalize invoices for the frontend
        const normalizedInvoices = gatewayInvoices.map((i: any) => {
            if (sub.gateway_name === 'stripe') {
                return {
                    id: i.id,
                    amount: i.amount_paid / 100,
                    created: new Date(i.created * 1000).toISOString(),
                    description: i.lines?.data?.[0]?.description || planName,
                    pdfUrl: i.invoice_pdf
                };
            }
            if (sub.gateway_name === 'asaas') {
                return {
                    id: i.id,
                    amount: i.value,
                    created: i.dateCreated ? new Date(i.dateCreated).toISOString() : new Date().toISOString(),
                    description: i.description || planName,
                    pdfUrl: i.invoiceUrl || i.bankSlipUrl
                };
            }
            return i;
        });

        return new Response(JSON.stringify({
            planName,
            subscriptionStatus: status,
            nextBillingDate,
            invoices: normalizedInvoices,
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
