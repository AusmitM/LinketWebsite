-- Extend tag_assignments with target fields
do $$
begin
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='tag_assignments' and column_name='target_type') then
    alter table public.tag_assignments add column target_type text check (target_type in ('profile','url')) default 'profile';
  end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='tag_assignments' and column_name='target_url') then
    alter table public.tag_assignments add column target_url text;
  end if;
end $$;

-- URL must be http(s) iff target_type=url
do $$
begin
  if not exists (select 1 from pg_constraint where conname='tag_assignments_url_when_needed') then
    alter table public.tag_assignments add constraint tag_assignments_url_when_needed
      check (target_type <> 'url' or (target_url is not null and target_url ~* '^(https?://)'));
  end if;
end $$;

-- Primary profile RPC (toggle is_active)
create or replace function public.set_primary_profile(p_profile_id uuid)
returns void language plpgsql security definer as $$
declare v_user uuid;
begin
  select user_id into v_user from public.user_profiles where id = p_profile_id;
  if v_user is null or v_user <> auth.uid() then raise exception 'forbidden'; end if;
  update public.user_profiles set is_active = false where user_id = v_user and is_active = true;
  update public.user_profiles set is_active = true where id = p_profile_id;
end $$;
