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
        and column_name = 'note'
    ) then
      alter table public.leads
        add column note text not null default '';
    end if;

    if not exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'leads'
        and column_name = 'next_follow_up_at'
    ) then
      alter table public.leads
        add column next_follow_up_at timestamptz default (now() + interval '1 day');
    end if;

    if not exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'leads'
        and column_name = 'lead_flag'
    ) then
      alter table public.leads
        add column lead_flag text not null default 'follow_up';
    end if;

    if not exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'leads'
        and column_name = 'lead_rating'
    ) then
      alter table public.leads
        add column lead_rating integer not null default 3;
    end if;
  end if;
end $$;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'leads'
      and column_name = 'next_follow_up_at'
  ) then
    alter table public.leads
      alter column next_follow_up_at set default (now() + interval '1 day');
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'leads'
      and column_name = 'lead_flag'
  ) then
    alter table public.leads
      alter column lead_flag set default 'follow_up';
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'leads'
      and column_name = 'lead_rating'
  ) then
    alter table public.leads
      alter column lead_rating set default 3;
  end if;
end $$;

do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'leads'
  ) then
    alter table public.leads
      drop constraint if exists leads_lead_flag_check;

    alter table public.leads
      drop constraint if exists leads_lead_rating_check;
  end if;
end $$;

do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'leads'
  ) then
    update public.leads
    set
      note = coalesce(note, ''),
      next_follow_up_at = coalesce(next_follow_up_at, created_at + interval '1 day'),
      lead_flag = case
        when lead_flag in ('follow_up', 'done') then lead_flag
        when lead_flag in ('followed_up', 'archived', 'spam') then 'done'
        else 'follow_up'
      end,
      lead_rating = case
        when lead_rating between 1 and 5 then lead_rating
        when lead_flag = 'hot' then 5
        when lead_flag in ('needs_pricing', 'book_demo') then 4
        when lead_flag in ('qualified', 'need_follow_up') then 3
        when lead_flag in ('followed_up', 'done') then 2
        when lead_flag in ('archived', 'spam') then 1
        else 3
      end;
  end if;
end $$;

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
      from pg_constraint
      where conname = 'leads_lead_flag_check'
    ) then
      alter table public.leads
        add constraint leads_lead_flag_check
        check (
          lead_flag in ('follow_up', 'done')
        );
    end if;

    if not exists (
      select 1
      from pg_constraint
      where conname = 'leads_lead_rating_check'
    ) then
      alter table public.leads
        add constraint leads_lead_rating_check
        check (lead_rating between 1 and 5);
    end if;
  end if;
end $$;

create index if not exists leads_user_next_follow_up_at_idx
  on public.leads (user_id, next_follow_up_at)
  where next_follow_up_at is not null;

create index if not exists leads_user_lead_flag_idx
  on public.leads (user_id, lead_flag);

create index if not exists leads_user_lead_rating_idx
  on public.leads (user_id, lead_rating);
