-- Public profile access for anonymous viewers.
do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'user_profiles'
      and policyname = 'user_profiles_public_select'
  ) then
    create policy user_profiles_public_select
      on public.user_profiles
      for select
      using (true);
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'profile_links'
      and policyname = 'profile_links_public_select'
  ) then
    create policy profile_links_public_select
      on public.profile_links
      for select
      using (true);
  end if;
end $$;

grant usage on schema public to anon, authenticated;
grant select on table public.user_profiles to anon;
grant select on table public.profile_links to anon;
