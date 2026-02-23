alter table if exists public.billing_subscriptions
  add column if not exists paid_days integer not null default 0;

do $constraint$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'billing_subscriptions_paid_days_non_negative'
  ) then
    alter table public.billing_subscriptions
      add constraint billing_subscriptions_paid_days_non_negative
      check (paid_days >= 0);
  end if;
end
$constraint$;

