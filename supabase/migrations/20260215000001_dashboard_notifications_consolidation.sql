-- Consolidate legacy dashboard_announcements into dashboard_notifications
-- so there is exactly one canonical dashboard notification table.
do $consolidate$
declare
  has_notifications boolean := to_regclass('public.dashboard_notifications') is not null;
  has_announcements boolean := to_regclass('public.dashboard_announcements') is not null;
  announcements_has_send_as_notification boolean := false;
begin
  if has_notifications and has_announcements then
    select exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'dashboard_announcements'
        and column_name = 'send_as_notification'
    )
    into announcements_has_send_as_notification;

    if announcements_has_send_as_notification then
      execute $sql$
        insert into public.dashboard_notifications (
          id,
          title,
          message,
          severity,
          audience,
          is_active,
          send_as_notification,
          created_by,
          updated_by,
          created_at,
          updated_at
        )
        select
          id,
          title,
          message,
          severity,
          audience,
          is_active,
          send_as_notification,
          created_by,
          updated_by,
          created_at,
          updated_at
        from public.dashboard_announcements
        on conflict (id) do nothing
      $sql$;
    else
      execute $sql$
        insert into public.dashboard_notifications (
          id,
          title,
          message,
          severity,
          audience,
          is_active,
          send_as_notification,
          created_by,
          updated_by,
          created_at,
          updated_at
        )
        select
          id,
          title,
          message,
          severity,
          audience,
          is_active,
          true,
          created_by,
          updated_by,
          created_at,
          updated_at
        from public.dashboard_announcements
        on conflict (id) do nothing
      $sql$;
    end if;

    drop table public.dashboard_announcements;
  elsif not has_notifications and has_announcements then
    alter table public.dashboard_announcements rename to dashboard_notifications;
  end if;
end
$consolidate$;

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

drop index if exists public.dashboard_announcements_active_idx;
drop index if exists public.dashboard_announcements_audience_idx;

create index if not exists dashboard_notifications_active_idx
  on public.dashboard_notifications (is_active, created_at desc);

create index if not exists dashboard_notifications_audience_idx
  on public.dashboard_notifications (audience, created_at desc);

alter table public.dashboard_notifications enable row level security;

drop policy if exists dashboard_announcements_select_visible
  on public.dashboard_notifications;
drop policy if exists dashboard_announcements_admin_manage
  on public.dashboard_notifications;

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

drop table if exists public.dashboard_announcements;
