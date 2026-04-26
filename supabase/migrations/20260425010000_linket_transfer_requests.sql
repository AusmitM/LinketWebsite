create table if not exists public.linket_transfer_requests (
  id uuid primary key default gen_random_uuid(),
  tag_id uuid not null references public.hardware_tags(id) on delete cascade,
  user_id uuid not null,
  recipient_email text not null,
  transfer_token text not null,
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'canceled', 'expired')),
  expires_at timestamptz not null,
  accepted_at timestamptz,
  accepted_by_user_id uuid,
  canceled_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_linket_transfer_requests_token_unique
  on public.linket_transfer_requests(transfer_token);

create unique index if not exists idx_linket_transfer_requests_tag_pending_unique
  on public.linket_transfer_requests(tag_id)
  where status = 'pending';

create index if not exists idx_linket_transfer_requests_user_created
  on public.linket_transfer_requests(user_id, created_at desc);

create index if not exists idx_linket_transfer_requests_recipient_pending
  on public.linket_transfer_requests(lower(recipient_email), status, created_at desc);

alter table public.linket_transfer_requests enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'linket_transfer_requests'
      and policyname = 'linket_transfer_requests_owner_select'
  ) then
    create policy linket_transfer_requests_owner_select
      on public.linket_transfer_requests
      for select
      using (user_id = auth.uid());
  end if;
end;
$$;

grant select on table public.linket_transfer_requests to authenticated;
