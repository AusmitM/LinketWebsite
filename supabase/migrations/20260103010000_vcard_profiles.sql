create extension if not exists pgcrypto;

create table if not exists public.vcard_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  full_name text,
  title text,
  email text,
  phone text,
  company text,
  website text,
  address text,
  note text,
  photo_data text,
  photo_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint vcard_profiles_user_unique unique (user_id)
);

alter table public.vcard_profiles enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'vcard_profiles'
      and policyname = 'vcard_profiles_owner_all'
  ) then
    create policy vcard_profiles_owner_all
      on public.vcard_profiles
      for all
      using (user_id = auth.uid())
      with check (user_id = auth.uid());
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'vcard_profiles'
      and policyname = 'vcard_profiles_public_select'
  ) then
    create policy vcard_profiles_public_select
      on public.vcard_profiles
      for select
      using (true);
  end if;
end $$;

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on table public.vcard_profiles to authenticated;
grant select on table public.vcard_profiles to anon;
