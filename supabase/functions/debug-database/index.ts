import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  )

  const userId = 'e8962187-17f6-424b-9371-933fc70c50cb';
  const custId = 'cus_000160204562';

  console.log(`Fixing user: ${userId}`);

  // 1. Create Subscription
  const { data, error } = await supabase.from('saas_subscriptions').upsert({
    user_id: userId,
    status: 'active',
    plan_name: 'Plano Profissional',
    gateway_name: 'asaas',
    gateway_customer_id: custId,
    current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date().toISOString()
  }, { onConflict: 'user_id' }).select()

  // 2. Log Event
  await supabase.from('subscription_events').insert({
    user_id: userId,
    event_type: 'reactivated',
    description: 'Manual fix: Restored active Asaas subscription.',
    plan_name: 'Plano Profissional'
  })

  return new Response(JSON.stringify({ success: !error, data, error }), { headers: { 'Content-Type': 'application/json' } })
})
