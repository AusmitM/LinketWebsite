create extension if not exists pgcrypto;

create table if not exists public.hardware_tag_batches (
  id uuid primary key default gen_random_uuid(),
  label text,
  created_at timestamptz not null default now()
);

do $$
begin
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='hardware_tags' and column_name='batch_id') then
    alter table public.hardware_tags add column batch_id uuid references public.hardware_tag_batches(id);
  end if;
end $$;

create or replace function public.mint_linkets_csv(p_qty int, p_batch_label text default null)
returns table (
  id uuid,
  public_token text,
  url text,
  claim_code text,
  claim_code_display text,
  batch_id uuid,
  batch_label text
) language plpgsql as $$
declare
  i int := 0;
  v_id uuid;
  v_token text;
  v_code_raw text;
  v_code_disp text;
  v_batch_id uuid;
begin
  insert into public.hardware_tag_batches(label) values (p_batch_label) returning id into v_batch_id;

  while i < p_qty loop
    v_token := encode(gen_random_bytes(16), 'hex');
    v_code_raw := upper(encode(gen_random_bytes(6), 'hex')); -- 12 hex chars
    v_code_disp := substr(v_code_raw,1,4) || '-' || substr(v_code_raw,5,4) || '-' || substr(v_code_raw,9,4);

    begin
      insert into public.hardware_tags (public_token, claim_code, status, batch_id)
      values (v_token, v_code_raw, 'unclaimed', v_batch_id)
      returning id into v_id;

      i := i + 1;
      return query
      select v_id,
             v_token,
             'https://linketconnect.com/l/' || v_token as url,
             v_code_raw as claim_code,
             v_code_disp as claim_code_display,
             v_batch_id as batch_id,
             p_batch_label as batch_label;
    exception when unique_violation then continue;
    end;
  end loop;
end $$;
