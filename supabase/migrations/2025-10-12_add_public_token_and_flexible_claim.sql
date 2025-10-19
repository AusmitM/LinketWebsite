create extension if not exists pgcrypto;

-- Add public_token (opaque) for hard-coded URLs
do $$
begin
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='hardware_tags' and column_name='public_token') then
    alter table public.hardware_tags add column public_token text unique;
  end if;
end $$;

update public.hardware_tags
  set public_token = coalesce(public_token, encode(gen_random_bytes(16), 'hex'))
where public_token is null;

alter table public.hardware_tags alter column public_token set not null;
create index if not exists idx_hardware_tags_public_token on public.hardware_tags(public_token);

-- Set default status for boxed units
alter table public.hardware_tags alter column status set default 'claimable';

-- Fulfillment identity (for no-code claim)
do $$
begin
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='hardware_tags' and column_name='fulfillment_email') then
    alter table public.hardware_tags
      add column fulfillment_email text,
      add column fulfillment_set_at timestamptz;
    create index if not exists idx_tags_fulfillment_email on public.hardware_tags(lower(fulfillment_email));
  end if;
end $$;

-- Optional hashed claim code (keep plaintext if you already use it)
do $$
begin
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='hardware_tags' and column_name='claim_code_hash') then
    alter table public.hardware_tags add column claim_code_hash text;
  end if;
end $$;

-- Flexible claim: try email match first; fallback to code
create or replace function public.claim_hardware_tag_flexible(p_token text, p_claim_code text default null)
returns jsonb language plpgsql as $$
declare
  v_tag public.hardware_tags;
  v_assignment public.tag_assignments;
  v_user_email text;
  v_claimed boolean := false;
begin
  select email into v_user_email from auth.users where id = auth.uid();

  update public.hardware_tags
     set status = 'claimed', last_claimed_at = now()
   where (public_token = p_token or chip_uid = p_token)
     and status in ('claimable','unclaimed')
     and fulfillment_email is not null
     and lower(fulfillment_email) = lower(v_user_email)
  returning * into v_tag;

  if found then
    v_claimed := true;
  else
    update public.hardware_tags
       set status = 'claimed', last_claimed_at = now()
     where (public_token = p_token or chip_uid = p_token)
       and status in ('claimable','unclaimed')
       and (
         (claim_code_hash is not null and p_claim_code is not null and crypt(p_claim_code, claim_code_hash) = claim_code_hash)
         or (claim_code is not null and p_claim_code is not null and claim_code = p_claim_code)
       )
    returning * into v_tag;

    if found then v_claimed := true; end if;
  end if;

  if not v_claimed then
    return jsonb_build_object('claimed', false, 'reason', 'no_match');
  end if;

  insert into public.tag_assignments (tag_id, user_id)
  values (v_tag.id, auth.uid())
  on conflict (tag_id) do update set user_id = excluded.user_id
  returning * into v_assignment;

  return jsonb_build_object('claimed', true, 'tag_id', v_tag.id, 'assignment_id', v_assignment.id);
end $$;

-- Admin/ops RPC: set fulfillment email
create or replace function public.set_tag_fulfillment(p_token text, p_email text)
returns void language plpgsql security definer as $$
begin
  update public.hardware_tags
     set fulfillment_email = p_email,
         fulfillment_set_at = now()
   where public_token = p_token;
end $$;
