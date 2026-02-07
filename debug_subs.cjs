const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    'https://lrkbmpdnowciyfvvlotl.supabase.co',
    'fd29e9764db1f65ec298c0da7fef4d16a5dfc8736899b846ca8ff61c572b6c66'
);

async function check() {
    console.log('--- Checking User and Subscription Data ---');

    // 1. Find user by email
    const { data: users, error: userError } = await supabase.auth.admin.listUsers();
    const targetUser = users.users.find(u => u.email === 'jpedro.faggionato@gmail.com');

    if (!targetUser) {
        console.log('User not found by email.');
    } else {
        console.log(`User ID: ${targetUser.id}, Email: ${targetUser.email}`);
    }

    // 2. Check all records in saas_subscriptions
    const { data: subs, error: subError } = await supabase
        .from('saas_subscriptions')
        .select('*');

    if (subError) {
        console.error('Error fetching subscriptions:', subError);
    } else {
        console.log('All Subscriptions:');
        subs.forEach(s => {
            console.log(`- ID: ${s.id}, User: ${s.user_id}, Status: ${s.status}, Gateway: ${s.gateway_name}, CustID: ${s.gateway_customer_id}, Plan: ${s.plan_name}, End: ${s.current_period_end}`);
        });
    }
}

check();
