create extension if not exists pgcrypto;

create or replace function public.linket_user_has_paid_access(target_user_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_now timestamptz := now();
  v_has_paid boolean := false;
  v_claim_at timestamptz;
  v_period_end timestamptz;
  v_complimentary_start timestamptz;
  v_complimentary_end timestamptz;
begin
  if target_user_id is null then
    return false;
  end if;

  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'subscription_billing_periods'
  ) then
    execute $sql$
      select exists (
        select 1
        from public.subscription_billing_periods
        where user_id = $1
          and provider = 'stripe'
          and status = 'paid'
          and period_start <= $2
          and period_end > $2
      )
    $sql$
      into v_has_paid
      using target_user_id, v_now;

    if coalesce(v_has_paid, false) then
      return true;
    end if;
  end if;

  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'tag_events'
  ) then
    execute $sql$
      select min(occurred_at)
      from public.tag_events
      where event_type = 'claim'
        and (
          metadata->>'entitlement_user_id' = $1::text
          or metadata->>'user_id' = $1::text
        )
    $sql$
      into v_claim_at
      using target_user_id;
  end if;

  if v_claim_at is null then
    return false;
  end if;

  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'subscription_billing_periods'
  ) then
    execute $sql$
      select period_end
      from public.subscription_billing_periods
      where user_id = $1
        and provider = 'stripe'
        and status = 'paid'
        and period_start <= $2
        and period_end > $2
      order by period_end asc
      limit 1
    $sql$
      into v_period_end
      using target_user_id, v_claim_at;
  end if;

  v_complimentary_start := coalesce(v_period_end, v_claim_at);
  v_complimentary_end := v_complimentary_start + interval '12 months';

  return v_now >= v_complimentary_start and v_now < v_complimentary_end;
end;
$$;

create or replace function public.linket_clamp_free_theme(theme_value text)
returns text
language plpgsql
immutable
as $$
declare
  v_theme text := lower(trim(coalesce(theme_value, '')));
begin
  if v_theme in ('dark', 'midnight', 'forest', 'gilded') then
    return 'dark';
  end if;

  return 'light';
end;
$$;

create or replace function public.linket_free_lead_form_config(
  form_row_id uuid,
  existing_config jsonb,
  current_ts timestamptz
)
returns jsonb
language plpgsql
immutable
as $$
declare
  v_now_text text := to_char(
    current_ts at time zone 'utc',
    'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
  );
  v_created_at text := coalesce(existing_config #>> '{meta,createdAt}', v_now_text);
  v_version integer := greatest(
    coalesce((existing_config #>> '{meta,version}')::integer, 1),
    1
  );
begin
  return jsonb_build_object(
    'id', coalesce(existing_config ->> 'id', form_row_id::text),
    'title', 'Let''s Connect!',
    'description', '',
    'status', 'published',
    'settings', jsonb_build_object(
      'collectEmail', 'user_input',
      'allowEditAfterSubmit', false,
      'limitOneResponse', 'off',
      'showProgressBar', false,
      'shuffleQuestionOrder', false,
      'confirmationMessage', 'Thanks for reaching out. We will follow up soon.'
    ),
    'fields', jsonb_build_array(
      jsonb_build_object(
        'id', 'free_name',
        'type', 'short_text',
        'label', 'Name',
        'helpText', 'Ex. John Doe',
        'required', true,
        'validation', jsonb_build_object('rule', 'none')
      ),
      jsonb_build_object(
        'id', 'free_email',
        'type', 'short_text',
        'label', 'Email',
        'helpText', 'JDoe@LinketConnect.com',
        'required', false,
        'validation', jsonb_build_object('rule', 'email')
      ),
      jsonb_build_object(
        'id', 'free_note',
        'type', 'long_text',
        'label', 'Note',
        'helpText', '',
        'required', false,
        'validation', jsonb_build_object('rule', 'none')
      )
    ),
    'meta', jsonb_build_object(
      'createdAt', v_created_at,
      'updatedAt', v_now_text,
      'version', v_version
    )
  );
end;
$$;

create or replace function public.linket_filter_form_answers(
  input_answers jsonb,
  form_config jsonb
)
returns jsonb
language plpgsql
immutable
as $$
declare
  v_filtered jsonb := '{}'::jsonb;
  v_field jsonb;
  v_field_id text;
begin
  if input_answers is null or jsonb_typeof(input_answers) <> 'object' then
    return '{}'::jsonb;
  end if;

  if form_config is null or jsonb_typeof(form_config->'fields') <> 'array' then
    return '{}'::jsonb;
  end if;

  for v_field in
    select value
    from jsonb_array_elements(form_config->'fields')
  loop
    v_field_id := v_field ->> 'id';
    if v_field_id is null or v_field_id = '' then
      continue;
    end if;

    if input_answers ? v_field_id then
      v_filtered := v_filtered || jsonb_build_object(
        v_field_id,
        input_answers -> v_field_id
      );
    end if;
  end loop;

  return v_filtered;
end;
$$;

create or replace function public.linket_enforce_free_profile_theme()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.user_id is not null and not public.linket_user_has_paid_access(new.user_id) then
    new.theme := public.linket_clamp_free_theme(new.theme);
  end if;

  return new;
end;
$$;

create or replace function public.linket_enforce_free_lead_form()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.id is null then
    new.id := gen_random_uuid();
  end if;

  if new.user_id is not null and not public.linket_user_has_paid_access(new.user_id) then
    new.config := public.linket_free_lead_form_config(
      new.id,
      coalesce(new.config, '{}'::jsonb),
      coalesce(new.updated_at, now())
    );
    new.title := 'Let''s Connect!';
    new.description := '';
    new.status := 'published';
  end if;

  return new;
end;
$$;

create or replace function public.linket_enforce_lead_form_response_answers()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_form_config jsonb;
begin
  new.answers := coalesce(new.answers, '{}'::jsonb);

  select config
    into v_form_config
  from public.lead_forms
  where id = new.form_id
  limit 1;

  if v_form_config is not null then
    new.answers := public.linket_filter_form_answers(new.answers, v_form_config);
  end if;

  return new;
end;
$$;

do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'user_profiles'
  ) then
    drop trigger if exists linket_enforce_free_profile_theme on public.user_profiles;
    create trigger linket_enforce_free_profile_theme
      before insert or update on public.user_profiles
      for each row execute function public.linket_enforce_free_profile_theme();

    update public.user_profiles
    set theme = public.linket_clamp_free_theme(theme)
    where user_id is not null
      and not public.linket_user_has_paid_access(user_id)
      and theme is distinct from public.linket_clamp_free_theme(theme);
  end if;
end;
$$;

do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'lead_forms'
  ) then
    drop trigger if exists linket_enforce_free_lead_form on public.lead_forms;
    create trigger linket_enforce_free_lead_form
      before insert or update on public.lead_forms
      for each row execute function public.linket_enforce_free_lead_form();

    update public.lead_forms
    set config = public.linket_free_lead_form_config(id, config, now()),
        title = 'Let''s Connect!',
        description = '',
        status = 'published',
        updated_at = now()
    where user_id is not null
      and not public.linket_user_has_paid_access(user_id);
  end if;
end;
$$;

do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'lead_form_responses'
  ) then
    drop trigger if exists linket_enforce_lead_form_response_answers on public.lead_form_responses;
    create trigger linket_enforce_lead_form_response_answers
      before insert or update of answers, form_id on public.lead_form_responses
      for each row execute function public.linket_enforce_lead_form_response_answers();
  end if;
end;
$$;

do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'conversion_events'
  ) then
    if exists (
      select 1
      from pg_policies
      where schemaname = 'public'
        and tablename = 'conversion_events'
        and policyname = 'conversion_events_owner_select'
    ) then
      drop policy conversion_events_owner_select on public.conversion_events;
    end if;

    create policy conversion_events_owner_select
      on public.conversion_events
      for select
      to authenticated
      using (
        user_id = auth.uid()
        and (
          public.linket_user_has_paid_access(auth.uid())
          or event_id = 'public_profile_view'
        )
      );
  end if;
end;
$$;
