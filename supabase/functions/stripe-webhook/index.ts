import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, stripe-signature',
}

// Mapeamento de priceId para nome do plano
const PLAN_MAPPING: Record<string, { name: string; billing_cycle: string; amount_cents: number }> = {
    'price_1SqHrZJrvxBiHEjISBIjF1Xg': { name: 'Risu Mensal', billing_cycle: 'monthly', amount_cents: 9990 },
    'price_1SqHtTJrvxBiHEIgyTx6ECr': { name: 'Risu Trimestral', billing_cycle: 'quarterly', amount_cents: 26970 },
    'price_1SqHu6JrvxBiHEjIcFJOrE7Y': { name: 'Risu Semestral', billing_cycle: 'semiannual', amount_cents: 47940 },
    'price_1SqHuVJrvxBiHEjIUNJCWLFm': { name: 'Risu Anual', billing_cycle: 'annual', amount_cents: 83880 },
}

console.log("Stripe Webhook v5 - With Events")

serve(async (req: Request) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const body = await req.text()
        const event = JSON.parse(body)

        console.log('Webhook event received:', event.type, event.id)

        const supabase = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        // Helper function to log subscription events
        const logEvent = async (userId: string, eventType: string, description: string, planName?: string, amountCents?: number, metadata?: any) => {
            try {
                await supabase.from('subscription_events').insert({
                    user_id: userId,
                    event_type: eventType,
                    description: description,
                    plan_name: planName,
                    amount_cents: amountCents,
                    metadata: metadata
                })
                console.log('Event logged:', eventType, 'for user:', userId)
            } catch (e) {
                console.error('Error logging event:', e)
            }
        }

        // Helper to find user by subscription ID
        const getUserBySubscriptionId = async (subscriptionId: string) => {
            const { data } = await supabase
                .from('saas_subscriptions')
                .select('user_id')
                .eq('stripe_subscription_id', subscriptionId)
                .maybeSingle()
            return data?.user_id
        }

        switch (event.type) {
            case 'checkout.session.completed': {
                const session = event.data.object
                const supabaseUserId = session.metadata?.supabase_user_id
                const stripeCustomerId = session.customer
                const stripeSubscriptionId = session.subscription

                console.log('Checkout completed:', {
                    userId: supabaseUserId,
                    customerId: stripeCustomerId,
                    subscriptionId: stripeSubscriptionId
                })

                // Tentar descobrir o plano pela line_items ou subscription
                let planInfo = { name: 'Risu Mensal', billing_cycle: 'monthly', amount_cents: 9990 }

                if (session.line_items?.data?.[0]?.price?.id) {
                    const priceId = session.line_items.data[0].price.id
                    planInfo = PLAN_MAPPING[priceId] || planInfo
                }

                if (supabaseUserId) {
                    const { error } = await supabase
                        .from('saas_subscriptions')
                        .update({
                            status: 'active',
                            stripe_customer_id: stripeCustomerId,
                            stripe_subscription_id: stripeSubscriptionId,
                            plan_name: planInfo.name,
                            billing_cycle: planInfo.billing_cycle,
                            amount_cents: planInfo.amount_cents,
                            last_payment_status: 'paid',
                            updated_at: new Date().toISOString()
                        })
                        .eq('user_id', supabaseUserId)

                    if (!error) {
                        console.log('✅ Subscription activated:', planInfo.name, 'for user:', supabaseUserId)

                        // Log subscription event
                        await logEvent(
                            supabaseUserId,
                            'subscribed',
                            `Assinatura ${planInfo.name} ativada`,
                            planInfo.name,
                            planInfo.amount_cents,
                            { stripe_subscription_id: stripeSubscriptionId }
                        )
                    } else {
                        console.error('Error updating subscription:', error)
                    }
                } else {
                    // Fallback: try to find user by customer email
                    const customerEmail = session.customer_details?.email || session.customer_email
                    console.log('No user_id in metadata, trying email:', customerEmail)

                    if (customerEmail) {
                        const { data: profile } = await supabase
                            .from('profiles')
                            .select('id')
                            .eq('email', customerEmail)
                            .maybeSingle()

                        if (profile) {
                            await supabase
                                .from('saas_subscriptions')
                                .update({
                                    status: 'active',
                                    stripe_customer_id: stripeCustomerId,
                                    stripe_subscription_id: stripeSubscriptionId,
                                    plan_name: planInfo.name,
                                    billing_cycle: planInfo.billing_cycle,
                                    amount_cents: planInfo.amount_cents,
                                    last_payment_status: 'paid',
                                    updated_at: new Date().toISOString()
                                })
                                .eq('user_id', profile.id)

                            console.log('✅ Subscription activated via email:', planInfo.name)

                            await logEvent(
                                profile.id,
                                'subscribed',
                                `Assinatura ${planInfo.name} ativada`,
                                planInfo.name,
                                planInfo.amount_cents,
                                { stripe_subscription_id: stripeSubscriptionId }
                            )
                        }
                    }
                }
                break
            }

            case 'customer.subscription.updated': {
                const subscription = event.data.object
                const status = subscription.status === 'active' ? 'active' :
                    subscription.status === 'trialing' ? 'trialing' :
                        subscription.status === 'past_due' ? 'past_due' :
                            subscription.status === 'canceled' ? 'canceled' : subscription.status

                // Check if subscription is being canceled (cancel_at_period_end)
                const isCanceling = subscription.cancel_at_period_end

                let planInfo = null
                if (subscription.items?.data?.[0]?.price?.id) {
                    const priceId = subscription.items.data[0].price.id
                    planInfo = PLAN_MAPPING[priceId]
                }

                console.log('Subscription update:', subscription.id, 'Status:', status, 'Canceling:', isCanceling)

                const updateData: any = {
                    status: status,
                    current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
                    updated_at: new Date().toISOString()
                }

                if (planInfo) {
                    updateData.plan_name = planInfo.name
                    updateData.billing_cycle = planInfo.billing_cycle
                    updateData.amount_cents = planInfo.amount_cents
                }

                await supabase
                    .from('saas_subscriptions')
                    .update(updateData)
                    .eq('stripe_subscription_id', subscription.id)

                // Log cancellation request or reactivation
                const userId = await getUserBySubscriptionId(subscription.id)
                if (userId) {
                    if (isCanceling) {
                        await logEvent(
                            userId,
                            'cancellation_scheduled',
                            `Cancelamento agendado para ${new Date(subscription.current_period_end * 1000).toLocaleDateString('pt-BR')}`,
                            planInfo?.name,
                            undefined,
                            { cancel_at: subscription.cancel_at }
                        )
                    } else if (event.data.previous_attributes?.cancel_at_period_end === true) {
                        // User "cancelled the cancellation"
                        await logEvent(
                            userId,
                            'reactivated',
                            `Assinatura reativada com sucesso!`,
                            planInfo?.name,
                            undefined,
                            { stripe_subscription_id: subscription.id }
                        )
                    }
                }
                break
            }

            case 'customer.subscription.deleted': {
                const subscription = event.data.object
                console.log('Subscription deleted:', subscription.id)

                // Get user before updating
                const userId = await getUserBySubscriptionId(subscription.id)

                await supabase
                    .from('saas_subscriptions')
                    .update({
                        status: 'canceled',
                        updated_at: new Date().toISOString()
                    })
                    .eq('stripe_subscription_id', subscription.id)

                // Log cancellation
                if (userId) {
                    await logEvent(
                        userId,
                        'canceled',
                        'Assinatura cancelada',
                        undefined,
                        undefined,
                        { stripe_subscription_id: subscription.id }
                    )
                }
                break
            }

            case 'invoice.payment_succeeded': {
                const invoice = event.data.object
                if (invoice.subscription) {
                    await supabase
                        .from('saas_subscriptions')
                        .update({
                            last_payment_status: 'paid',
                            status: 'active',
                            updated_at: new Date().toISOString()
                        })
                        .eq('stripe_subscription_id', invoice.subscription)

                    // Log payment if it's a recurring payment (not first payment)
                    if (invoice.billing_reason === 'subscription_cycle') {
                        const userId = await getUserBySubscriptionId(invoice.subscription)
                        if (userId) {
                            await logEvent(
                                userId,
                                'payment_succeeded',
                                'Pagamento realizado com sucesso',
                                undefined,
                                invoice.amount_paid,
                                { invoice_id: invoice.id }
                            )
                        }
                    }
                }
                break
            }

            case 'invoice.payment_failed': {
                const invoice = event.data.object
                if (invoice.subscription) {
                    await supabase
                        .from('saas_subscriptions')
                        .update({
                            last_payment_status: 'failed',
                            status: 'past_due',
                            updated_at: new Date().toISOString()
                        })
                        .eq('stripe_subscription_id', invoice.subscription)

                    // Log payment failure
                    const userId = await getUserBySubscriptionId(invoice.subscription)
                    if (userId) {
                        await logEvent(
                            userId,
                            'payment_failed',
                            'Falha no pagamento - atualize seu cartão',
                            undefined,
                            invoice.amount_due,
                            { invoice_id: invoice.id }
                        )
                    }
                }
                break
            }
        }

        return new Response(JSON.stringify({ received: true }), {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" }
        })
    } catch (err: unknown) {
        console.error(`Webhook Error:`, err)
        return new Response(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" }
        })
    }
})
