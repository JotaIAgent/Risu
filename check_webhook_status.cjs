const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

// Read .env manually since dotenv might not be installed or behaving
const env = fs.readFileSync('.env', 'utf8');
const lines = env.split('\n');
const config = {};
lines.forEach(line => {
    const parts = line.split('=');
    if (parts.length === 2) config[parts[0].trim()] = parts[1].trim();
});

const supabase = createClient(
    config.VITE_SUPABASE_URL,
    // We need service role for this, let's hope it's in env or we can find it
    process.env.SUPABASE_SERVICE_ROLE_KEY || ''
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
        console.log('Recent Events:', events.map(e => ({ type: e.event_type, desc: e.description, time: e.created_at })));
    }
}

check();
