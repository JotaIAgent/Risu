import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

console.log("ASAAS Webhook Handler v1.2 - Ultra-Robust Edition")

const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
)

serve(async (req) => {
    const requestId = crypto.randomUUID().substring(0, 8);
    const version = "1.2";
    try {
        const body = await req.json()
        const { event } = body
        const payment = body.payment
        const subscriptionObj = body.subscription

        console.log(`[${requestId}][v${version}] Webhook received: ${event}.`);

        // 1. Security Check
        const authToken = req.headers.get('asaas-access-token')
        const expectedToken = Deno.env.get('ASAAS_WEBHOOK_TOKEN')

        if (expectedToken && authToken !== expectedToken) {
            console.error(`[${requestId}] Invalid ASAAS access token`);
            return new Response(JSON.stringify({ error: 'Unauthorized', requestId, version }), { status: 401 })
        }

        // 2. Identify Target (Defensive Logic)
        let targetObj = null;
        if (payment && typeof payment === 'object') targetObj = payment;
        else if (subscriptionObj && typeof subscriptionObj === 'object') targetObj = subscriptionObj;
        else if (body && typeof body === 'object' && body.id) targetObj = body; // Top level fallback

        if (!targetObj) {
            console.log(`[${requestId}] No target object found in body. event=${event}`);
            return new Response(JSON.stringify({ received: true, note: 'No target object', requestId, version }), { status: 200 })
        }

        const customerId = targetObj.customer || body.customer; // Some events have customer at top level
        const gatewaySubscriptionId = targetObj.subscriptionId || targetObj.id;
        const status = targetObj.status || body.status;
        const nextDueDate = targetObj.nextDueDate || targetObj.dueDate; // For subscriptions or payments

        console.log(`[${requestId}] Processing: Event=${event}, Customer=${customerId}, RefId=${gatewaySubscriptionId}, Status=${status}, NextDue=${nextDueDate}`);

        if (!customerId && !gatewaySubscriptionId) {
            console.warn(`[${requestId}] Could not find customerId or subId in payload.`);
            return new Response(JSON.stringify({ received: true, note: 'No identifiers found', requestId, version }), { status: 200 })
        }

        // 3. Status Mapping
        const paymentConfirmed = ['PAYMENT_CONFIRMED', 'PAYMENT_RECEIVED'].includes(event);
        let targetStatus = 'active';

        if (status === 'OVERDUE') targetStatus = 'past_due';
        if (status === 'DELETED' || status === 'REFUNDED') targetStatus = 'canceled';
        if (status === 'PENDING') targetStatus = 'incomplete';

        // 4. Find subscription in our DB
        // We try to find by customerId or gatewaySubscriptionId
        const { data: sub, error: subError } = await supabaseAdmin
            .from('saas_subscriptions')
            .select('id, user_id, plan_name, gateway_subscription_id, gateway_customer_id, pending_coupon')
            .or(`gateway_customer_id.eq.${customerId},gateway_subscription_id.eq.${gatewaySubscriptionId}`)
            .maybeSingle()

        if (subError) {
            console.error(`[${requestId}] DB Error finding sub:`, subError);
            throw subError;
        }

        if (!sub) {
            console.warn(`[${requestId}] Subscription/User not found for Customer=${customerId} or SubId=${gatewaySubscriptionId}`);
            // Return 200 to Asaas so they stop retrying, but log as warning
            return new Response(JSON.stringify({ received: true, warning: 'Sub not found' }), { status: 200 })
        }

        console.log(`[${requestId}] Found sub for user: ${sub.user_id}.`);

        // 5. Handle Coupon
        if (paymentConfirmed && sub.pending_coupon) {
            console.log(`[${requestId}] Registering coupon: ${sub.pending_coupon}`);
            try {
                const { data: coupon } = await supabaseAdmin
                    .from('saas_coupons')
                    .select('*')
                    .eq('code', sub.pending_coupon.toUpperCase())
                    .maybeSingle()

                if (coupon) {
                    const discountAmount = coupon.type === 'percentage'
                        ? ((targetObj.originalValue || targetObj.value) * (coupon.value / 100))
                        : coupon.value;

                    await supabaseAdmin.from('saas_coupon_usages').insert({
                        coupon_id: coupon.id,
                        user_id: sub.user_id,
                        original_amount: targetObj.originalValue || targetObj.value,
                        discount_amount: discountAmount,
                        final_amount: targetObj.value
                    })

                    await supabaseAdmin.rpc('increment_coupon_usage', { coupon_id: coupon.id })
                    console.log(`[${requestId}] Coupon usage registered success.`);
                }
            } catch (couponErr) {
                console.error(`[${requestId}] Error processing coupon:`, couponErr);
                // Don't fail the whole webhook for a coupon error
            }
        }

        // 6. Update Subscription Status
        const updateData: any = {
            status: targetStatus,
            updated_at: new Date().toISOString(),
            // Clear pending_coupon if payment confirmed
            pending_coupon: paymentConfirmed ? null : sub.pending_coupon
        }

        // IMPORTANT: Update current_period_end for Frontend Auth check
        if (nextDueDate) {
            updateData.current_period_end = new Date(nextDueDate).toISOString();
        }

        // If it's a new subscription ID from Asaas, save it
        if (targetObj.subscriptionId && !sub.gateway_subscription_id) {
            updateData.gateway_subscription_id = targetObj.subscriptionId;
        }

        const { error: updateError } = await supabaseAdmin
            .from('saas_subscriptions')
            .update(updateData)
            .eq('id', sub.id)

        if (updateError) {
            console.error(`[${requestId}] Error updating sub in DB:`, updateError);
            throw updateError;
        }

        // 7. Log Event for History
        await supabaseAdmin.from('subscription_events').insert({
            user_id: sub.user_id,
            event_type: event.toLowerCase(),
            description: `Asaas Webhook: ${status}. Event: ${event}. Ref: ${targetObj.id}`,
            plan_name: sub.plan_name
        })

        console.log(`[${requestId}] Webhook processed successfully.`);
        return new Response(JSON.stringify({ success: true }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        })

    } catch (err: any) {
        console.error(`[${requestId}] Fatal Webhook Error:`, err.message);
        return new Response(JSON.stringify({ error: err.message, requestId }), { status: 400 })
    }
})
