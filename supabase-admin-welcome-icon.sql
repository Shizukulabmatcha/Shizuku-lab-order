-- Run once in Supabase SQL Editor to allow Admin to upload its Slow Studio icon.
alter table public.store_settings
add column if not exists admin_welcome_icon_url text;
