create extension if not exists pgcrypto;

create table if not exists public.subscription_billing_periods (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null default 'stripe',
  provider_customer_id text,
  provider_subscription_id text not null,
  status text not null default 'paid',
  period_start timestamptz not null,
  period_end timestamptz not null,
  source_event_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint subscription_billing_periods_period_check check (period_end > period_start),
  constraint subscription_billing_periods_provider_check check (provider in ('stripe')),
  constraint subscription_billing_periods_status_check check (status in ('paid', 'refunded', 'voided'))
);

create unique index if not exists idx_subscription_billing_periods_window_unique
  on public.subscription_billing_periods(provider, provider_subscription_id, period_start, period_end, status);

create index if not exists idx_subscription_billing_periods_user
  on public.subscription_billing_periods(user_id, period_start);

create index if not exists idx_subscription_billing_periods_paid_lookup
  on public.subscription_billing_periods(user_id, provider, status, period_start);

alter table public.subscription_billing_periods enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'subscription_billing_periods'
      and policyname = 'subscription_billing_periods_owner_select'
  ) then
    create policy subscription_billing_periods_owner_select
      on public.subscription_billing_periods
      for select
      using (user_id = auth.uid());
  end if;
end $$;

grant select on table public.subscription_billing_periods to authenticated;
