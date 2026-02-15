alter table public.profile_links
  add column if not exists is_override boolean not null default false;

alter table public.profile_links
  alter column is_override set default false;

update public.profile_links
set is_override = false
where is_override is null;

alter table public.profile_links
  alter column is_override set not null;

with ranked_overrides as (
  select
    id,
    row_number() over (
      partition by profile_id
      order by order_index asc, created_at asc, id asc
    ) as row_num
  from public.profile_links
  where is_override = true
)
update public.profile_links target
set is_override = false
from ranked_overrides ranked
where target.id = ranked.id
  and ranked.row_num > 1;

update public.profile_links
set is_active = true
where is_override = true
  and is_active = false;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'profile_links_override_requires_active'
      and conrelid = 'public.profile_links'::regclass
  ) then
    alter table public.profile_links
      add constraint profile_links_override_requires_active
      check (not is_override or is_active);
  end if;
end
$$;

create unique index if not exists profile_links_single_override_per_profile_idx
  on public.profile_links (profile_id)
  where is_override = true;
