-- Ensure public.profiles has an updated_at column used by triggers
alter table public.profiles
  add column if not exists updated_at timestamptz default now();

update public.profiles
set updated_at = coalesce(updated_at, now());

