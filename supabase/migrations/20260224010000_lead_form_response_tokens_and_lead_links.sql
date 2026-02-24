do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'lead_form_responses'
  ) then
    if not exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'lead_form_responses'
        and column_name = 'response_token'
    ) then
      alter table public.lead_form_responses add column response_token text;
    end if;
  end if;
end $$;

create unique index if not exists lead_form_responses_response_token_unique
  on public.lead_form_responses (response_token)
  where response_token is not null;

create index if not exists lead_form_responses_form_response_token_lookup
  on public.lead_form_responses (form_id, response_id, response_token);

do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'leads'
  ) then
    if not exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'leads'
        and column_name = 'lead_response_id'
    ) then
      alter table public.leads add column lead_response_id text;
    end if;
  end if;
end $$;

create unique index if not exists leads_user_lead_response_id_unique
  on public.leads (user_id, lead_response_id)
  where lead_response_id is not null;
