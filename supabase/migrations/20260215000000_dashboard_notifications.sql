create table if not exists public.dashboard_notifications (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  message text not null,
  severity text not null default 'info',
  audience text not null default 'all',
  is_active boolean not null default true,
  send_as_notification boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint dashboard_notifications_title_len
    check (char_length(btrim(title)) between 1 and 120),
  constraint dashboard_notifications_message_len
    check (char_length(btrim(message)) between 1 and 5000),
  constraint dashboard_notifications_severity
    check (severity in ('info', 'success', 'warning', 'critical')),
  constraint dashboard_notifications_audience
    check (audience in ('all', 'users', 'admins'))
);

alter table public.dashboard_notifications
  add column if not exists send_as_notification boolean not null default true;

alter table public.dashboard_notifications
  alter column send_as_notification set default true;

update public.dashboard_notifications
set send_as_notification = true
where send_as_notification is null;

alter table public.dashboard_notifications
  alter column send_as_notification set not null;

create index if not exists dashboard_notifications_active_idx
  on public.dashboard_notifications (is_active, created_at desc);

create index if not exists dashboard_notifications_audience_idx
  on public.dashboard_notifications (audience, created_at desc);

alter table public.dashboard_notifications enable row level security;

do $policy$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'dashboard_notifications'
      and policyname = 'dashboard_notifications_select_visible'
  ) then
    create policy dashboard_notifications_select_visible
      on public.dashboard_notifications
      for select
      using (
        auth.role() = 'service_role'
        or (
          auth.uid() is not null
          and is_active = true
          and (
            audience = 'all'
            or (
              audience = 'users'
              and not exists (
                select 1
                from public.admin_users au
                where au.user_id = auth.uid()
              )
            )
            or (
              audience = 'admins'
              and exists (
                select 1
                from public.admin_users au
                where au.user_id = auth.uid()
              )
            )
          )
        )
      );
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'dashboard_notifications'
      and policyname = 'dashboard_notifications_admin_manage'
  ) then
    create policy dashboard_notifications_admin_manage
      on public.dashboard_notifications
      for all
      using (
        auth.role() = 'service_role'
        or exists (
          select 1
          from public.admin_users au
          where au.user_id = auth.uid()
        )
      )
      with check (
        auth.role() = 'service_role'
        or exists (
          select 1
          from public.admin_users au
          where au.user_id = auth.uid()
        )
      );
  end if;
end
$policy$;
