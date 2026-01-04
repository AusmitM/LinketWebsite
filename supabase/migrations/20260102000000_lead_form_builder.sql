create extension if not exists pgcrypto;

-- Extend lead form fields for builder settings + advanced field options
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'lead_form_fields'
      and column_name = 'key'
  ) then
    alter table public.lead_form_fields add column key text;
  end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'lead_form_fields'
      and column_name = 'options'
  ) then
    alter table public.lead_form_fields add column options text[];
  end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'lead_form_fields'
      and column_name = 'is_hidden'
  ) then
    alter table public.lead_form_fields add column is_hidden boolean not null default false;
  end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'lead_form_fields'
      and column_name = 'validation'
  ) then
    alter table public.lead_form_fields add column validation jsonb;
  end if;
end $$;

do $$
begin
  if exists (
    select 1 from pg_constraint
    where conname = 'lead_form_fields_type_check'
  ) then
    alter table public.lead_form_fields drop constraint lead_form_fields_type_check;
  end if;
  alter table public.lead_form_fields
    add constraint lead_form_fields_type_check
    check (type in ('text','email','phone','textarea','select','checkbox'));
end $$;

create unique index if not exists lead_form_fields_unique_key
  on public.lead_form_fields (user_id, handle, key);

-- Lead form settings (per card)
create table if not exists public.lead_form_settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  handle text not null,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint lead_form_settings_unique unique (user_id, handle)
);

alter table public.lead_form_settings enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname='public'
      and tablename='lead_form_settings'
      and policyname='lead_form_settings_owner_all'
  ) then
    create policy lead_form_settings_owner_all
      on public.lead_form_settings
      for all
      using (user_id = auth.uid())
      with check (user_id = auth.uid());
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname='public'
      and tablename='lead_form_settings'
      and policyname='lead_form_settings_public_select'
  ) then
    create policy lead_form_settings_public_select
      on public.lead_form_settings
      for select
      using (true);
  end if;
end $$;

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on table public.lead_form_settings to authenticated;
grant select on table public.lead_form_settings to anon;
