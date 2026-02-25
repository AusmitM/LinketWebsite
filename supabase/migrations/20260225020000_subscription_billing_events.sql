create extension if not exists pgcrypto;

create table if not exists public.subscription_billing_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null default 'stripe',
  provider_customer_id text,
  provider_subscription_id text,
  event_type text not null,
  source_event_id text not null,
  status text not null default 'info',
  occurred_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint subscription_billing_events_provider_check check (provider in ('stripe')),
  constraint subscription_billing_events_status_check check (status in ('info', 'warning', 'error'))
);

create unique index if not exists idx_subscription_billing_events_provider_source_unique
  on public.subscription_billing_events(provider, source_event_id);

create index if not exists idx_subscription_billing_events_user_occurred
  on public.subscription_billing_events(user_id, occurred_at desc);

create index if not exists idx_subscription_billing_events_subscription_occurred
  on public.subscription_billing_events(provider_subscription_id, occurred_at desc);

alter table public.subscription_billing_events enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'subscription_billing_events'
      and policyname = 'subscription_billing_events_owner_select'
  ) then
    create policy subscription_billing_events_owner_select
      on public.subscription_billing_events
      for select
      using (user_id = auth.uid());
  end if;
end $$;

grant select on table public.subscription_billing_events to authenticated;
