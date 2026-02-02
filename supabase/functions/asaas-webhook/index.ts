import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

console.log("ASAAS Webhook Handler v1.0")

const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
)

serve(async (req) => {
    try {
        const body = await req.json()
        const { event, payment } = body

        console.log(`ASAAS Webhook received: ${event}`, payment.id)

        // 1. Security Check (Optional but Recommended)
        // You should set ASAAS_WEBHOOK_TOKEN in your Supabase Secrets
        // This token is configured in the ASAAS Webhook settings
        const authToken = req.headers.get('asaas-access-token')
        const expectedToken = Deno.env.get('ASAAS_WEBHOOK_TOKEN')

        if (expectedToken && authToken !== expectedToken) {
            console.error('Invalid ASAAS access token')
            return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
        }

        // 2. Extract Data
        const gatewaySubscriptionId = payment.subscriptionId || payment.id
        const customerId = payment.customer
        const status = payment.status

        // 3. Map ASAAS status to our Status
        // ASAAS statuses: CONFIRMED, RECEIVED, OVERDUE, DELETED, etc.
        let targetStatus = 'active'
        if (status === 'OVERDUE') targetStatus = 'past_due'
        if (status === 'DELETED') targetStatus = 'canceled'
        if (status === 'REFUNDED') targetStatus = 'canceled'

        // 4. Find user by Customer ID or Subscription ID
        const { data: sub, error: subError } = await supabaseAdmin
            .from('saas_subscriptions')
            .select('user_id, plan_name')
            .or(`gateway_customer_id.eq.${customerId},gateway_subscription_id.eq.${gatewaySubscriptionId}`)
            .maybeSingle()

        if (subError || !sub) {
            console.warn('Subscription or user not found for this event:', customerId)
            return new Response(JSON.stringify({ received: true, warning: 'User not found' }), { status: 200 })
        }

        // 5. Update Subscription
        const updateData: any = {
            status: targetStatus,
            updated_at: new Date().toISOString()
        }

        // If it's a new subscription or payment link conversion
        if (payment.subscriptionId && !sub.gateway_subscription_id) {
            updateData.gateway_subscription_id = payment.subscriptionId
        }

        const { error: updateError } = await supabaseAdmin
            .from('saas_subscriptions')
            .update(updateData)
            .eq('user_id', sub.user_id)

        if (updateError) {
            console.error('Error updating subscription:', updateError)
            throw updateError
        }

        // 6. Log Event
        await supabaseAdmin.from('subscription_events').insert({
            user_id: sub.user_id,
            event_type: event.toLowerCase(),
            description: `Pagamento ASAAS: ${status}. ID: ${payment.id}`,
            plan_name: sub.plan_name
        })

        return new Response(JSON.stringify({ received: true }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        })

    } catch (err) {
        console.error('Webhook Error:', err.message)
        return new Response(JSON.stringify({ error: err.message }), { status: 400 })
    }
})
