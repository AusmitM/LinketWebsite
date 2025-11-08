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
  v_batch_id uuid;
  v_chip_uid text;
  v_token text;
  v_code_raw text;
  v_code_disp text;
  v_inserted_id uuid;
  v_label text;
  v_minted int := 0;
  v_attempts int := 0;
  v_max_attempts int := greatest(p_qty * 5, 25);
begin
  v_label := coalesce(nullif(trim(p_batch_label), ''), to_char(now(), 'YYYY-MM-DD'));
  v_label := left(v_label, 64);

  insert into public.hardware_tag_batches as hb (label)
    values (v_label)
  returning hb.id into v_batch_id;

  while v_minted < p_qty loop
    exit when v_attempts >= v_max_attempts;

    v_attempts := v_attempts + 1;
    v_token := encode(gen_random_bytes(16), 'hex');
    v_chip_uid := encode(gen_random_bytes(12), 'hex');
    v_code_raw := upper(encode(gen_random_bytes(6), 'hex')); -- 12 hex chars
    v_code_disp := substr(v_code_raw, 1, 4) || '-' || substr(v_code_raw, 5, 4) || '-' || substr(v_code_raw, 9, 4);

    begin
      insert into public.hardware_tags as ht (chip_uid, public_token, claim_code, status, batch_id)
      values (v_chip_uid, v_token, v_code_raw, 'unclaimed', v_batch_id)
      returning ht.id into v_inserted_id;

      id := v_inserted_id;
      public_token := v_token;
      url := 'https://linketconnect.com/l/' || v_token;
      claim_code := v_code_raw;
      claim_code_display := v_code_disp;
      batch_id := v_batch_id;
      batch_label := v_label;

      v_minted := v_minted + 1;
      return next;
    exception
      when unique_violation then
        continue;
    end;
  end loop;

  if v_minted < p_qty then
    raise exception using message = format(
      'Minted %s of %s requested Linkets before exhausting attempts',
      v_minted,
      p_qty
    );
  end if;
end;
$$;
