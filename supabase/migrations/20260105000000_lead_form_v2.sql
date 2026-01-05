create extension if not exists pgcrypto;

create table if not exists public.lead_forms (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  profile_id uuid references public.user_profiles(id) on delete set null,
  handle text,
  status text not null default 'draft',
  title text not null default 'Lead capture',
  description text not null default '',
  config jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint lead_forms_status_check check (status in ('draft','published'))
);

create unique index if not exists lead_forms_owner_handle
  on public.lead_forms (user_id, handle);

create table if not exists public.lead_form_responses (
  id uuid primary key default gen_random_uuid(),
  form_id uuid not null references public.lead_forms(id) on delete cascade,
  response_id text not null,
  submitted_at timestamptz not null default now(),
  updated_at timestamptz,
  answers jsonb not null,
  responder_email text
);

create unique index if not exists lead_form_responses_response_id
  on public.lead_form_responses (response_id);

alter table public.lead_forms enable row level security;
alter table public.lead_form_responses enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'lead_forms' and policyname = 'lead_forms_owner_all'
  ) then
    create policy lead_forms_owner_all on public.lead_forms
      for all using (user_id = auth.uid()) with check (user_id = auth.uid());
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'lead_forms' and policyname = 'lead_forms_public_select'
  ) then
    create policy lead_forms_public_select on public.lead_forms
      for select using (status = 'published');
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'lead_form_responses' and policyname = 'lead_form_responses_owner_select'
  ) then
    create policy lead_form_responses_owner_select on public.lead_form_responses
      for select using (
        exists (
          select 1 from public.lead_forms
          where lead_forms.id = lead_form_responses.form_id
            and lead_forms.user_id = auth.uid()
        )
      );
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'lead_form_responses' and policyname = 'lead_form_responses_public_insert'
  ) then
    create policy lead_form_responses_public_insert on public.lead_form_responses
      for insert with check (
        exists (
          select 1 from public.lead_forms
          where lead_forms.id = lead_form_responses.form_id
            and lead_forms.status = 'published'
        )
      );
  end if;
end $$;

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on table public.lead_forms to authenticated;
grant select on table public.lead_forms to anon;
grant select, insert on table public.lead_form_responses to authenticated;
grant insert on table public.lead_form_responses to anon;
