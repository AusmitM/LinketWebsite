alter table public.user_profiles
  add column if not exists header_image_url text,
  add column if not exists header_image_updated_at timestamptz;

-- Ensure profile header bucket exists and is public
insert into storage.buckets (id, name, public)
values ('profile-headers', 'profile-headers', true)
on conflict (id) do update
set public = excluded.public;

-- Allow public read access to profile header images
do $$
begin
  if exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Profile headers public read'
  ) then
    execute 'drop policy "Profile headers public read" on storage.objects';
  end if;

  execute $pol$
    create policy "Profile headers public read"
      on storage.objects
      for select
      using (bucket_id = 'profile-headers');
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
      and policyname = 'Profile headers user insert'
  ) then
    execute 'drop policy "Profile headers user insert" on storage.objects';
  end if;

  execute $pol$
    create policy "Profile headers user insert"
      on storage.objects
      for insert
      with check (
        bucket_id = 'profile-headers'
        and auth.role() = 'authenticated'
        and split_part(name, '/', 1) = auth.uid()::text
      );
  $pol$;
end
$$;

-- Allow users to update their own header files
do $$
begin
  if exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Profile headers user update'
  ) then
    execute 'drop policy "Profile headers user update" on storage.objects';
  end if;

  execute $pol$
    create policy "Profile headers user update"
      on storage.objects
      for update
      using (
        bucket_id = 'profile-headers'
        and split_part(name, '/', 1) = auth.uid()::text
      )
      with check (
        bucket_id = 'profile-headers'
        and split_part(name, '/', 1) = auth.uid()::text
      );
  $pol$;
end
$$;

-- Allow users to delete their own header files
do $$
begin
  if exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Profile headers user delete'
  ) then
    execute 'drop policy "Profile headers user delete" on storage.objects';
  end if;

  execute $pol$
    create policy "Profile headers user delete"
      on storage.objects
      for delete
      using (
        bucket_id = 'profile-headers'
        and split_part(name, '/', 1) = auth.uid()::text
      );
  $pol$;
end
$$;
