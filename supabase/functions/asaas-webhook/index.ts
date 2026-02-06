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

        // 1. Security Check
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
        const paymentConfirmed = ['PAYMENT_CONFIRMED', 'PAYMENT_RECEIVED'].includes(event)

        // 3. Map ASAAS status to our Status
        let targetStatus = 'active'
        if (status === 'OVERDUE') targetStatus = 'past_due'
        if (status === 'DELETED') targetStatus = 'canceled'
        if (status === 'REFUNDED') targetStatus = 'canceled'

        // 4. Find user and pending info
        const { data: sub, error: subError } = await supabaseAdmin
            .from('saas_subscriptions')
            .select('user_id, plan_name, gateway_subscription_id, pending_coupon')
            .or(`gateway_customer_id.eq.${customerId},gateway_subscription_id.eq.${gatewaySubscriptionId}`)
            .maybeSingle()

        if (subError || !sub) {
            console.warn('Subscription or user not found for this event:', customerId)
            return new Response(JSON.stringify({ received: true, warning: 'User not found' }), { status: 200 })
        }

        // 5. Handle Coupon Usage if Payment is Confirmed
        if (paymentConfirmed && sub.pending_coupon) {
            console.log(`Processing pending coupon usage: ${sub.pending_coupon} for user ${sub.user_id}`);

            const { data: coupon } = await supabaseAdmin
                .from('saas_coupons')
                .select('*')
                .eq('code', sub.pending_coupon.toUpperCase())
                .maybeSingle()

            if (coupon) {
                // Register Usage
                const discountAmount = coupon.type === 'percentage'
                    ? (payment.originalValue * (coupon.value / 100))
                    : coupon.value;

                await supabaseAdmin.from('saas_coupon_usages').insert({
                    coupon_id: coupon.id,
                    user_id: sub.user_id,
                    original_amount: payment.originalValue || payment.value,
                    discount_amount: discountAmount,
                    final_amount: payment.value
                })

                // Increment Uses
                await supabaseAdmin.rpc('increment_coupon_usage', { coupon_id: coupon.id })

                console.log(`Coupon ${sub.pending_coupon} usage registered.`);
            }
        }

        // 6. Update Subscription
        const updateData: any = {
            status: targetStatus,
            updated_at: new Date().toISOString(),
            pending_coupon: paymentConfirmed ? null : sub.pending_coupon // Clear if confirmed
        }

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

        // 7. Log Event
        await supabaseAdmin.from('subscription_events').insert({
            user_id: sub.user_id,
            event_type: event.toLowerCase(),
            description: `Pagamento ASAAS: ${status}. ID: ${payment.id}. Cupom: ${sub.pending_coupon || 'Nenhum'}`,
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
