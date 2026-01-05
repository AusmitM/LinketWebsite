alter table public.profile_links
  add column if not exists click_count int not null default 0;

create or replace function public.increment_profile_link_click(p_link_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.profile_links
  set click_count = click_count + 1
  where id = p_link_id;
$$;

grant execute on function public.increment_profile_link_click(uuid) to service_role;
