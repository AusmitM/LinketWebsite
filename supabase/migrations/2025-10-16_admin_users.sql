create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);

alter table public.admin_users enable row level security;

do $policy$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'admin_users'
      and policyname = 'admin_users_select_self'
  ) then
    create policy admin_users_select_self
      on public.admin_users
      for select
      using (auth.uid() = user_id);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'admin_users'
      and policyname = 'admin_users_service_role_all'
  ) then
    create policy admin_users_service_role_all
      on public.admin_users
      for all
      using (auth.role() = 'service_role')
      with check (auth.role() = 'service_role');
  end if;
end
$policy$;
