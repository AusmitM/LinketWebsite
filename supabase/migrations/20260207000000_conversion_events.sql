create extension if not exists pgcrypto;

create table if not exists public.conversion_events (
  id uuid primary key default gen_random_uuid(),
  event_id text not null,
  event_source text not null default 'web',
  user_id uuid references auth.users(id) on delete set null,
  path text,
  href text,
  referrer text,
  timestamp timestamptz,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists conversion_events_event_created_idx
  on public.conversion_events (event_id, created_at desc);

create index if not exists conversion_events_user_created_idx
  on public.conversion_events (user_id, created_at desc);

alter table public.conversion_events enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'conversion_events'
      and policyname = 'conversion_events_insert'
  ) then
    create policy conversion_events_insert
      on public.conversion_events
      for insert
      to anon, authenticated
      with check (true);
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'conversion_events'
      and policyname = 'conversion_events_owner_select'
  ) then
    create policy conversion_events_owner_select
      on public.conversion_events
      for select
      to authenticated
      using (user_id = auth.uid());
  end if;
end $$;

grant insert on table public.conversion_events to anon, authenticated;
grant select on table public.conversion_events to authenticated;
