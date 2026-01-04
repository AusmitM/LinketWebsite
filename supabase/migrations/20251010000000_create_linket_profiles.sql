-- Linket public profiles + links (idempotent)
create extension if not exists pgcrypto;

create table if not exists public.user_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  handle text not null,
  headline text,
  theme text not null default 'light',
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_profiles_handle_unique unique (user_id, handle)
);

create table if not exists public.profile_links (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.user_profiles(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  url text not null,
  order_index int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz default now()
);

alter table public.user_profiles enable row level security;
alter table public.profile_links enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'user_profiles' and policyname = 'user_profiles_owner_all'
  ) then
    create policy user_profiles_owner_all on public.user_profiles
      for all
      using (user_id = auth.uid())
      with check (user_id = auth.uid());
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'profile_links' and policyname = 'profile_links_owner_all'
  ) then
    create policy profile_links_owner_all on public.profile_links
      for all
      using (user_id = auth.uid())
      with check (user_id = auth.uid());
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'user_profiles' and policyname = 'user_profiles_public_select'
  ) then
    create policy user_profiles_public_select on public.user_profiles
      for select using (is_active = true);
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'profile_links' and policyname = 'profile_links_public_select'
  ) then
    create policy profile_links_public_select on public.profile_links
      for select using (is_active = true);
  end if;
end $$;

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on table public.user_profiles to authenticated;
grant select on table public.user_profiles to anon;
grant select, insert, update, delete on table public.profile_links to authenticated;
grant select on table public.profile_links to anon;
