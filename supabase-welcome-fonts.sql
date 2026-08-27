-- Run once in Supabase SQL Editor.

alter table public.store_settings
add column if not exists welcome_title_font text not null default 'fraunces';

alter table public.store_settings
add column if not exists welcome_body_font text not null default 'work_sans';

update public.store_settings
set
  welcome_title_font = coalesce(welcome_title_font, 'fraunces'),
  welcome_body_font = coalesce(welcome_body_font, 'work_sans');

