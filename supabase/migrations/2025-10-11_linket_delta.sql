-- ===== Delta for Linket system (maps to your existing schema) =====

-- 0) Base
create extension if not exists pgcrypto;

-- 1) Hardware tags: add public_token + richer statuses
do $$
begin
  if not exists (select 1 from information_schema.columns
                 where table_schema='public' and table_name='hardware_tags' and column_name='public_token') then
    alter table public.hardware_tags
      add column public_token text unique;

    -- generate tokens for existing rows (32 hex chars)
    update public.hardware_tags
      set public_token = encode(gen_random_bytes(16), 'hex')
      where public_token is null;

    alter table public.hardware_tags alter column public_token set not null;
  end if;
end $$;

-- status: expand to cover more states (remains TEXT for minimal churn)
-- Allowed statuses: unclaimed | claimable | claimed | lost | suspended | retired | archived
-- Make sure default is 'claimable' for packaged units:
alter table public.hardware_tags alter column status set default 'claimable';

-- 2) Tag events: add analytics columns + indexes
do $$
begin
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='tag_events' and column_name='ip_hash') then
    alter table public.tag_events add column ip_hash text;
  end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='tag_events' and column_name='country') then
    alter table public.tag_events add column country text;
  end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='tag_events' and column_name='device') then
    alter table public.tag_events add column device text;
  end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='tag_events' and column_name='referrer') then
    alter table public.tag_events add column referrer text;
  end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='tag_events' and column_name='utm') then
    alter table public.tag_events add column utm jsonb;
  end if;
end $$;

create index if not exists idx_tag_events_tag_time on public.tag_events(tag_id, occurred_at);
create index if not exists idx_tag_events_type_time on public.tag_events(event_type, occurred_at);
create index if not exists idx_tag_events_iphash on public.tag_events(ip_hash);

-- 3) Rollups (hourly aggregates per tag)
create table if not exists public.tag_rollups (
  tag_id uuid not null references public.hardware_tags(id) on delete cascade,
  hour timestamptz not null,
  scans int not null default 0,
  uniques int not null default 0,
  vcards int not null default 0,
  leads int not null default 0,
  contacts int not null default 0,
  primary key (tag_id, hour)
);
alter table public.tag_rollups enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='tag_rollups' and policyname='tag_rollups_owner_select'
  ) then
    create policy tag_rollups_owner_select on public.tag_rollups
      for select using (
        exists (
          select 1 from public.tag_assignments a
          where a.tag_id = tag_rollups.tag_id and a.user_id = auth.uid()
        )
      );
  end if;
end $$;

-- 4) Atomic claim RPC (claim hardware_tag and create assignment)
create or replace function public.claim_hardware_tag(p_token text, p_claim_code text)
returns jsonb language plpgsql as $$
declare v_tag public.hardware_tags;
declare v_assignment public.tag_assignments;
begin
  -- Only claimable or unclaimed
  update public.hardware_tags
  set status = 'claimed', last_claimed_at = now()
  where (public_token = p_token or chip_uid = p_token)
    and status in ('claimable','unclaimed')
    and (claim_code is not null and claim_code = p_claim_code)
  returning * into v_tag;

  if not found then
    return jsonb_build_object('claimed', false);
  end if;

  -- Create or upsert assignment to current user
  insert into public.tag_assignments (tag_id, user_id, profile_id, nickname, last_redirected_at)
  values (v_tag.id, auth.uid(), null, null, null)
  on conflict (tag_id) do update set user_id = auth.uid()
  returning * into v_assignment;

  return jsonb_build_object('claimed', true, 'tag_id', v_tag.id, 'assignment_id', v_assignment.id);
end $$;

-- 5) Owner export RPC (hour/day)
create or replace function public.owner_tag_rollups(p_user_id uuid, p_from timestamptz, p_to timestamptz, p_gran text)
returns table(
  tag_id uuid, token_masked text, nickname text, bucket timestamptz,
  scans int, uniques int, vcards int, leads int, contacts int
) language sql stable as $$
  with owner as (
    select t.id, t.public_token, a.nickname
    from public.hardware_tags t
    join public.tag_assignments a on a.tag_id = t.id
    where a.user_id = p_user_id
  )
  select r.tag_id,
         substr(o.public_token,1,4) || '****' || right(o.public_token,4) as token_masked,
         o.nickname,
         case when p_gran='day' then date_trunc('day', r.hour) else r.hour end as bucket,
         sum(r.scans), sum(r.uniques), sum(r.vcards), sum(r.leads), sum(r.contacts)
  from public.tag_rollups r
  join owner o on o.id = r.tag_id
  where r.hour >= p_from and r.hour < p_to
  group by r.tag_id, token_masked, o.nickname, bucket
  order by bucket asc;
$$;

-- 6) Hourly rollup (run via scheduler/cron)
-- (Use this query in a scheduled task; not executed automatically here)
-- insert into public.tag_rollups(tag_id, hour, scans, uniques, vcards, leads, contacts)
-- select tag_id,
--        date_trunc('hour', occurred_at) as hour,
--        count(*) filter (where event_type='scan') as scans,
--        count(distinct ip_hash) filter (where event_type='scan') as uniques,
--        count(*) filter (where event_type='vcard_dl') as vcards,
--        count(*) filter (where event_type='lead_submit') as leads,
--        count(*) filter (where event_type='contact_click') as contacts
-- from public.tag_events
-- where occurred_at >= now() - interval '65 minutes'
-- group by tag_id, date_trunc('hour', occurred_at)
-- on conflict (tag_id, hour) do update
-- set scans = excluded.scans,
--     uniques = excluded.uniques,
--     vcards = excluded.vcards,
--     leads = excluded.leads,
--     contacts = excluded.contacts;

-- 7) Helpful indexes
create index if not exists idx_tags_public_token on public.hardware_tags(public_token);
create index if not exists idx_assignments_user on public.tag_assignments(user_id);
create index if not exists idx_assignments_tag on public.tag_assignments(tag_id);
