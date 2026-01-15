create extension if not exists "pgcrypto";

create table if not exists public.consult_requests (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  work_email text not null,
  team_size text not null,
  notes text not null,
  page_url text,
  source text not null default 'landing-consult'
);

alter table public.consult_requests enable row level security;

grant insert on table public.consult_requests to anon, authenticated;

create policy consult_requests_insert
  on public.consult_requests
  for insert
  to anon, authenticated
  with check (true);
