-- Ensure avatars bucket exists and is public
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do update
set public = excluded.public;

-- Allow public read access to avatar images
do $$
begin
  if exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Avatars public read'
  ) then
    execute 'drop policy "Avatars public read" on storage.objects';
  end if;

  execute $pol$
    create policy "Avatars public read"
      on storage.objects
      for select
      using (bucket_id = 'avatars');
  $pol$;
end
$$;

-- Allow users to upload files inside their own folder (user_id/filename)
do $$
begin
  if exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Avatars user insert'
  ) then
    execute 'drop policy "Avatars user insert" on storage.objects';
  end if;

  execute $pol$
    create policy "Avatars user insert"
      on storage.objects
      for insert
      with check (
        bucket_id = 'avatars'
        and auth.role() = 'authenticated'
        and split_part(name, '/', 1) = auth.uid()::text
      );
  $pol$;
end
$$;

-- Allow users to update their own avatar files
do $$
begin
  if exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Avatars user update'
  ) then
    execute 'drop policy "Avatars user update" on storage.objects';
  end if;

  execute $pol$
    create policy "Avatars user update"
      on storage.objects
      for update
      using (
        bucket_id = 'avatars'
        and split_part(name, '/', 1) = auth.uid()::text
      )
      with check (
        bucket_id = 'avatars'
        and split_part(name, '/', 1) = auth.uid()::text
      );
  $pol$;
end
$$;

-- Allow users to delete their own avatar files
do $$
begin
  if exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Avatars user delete'
  ) then
    execute 'drop policy "Avatars user delete" on storage.objects';
  end if;

  execute $pol$
    create policy "Avatars user delete"
      on storage.objects
      for delete
      using (
        bucket_id = 'avatars'
        and split_part(name, '/', 1) = auth.uid()::text
      );
  $pol$;
end
$$;
