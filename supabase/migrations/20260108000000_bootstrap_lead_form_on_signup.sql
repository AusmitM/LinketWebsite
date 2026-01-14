create extension if not exists pgcrypto;

create or replace function public.bootstrap_user_profile_lead_form()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile_id uuid;
  v_handle text;
  v_now timestamptz := now();
  v_config jsonb;
begin
  select id, handle
    into v_profile_id, v_handle
  from public.user_profiles
  where user_id = new.id
  order by is_active desc, updated_at desc
  limit 1;

  if v_handle is null or v_handle = '' then
    v_handle := lower('user-' || substr(new.id::text, 1, 8));
  else
    v_handle := lower(v_handle);
  end if;

  if v_profile_id is null then
    insert into public.user_profiles (
      user_id,
      name,
      handle,
      headline,
      theme,
      is_active,
      created_at,
      updated_at
    ) values (
      new.id,
      'Linket Public Profile',
      v_handle,
      '',
      'autumn',
      true,
      v_now,
      v_now
    )
    returning id into v_profile_id;
  end if;

  if not exists (
    select 1
    from public.lead_forms
    where user_id = new.id
      and handle = v_handle
  ) then
    v_config := jsonb_build_object(
      'id', 'form-' || v_handle,
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
          'id', 'field_' || gen_random_uuid(),
          'type', 'short_text',
          'label', 'Name',
          'helpText', 'Ex. John Doe',
          'required', true,
          'validation', jsonb_build_object('rule', 'none')
        ),
        jsonb_build_object(
          'id', 'field_' || gen_random_uuid(),
          'type', 'short_text',
          'label', 'Phone Number',
          'helpText', '(###) ### - ####',
          'required', false,
          'validation', jsonb_build_object('rule', 'none')
        ),
        jsonb_build_object(
          'id', 'field_' || gen_random_uuid(),
          'type', 'short_text',
          'label', 'Email',
          'helpText', 'JDoe@LinketConnect.com',
          'required', true,
          'validation', jsonb_build_object('rule', 'email')
        ),
        jsonb_build_object(
          'id', 'field_' || gen_random_uuid(),
          'type', 'long_text',
          'label', 'Note',
          'helpText', '',
          'required', false,
          'validation', jsonb_build_object('rule', 'none')
        )
      ),
      'meta', jsonb_build_object(
        'createdAt', v_now,
        'updatedAt', v_now,
        'version', 1
      )
    );

    insert into public.lead_forms (
      user_id,
      profile_id,
      handle,
      status,
      title,
      description,
      config,
      created_at,
      updated_at
    ) values (
      new.id,
      v_profile_id,
      v_handle,
      'published',
      'Let''s Connect!',
      '',
      v_config,
      v_now,
      v_now
    );
  end if;

  return new;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_trigger where tgname = 'bootstrap_user_profile_lead_form'
  ) then
    create trigger bootstrap_user_profile_lead_form
      after insert on auth.users
      for each row execute function public.bootstrap_user_profile_lead_form();
  end if;
end $$;
