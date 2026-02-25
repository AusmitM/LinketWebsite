create extension if not exists pgcrypto;

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null default 'stripe',
  provider_checkout_session_id text not null,
  provider_customer_id text,
  status text not null default 'pending',
  currency text not null default 'usd',
  subtotal_minor bigint not null default 0,
  tax_minor bigint not null default 0,
  shipping_minor bigint not null default 0,
  total_minor bigint not null default 0,
  receipt_url text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint orders_provider_check check (provider in ('stripe')),
  constraint orders_status_check check (status in ('pending', 'paid', 'refunded', 'canceled'))
);

create unique index if not exists idx_orders_provider_checkout_session_unique
  on public.orders(provider, provider_checkout_session_id);

create index if not exists idx_orders_user_created
  on public.orders(user_id, created_at desc);

create index if not exists idx_orders_status_created
  on public.orders(status, created_at desc);

alter table public.orders enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'orders'
      and policyname = 'orders_owner_select'
  ) then
    create policy orders_owner_select
      on public.orders
      for select
      using (user_id = auth.uid());
  end if;
end $$;

grant select on table public.orders to authenticated;

create table if not exists public.bundle_purchases (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null default 'stripe',
  provider_checkout_session_id text not null,
  provider_customer_id text,
  provider_payment_intent_id text,
  provider_invoice_id text,
  bundle_price_id text,
  quantity integer not null default 1,
  purchase_status text not null default 'pending',
  purchased_at timestamptz not null default now(),
  shipping_rate_id text,
  shipping_name text,
  shipping_phone text,
  shipping_address jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint bundle_purchases_provider_check check (provider in ('stripe')),
  constraint bundle_purchases_quantity_check check (quantity > 0),
  constraint bundle_purchases_status_check check (purchase_status in ('pending', 'paid', 'refunded', 'canceled'))
);

create unique index if not exists idx_bundle_purchases_order_unique
  on public.bundle_purchases(order_id);

create unique index if not exists idx_bundle_purchases_provider_checkout_session_unique
  on public.bundle_purchases(provider, provider_checkout_session_id);

create index if not exists idx_bundle_purchases_user_purchased
  on public.bundle_purchases(user_id, purchased_at desc);

alter table public.bundle_purchases enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'bundle_purchases'
      and policyname = 'bundle_purchases_owner_select'
  ) then
    create policy bundle_purchases_owner_select
      on public.bundle_purchases
      for select
      using (user_id = auth.uid());
  end if;
end $$;

grant select on table public.bundle_purchases to authenticated;
