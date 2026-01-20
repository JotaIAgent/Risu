-- Add Stripe columns to saas_subscriptions
alter table public.saas_subscriptions
add column if not exists stripe_customer_id text,
add column if not exists stripe_subscription_id text;

-- Index for faster lookups
create index if not exists idx_saas_subs_stripe_cust_id on public.saas_subscriptions(stripe_customer_id);
create index if not exists idx_saas_subs_stripe_sub_id on public.saas_subscriptions(stripe_subscription_id);
