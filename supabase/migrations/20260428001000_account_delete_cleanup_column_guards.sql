create or replace function public.linket_column_exists(
  p_table_name text,
  p_column_name text
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select to_regclass(format('public.%I', p_table_name)) is not null
    and exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = p_table_name
        and column_name = p_column_name
    );
$$;

create or replace function public.linket_delete_rows_by_column(
  p_table_name text,
  p_column_name text,
  p_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.linket_column_exists(p_table_name, p_column_name) then
    return;
  end if;

  execute format('delete from public.%I where %I::text = $1', p_table_name, p_column_name)
    using p_user_id::text;
end;
$$;

create or replace function public.linket_delete_rows_by_column_values(
  p_table_name text,
  p_column_name text,
  p_values text[]
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(array_length(p_values, 1), 0) = 0 then
    return;
  end if;

  if not public.linket_column_exists(p_table_name, p_column_name) then
    return;
  end if;

  execute format('delete from public.%I where %I::text = any($1)', p_table_name, p_column_name)
    using p_values;
end;
$$;

create or replace function public.linket_null_rows_by_column(
  p_table_name text,
  p_column_name text,
  p_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.linket_column_exists(p_table_name, p_column_name) then
    return;
  end if;

  execute format('update public.%I set %I = null where %I::text = $1', p_table_name, p_column_name, p_column_name)
    using p_user_id::text;
end;
$$;

create or replace function public.linket_delete_rows_by_user(
  p_table_name text,
  p_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.linket_delete_rows_by_column(p_table_name, 'user_id', p_user_id);
end;
$$;

create or replace function public.linket_cleanup_deleted_account()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tag_ids uuid[] := array[]::uuid[];
  v_tag_id_values text[] := array[]::text[];
  v_user_profile_ids text[] := array[]::text[];
  v_lead_form_ids text[] := array[]::text[];
  v_lead_ids text[] := array[]::text[];
  v_lead_message_ids text[] := array[]::text[];
  v_mailbox_connection_ids text[] := array[]::text[];
  v_order_ids text[] := array[]::text[];
  v_legacy_linket_ids text[] := array[]::text[];
  v_legacy_linket_profile_ids text[] := array[]::text[];
begin
  if public.linket_column_exists('tag_assignments', 'tag_id')
     and public.linket_column_exists('tag_assignments', 'user_id') then
    execute $sql$
      select coalesce(
        array_agg(distinct tag_id) filter (where tag_id is not null),
        array[]::uuid[]
      )
      from public.tag_assignments
      where user_id = $1
    $sql$
      into v_tag_ids
      using old.id;

    select coalesce(array_agg(value::text), array[]::text[])
      into v_tag_id_values
      from unnest(v_tag_ids) as value;
  end if;

  if public.linket_column_exists('user_profiles', 'id')
     and public.linket_column_exists('user_profiles', 'user_id') then
    execute $sql$
      select coalesce(array_agg(id::text), array[]::text[])
      from public.user_profiles
      where user_id = $1
    $sql$
      into v_user_profile_ids
      using old.id;
  end if;

  if public.linket_column_exists('lead_forms', 'id')
     and public.linket_column_exists('lead_forms', 'user_id') then
    execute $sql$
      select coalesce(array_agg(id::text), array[]::text[])
      from public.lead_forms
      where user_id = $1
    $sql$
      into v_lead_form_ids
      using old.id;
  end if;

  if public.linket_column_exists('leads', 'id')
     and public.linket_column_exists('leads', 'user_id') then
    execute $sql$
      select coalesce(array_agg(id::text), array[]::text[])
      from public.leads
      where user_id = $1
    $sql$
      into v_lead_ids
      using old.id;
  end if;

  if public.linket_column_exists('lead_messages', 'id') then
    if public.linket_column_exists('lead_messages', 'user_id') then
      execute $sql$
        select coalesce(array_agg(id::text), array[]::text[])
        from public.lead_messages
        where user_id = $1
      $sql$
        into v_lead_message_ids
        using old.id;
    end if;

    if public.linket_column_exists('lead_messages', 'lead_id')
       and coalesce(array_length(v_lead_ids, 1), 0) > 0 then
      execute $sql$
        select coalesce(array_agg(id::text), array[]::text[])
        from public.lead_messages
        where lead_id::text = any($1)
      $sql$
        into v_lead_message_ids
        using v_lead_ids;
    end if;
  end if;

  if public.linket_column_exists('mailbox_connections', 'id')
     and public.linket_column_exists('mailbox_connections', 'user_id') then
    execute $sql$
      select coalesce(array_agg(id::text), array[]::text[])
      from public.mailbox_connections
      where user_id = $1
    $sql$
      into v_mailbox_connection_ids
      using old.id;
  end if;

  if public.linket_column_exists('orders', 'id')
     and public.linket_column_exists('orders', 'user_id') then
    execute $sql$
      select coalesce(array_agg(id::text), array[]::text[])
      from public.orders
      where user_id = $1
    $sql$
      into v_order_ids
      using old.id;
  end if;

  if public.linket_column_exists('linkets', 'linket_id')
     and public.linket_column_exists('linkets', 'user_id') then
    execute $sql$
      select coalesce(array_agg(linket_id::text), array[]::text[])
      from public.linkets
      where user_id = $1
    $sql$
      into v_legacy_linket_ids
      using old.id;
  end if;

  if public.linket_column_exists('linket_profiles', 'profile_id')
     and public.linket_column_exists('linket_profiles', 'linket_id')
     and coalesce(array_length(v_legacy_linket_ids, 1), 0) > 0 then
    execute $sql$
      select coalesce(array_agg(profile_id::text), array[]::text[])
      from public.linket_profiles
      where linket_id::text = any($1)
    $sql$
      into v_legacy_linket_profile_ids
      using v_legacy_linket_ids;
  end if;

  perform public.linket_delete_rows_by_user('linket_transfer_requests', old.id);
  perform public.linket_delete_rows_by_column('linket_transfer_requests', 'accepted_by_user_id', old.id);
  perform public.linket_delete_rows_by_column_values('linket_transfer_requests', 'tag_id', v_tag_id_values);

  perform public.linket_delete_rows_by_column('linket_pro_offer_claims', 'claimed_by_user_id', old.id);
  perform public.linket_delete_rows_by_column_values('linket_pro_offer_claims', 'tag_id', v_tag_id_values);

  perform public.linket_delete_rows_by_user('message_sync_events', old.id);
  perform public.linket_delete_rows_by_column_values('message_sync_events', 'lead_message_id', v_lead_message_ids);
  perform public.linket_delete_rows_by_column_values('lead_messages', 'lead_id', v_lead_ids);
  perform public.linket_delete_rows_by_user('lead_messages', old.id);
  perform public.linket_delete_rows_by_column_values('lead_messages', 'mailbox_connection_id', v_mailbox_connection_ids);
  perform public.linket_delete_rows_by_user('leads', old.id);
  perform public.linket_delete_rows_by_user('mailbox_connections', old.id);

  perform public.linket_delete_rows_by_column_values('lead_form_responses', 'form_id', v_lead_form_ids);
  perform public.linket_delete_rows_by_user('lead_form_settings', old.id);
  perform public.linket_delete_rows_by_user('lead_form_fields', old.id);
  perform public.linket_delete_rows_by_user('lead_forms', old.id);

  perform public.linket_delete_rows_by_column_values('tag_rollups', 'tag_id', v_tag_id_values);

  if to_regclass('public.tag_events') is not null then
    perform public.linket_delete_rows_by_column_values('tag_events', 'tag_id', v_tag_id_values);

    if public.linket_column_exists('tag_events', 'metadata') then
      execute $sql$
        delete from public.tag_events
        where metadata->>'user_id' = $1::text
           or metadata->>'claimer_user_id' = $1::text
           or metadata->>'entitlement_user_id' = $1::text
      $sql$
        using old.id;
    end if;
  end if;

  perform public.linket_delete_rows_by_user('tag_assignments', old.id);
  perform public.linket_delete_rows_by_column_values('tag_assignments', 'profile_id', v_user_profile_ids);

  if public.linket_column_exists('hardware_tags', 'id')
     and coalesce(array_length(v_tag_ids, 1), 0) > 0 then
    execute $sql$
      update public.hardware_tags
      set status = 'unclaimed',
          last_claimed_at = null
      where id = any($1)
    $sql$
      using v_tag_ids;
  end if;

  perform public.linket_delete_rows_by_column_values('links', 'profile_id', v_legacy_linket_profile_ids);
  perform public.linket_delete_rows_by_column_values('taps_leads', 'linket_id', v_legacy_linket_ids);
  perform public.linket_delete_rows_by_column_values('linket_profiles', 'linket_id', v_legacy_linket_ids);
  perform public.linket_delete_rows_by_column_values('linket_profiles', 'profile_id', v_user_profile_ids);
  perform public.linket_delete_rows_by_user('linkets', old.id);

  perform public.linket_delete_rows_by_user('conversion_events', old.id);
  perform public.linket_delete_rows_by_user('profile_link_clicks', old.id);
  perform public.linket_delete_rows_by_user('profile_links', old.id);
  perform public.linket_delete_rows_by_user('vcard_profiles', old.id);
  perform public.linket_delete_rows_by_user('vcard', old.id);
  perform public.linket_delete_rows_by_user('profiles', old.id);

  perform public.linket_delete_rows_by_user('billing_entitlements', old.id);
  perform public.linket_delete_rows_by_user('billing_subscriptions', old.id);
  perform public.linket_delete_rows_by_user('billing_orders', old.id);
  perform public.linket_delete_rows_by_user('billing_customers', old.id);
  perform public.linket_delete_rows_by_user('subscription_billing_events', old.id);
  perform public.linket_delete_rows_by_user('subscription_billing_periods', old.id);
  perform public.linket_delete_rows_by_user('bundle_purchases', old.id);
  perform public.linket_delete_rows_by_column_values('bundle_purchases', 'order_id', v_order_ids);
  perform public.linket_delete_rows_by_user('orders', old.id);

  perform public.linket_delete_rows_by_column('dashboard_notifications', 'created_by', old.id);
  perform public.linket_delete_rows_by_column('dashboard_notifications', 'updated_by', old.id);
  perform public.linket_null_rows_by_column('admin_users', 'created_by', old.id);
  perform public.linket_delete_rows_by_user('admin_users', old.id);

  perform public.linket_delete_rows_by_user('user_profiles', old.id);

  return old;
end;
$$;

do $$
begin
  if exists (
    select 1
    from pg_trigger
    where tgname = 'linket_cleanup_deleted_account'
      and tgrelid = 'auth.users'::regclass
  ) then
    drop trigger linket_cleanup_deleted_account on auth.users;
  end if;

  create trigger linket_cleanup_deleted_account
    before delete on auth.users
    for each row execute function public.linket_cleanup_deleted_account();
end;
$$;
