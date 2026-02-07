const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || '' // Assuming we might have it or can use anon if RLS allows
);

async function check() {
    console.log('Checking status for customer: cus_000160204562');

    const { data: sub, error: subError } = await supabase
        .from('saas_subscriptions')
        .select('status, gateway_subscription_id, updated_at, user_id')
        .eq('gateway_customer_id', 'cus_000160204562')
        .maybeSingle();

    if (subError) {
        console.error('Error fetching subscription:', subError);
    } else {
        console.log('Subscription Status:', sub);
    }

    const { data: events, error: eventError } = await supabase
        .from('subscription_events')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5);

    if (eventError) {
        console.error('Error fetching events:', eventError);
    } else {
        console.log('Recent Events:', events);
    }
}

check();
