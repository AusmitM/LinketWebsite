-- Ensure public handles are globally unique.
-- 1) Normalize casing.
update public.user_profiles
set handle = lower(handle)
where handle <> lower(handle);

-- 2) Resolve duplicates by appending a stable suffix.
with ranked as (
  select
    id,
    handle,
    row_number() over (
      partition by handle
      order by is_active desc, updated_at desc, created_at desc, id
    ) as rn
  from public.user_profiles
),
updates as (
  select
    id,
    handle as old_handle,
    case
      when rn = 1 then handle
      else handle || '-' || substr(id::text, 1, 6)
    end as new_handle
  from ranked
)
update public.lead_forms lf
set handle = u.new_handle
from updates u
where lf.profile_id = u.id
  and lf.handle = u.old_handle;

with ranked as (
  select
    id,
    handle,
    row_number() over (
      partition by handle
      order by is_active desc, updated_at desc, created_at desc, id
    ) as rn
  from public.user_profiles
),
updates as (
  select
    id,
    handle as old_handle,
    case
      when rn = 1 then handle
      else handle || '-' || substr(id::text, 1, 6)
    end as new_handle
  from ranked
)
update public.user_profiles up
set handle = lower(u.new_handle)
from updates u
where up.id = u.id
  and u.new_handle <> u.old_handle;

-- 3) Enforce uniqueness going forward.
create unique index if not exists user_profiles_handle_unique
  on public.user_profiles (handle);
