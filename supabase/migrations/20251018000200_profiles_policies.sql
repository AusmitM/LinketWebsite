-- Ensure profiles table RLS allows users to manage their own account row
alter table if exists public.profiles enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'profiles'
      and policyname = 'Profiles self select'
  ) then
    create policy "Profiles self select"
      on public.profiles
      for select
      using (auth.uid() = user_id);
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'profiles'
      and policyname = 'Profiles self update'
  ) then
    create policy "Profiles self update"
      on public.profiles
      for update
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'profiles'
      and policyname = 'Profiles self insert'
  ) then
    create policy "Profiles self insert"
      on public.profiles
      for insert
      with check (auth.uid() = user_id);
  end if;
end
$$;

