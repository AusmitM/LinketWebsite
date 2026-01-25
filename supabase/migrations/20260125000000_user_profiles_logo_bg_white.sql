alter table public.user_profiles
add column if not exists logo_bg_white boolean default false;
