create extension if not exists pgcrypto;

create table if not exists public.billing_customers (
  user_id uuid primary key references auth.users(id) on delete cascade,
  stripe_customer_id text not null unique,
  email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.billing_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  stripe_subscription_id text not null unique,
  stripe_customer_id text not null,
  price_id text not null,
  status text not null,
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.billing_orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  stripe_checkout_session_id text not null unique,
  stripe_payment_intent_id text unique,
  status text not null,
  product_key text not null,
  amount_total integer not null,
  currency text not null,
  shipping_name text,
  shipping_phone text,
  shipping_address jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.billing_entitlements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan_key text not null,
  source_type text not null,
  source_id text not null,
  status text not null,
  starts_at timestamptz not null,
  ends_at timestamptz,
  in_app_prompted_at timestamptz,
  email_prompted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint billing_entitlements_source_unique unique (source_type, source_id),
  constraint billing_entitlements_source_type_check
    check (source_type in ('subscription', 'bundle'))
);

create table if not exists public.billing_webhook_events (
  stripe_event_id text primary key,
  event_type text not null,
  payload jsonb not null,
  processed_at timestamptz,
  error text,
  created_at timestamptz not null default now()
);

create index if not exists billing_subscriptions_user_idx
  on public.billing_subscriptions (user_id, updated_at desc);

create index if not exists billing_orders_user_idx
  on public.billing_orders (user_id, created_at desc);

create index if not exists billing_orders_payment_intent_idx
  on public.billing_orders (stripe_payment_intent_id);

create index if not exists billing_entitlements_user_idx
  on public.billing_entitlements (user_id, starts_at desc);

create index if not exists billing_entitlements_expiry_idx
  on public.billing_entitlements (status, plan_key, ends_at);

alter table public.billing_customers enable row level security;
alter table public.billing_subscriptions enable row level security;
alter table public.billing_orders enable row level security;
alter table public.billing_entitlements enable row level security;
alter table public.billing_webhook_events enable row level security;

do $policy$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'billing_customers'
      and policyname = 'billing_customers_select_own'
  ) then
    create policy billing_customers_select_own
      on public.billing_customers
      for select
      using (auth.role() = 'service_role' or auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'billing_customers'
      and policyname = 'billing_customers_service_manage'
  ) then
    create policy billing_customers_service_manage
      on public.billing_customers
      for all
      using (auth.role() = 'service_role')
      with check (auth.role() = 'service_role');
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'billing_subscriptions'
      and policyname = 'billing_subscriptions_select_own'
  ) then
    create policy billing_subscriptions_select_own
      on public.billing_subscriptions
      for select
      using (auth.role() = 'service_role' or auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'billing_subscriptions'
      and policyname = 'billing_subscriptions_service_manage'
  ) then
    create policy billing_subscriptions_service_manage
      on public.billing_subscriptions
      for all
      using (auth.role() = 'service_role')
      with check (auth.role() = 'service_role');
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'billing_orders'
      and policyname = 'billing_orders_select_own'
  ) then
    create policy billing_orders_select_own
      on public.billing_orders
      for select
      using (auth.role() = 'service_role' or auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'billing_orders'
      and policyname = 'billing_orders_service_manage'
  ) then
    create policy billing_orders_service_manage
      on public.billing_orders
      for all
      using (auth.role() = 'service_role')
      with check (auth.role() = 'service_role');
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'billing_entitlements'
      and policyname = 'billing_entitlements_select_own'
  ) then
    create policy billing_entitlements_select_own
      on public.billing_entitlements
      for select
      using (auth.role() = 'service_role' or auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'billing_entitlements'
      and policyname = 'billing_entitlements_service_manage'
  ) then
    create policy billing_entitlements_service_manage
      on public.billing_entitlements
      for all
      using (auth.role() = 'service_role')
      with check (auth.role() = 'service_role');
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'billing_webhook_events'
      and policyname = 'billing_webhook_events_service_manage'
  ) then
    create policy billing_webhook_events_service_manage
      on public.billing_webhook_events
      for all
      using (auth.role() = 'service_role')
      with check (auth.role() = 'service_role');
  end if;
end
$policy$;

