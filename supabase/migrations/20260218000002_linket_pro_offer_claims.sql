create table if not exists public.linket_pro_offer_claims (
  tag_id uuid primary key references public.hardware_tags(id) on delete cascade,
  claimed_by_user_id uuid not null,
  claimed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists linket_pro_offer_claims_claimed_by_user_idx
  on public.linket_pro_offer_claims (claimed_by_user_id);

alter table public.linket_pro_offer_claims enable row level security;

do $policy$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'linket_pro_offer_claims'
      and policyname = 'linket_pro_offer_claims_select_own'
  ) then
    create policy linket_pro_offer_claims_select_own
      on public.linket_pro_offer_claims
      for select
      using (auth.role() = 'service_role' or auth.uid() = claimed_by_user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'linket_pro_offer_claims'
      and policyname = 'linket_pro_offer_claims_service_manage'
  ) then
    create policy linket_pro_offer_claims_service_manage
      on public.linket_pro_offer_claims
      for all
      using (auth.role() = 'service_role')
      with check (auth.role() = 'service_role');
  end if;
end
$policy$;

do $constraint$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'billing_entitlements'
  ) then
    alter table public.billing_entitlements
      drop constraint if exists billing_entitlements_source_type_check;

    alter table public.billing_entitlements
      add constraint billing_entitlements_source_type_check
      check (source_type in ('subscription', 'bundle', 'linket_offer'));
  end if;
end
$constraint$;
