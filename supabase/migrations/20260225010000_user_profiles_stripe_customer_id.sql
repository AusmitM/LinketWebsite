alter table public.user_profiles
  add column if not exists stripe_customer_id text;

create index if not exists idx_user_profiles_stripe_customer_id
  on public.user_profiles(stripe_customer_id)
  where stripe_customer_id is not null;

create index if not exists idx_user_profiles_user_stripe_customer_id
  on public.user_profiles(user_id, stripe_customer_id)
  where stripe_customer_id is not null;

update public.user_profiles as up
set
  stripe_customer_id = sbp.provider_customer_id,
  updated_at = now()
from (
  select distinct on (user_id)
    user_id,
    provider_customer_id
  from public.subscription_billing_periods
  where provider = 'stripe'
    and provider_customer_id is not null
  order by user_id, created_at desc
) as sbp
where up.user_id = sbp.user_id
  and coalesce(up.stripe_customer_id, '') = '';
