-- Ensure lead form upload bucket exists and is public
insert into storage.buckets (id, name, public)
values ('lead-form-uploads', 'lead-form-uploads', true)
on conflict (id) do update
set public = excluded.public;

-- Allow public read access to uploaded lead form files
do $$
begin
  if exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Lead form uploads public read'
  ) then
    execute 'drop policy "Lead form uploads public read" on storage.objects';
  end if;

  execute $pol$
    create policy "Lead form uploads public read"
      on storage.objects
      for select
      using (bucket_id = 'lead-form-uploads');
  $pol$;
end
$$;
