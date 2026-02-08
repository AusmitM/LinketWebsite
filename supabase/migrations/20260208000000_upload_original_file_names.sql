alter table public.profiles
  add column if not exists avatar_original_file_name text;

alter table public.user_profiles
  add column if not exists header_image_original_file_name text,
  add column if not exists logo_original_file_name text;
