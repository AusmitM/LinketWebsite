create or replace function public.linket_delete_rows_by_user(
  p_table_name text,
  p_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_relation regclass;
begin
  v_relation := to_regclass(format('public.%I', p_table_name));
  if v_relation is null then
    return;
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = p_table_name
      and column_name = 'user_id'
  ) then
    return;
  end if;

  execute format('delete from public.%I where user_id = $1', p_table_name)
    using p_user_id;
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
begin
  if to_regclass('public.tag_assignments') is not null then
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
  end if;

  if to_regclass('public.tag_rollups') is not null
     and coalesce(array_length(v_tag_ids, 1), 0) > 0 then
    execute $sql$
      delete from public.tag_rollups
      where tag_id = any($1)
    $sql$
      using v_tag_ids;
  end if;

  if to_regclass('public.tag_events') is not null then
    if coalesce(array_length(v_tag_ids, 1), 0) > 0 then
      execute $sql$
        delete from public.tag_events
        where tag_id = any($2)
           or metadata->>'user_id' = $1::text
           or metadata->>'claimer_user_id' = $1::text
           or metadata->>'entitlement_user_id' = $1::text
      $sql$
        using old.id, v_tag_ids;
    else
      execute $sql$
        delete from public.tag_events
        where metadata->>'user_id' = $1::text
           or metadata->>'claimer_user_id' = $1::text
           or metadata->>'entitlement_user_id' = $1::text
      $sql$
        using old.id;
    end if;
  end if;

  if to_regclass('public.tag_assignments') is not null then
    execute $sql$
      delete from public.tag_assignments
      where user_id = $1
    $sql$
      using old.id;
  end if;

  if to_regclass('public.hardware_tags') is not null
     and coalesce(array_length(v_tag_ids, 1), 0) > 0 then
    execute $sql$
      update public.hardware_tags
      set status = 'unclaimed',
          last_claimed_at = null
      where id = any($1)
    $sql$
      using v_tag_ids;
  end if;

  if to_regclass('public.dashboard_notifications') is not null then
    execute $sql$
      delete from public.dashboard_notifications
      where created_by = $1
         or updated_by = $1
    $sql$
      using old.id;
  end if;

  if to_regclass('public.admin_users') is not null then
    execute $sql$
      update public.admin_users
      set created_by = null
      where created_by = $1
    $sql$
      using old.id;
  end if;

  perform public.linket_delete_rows_by_user('conversion_events', old.id);
  perform public.linket_delete_rows_by_user('lead_form_settings', old.id);
  perform public.linket_delete_rows_by_user('lead_form_fields', old.id);
  perform public.linket_delete_rows_by_user('lead_forms', old.id);
  perform public.linket_delete_rows_by_user('profile_links', old.id);
  perform public.linket_delete_rows_by_user('user_profiles', old.id);
  perform public.linket_delete_rows_by_user('vcard_profiles', old.id);
  perform public.linket_delete_rows_by_user('profiles', old.id);
  perform public.linket_delete_rows_by_user('admin_users', old.id);
  perform public.linket_delete_rows_by_user('subscription_billing_events', old.id);
  perform public.linket_delete_rows_by_user('subscription_billing_periods', old.id);
  perform public.linket_delete_rows_by_user('bundle_purchases', old.id);
  perform public.linket_delete_rows_by_user('orders', old.id);

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
