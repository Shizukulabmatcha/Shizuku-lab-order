-- Run once in Supabase SQL Editor.

alter table public.store_settings
add column if not exists welcome_track_button_text text
default 'Track order';

alter table public.store_settings
add column if not exists welcome_loyalty_button_text text
default 'Check your loyalty';

update public.store_settings
set
  welcome_track_button_text = coalesce(welcome_track_button_text, 'Track order'),
  welcome_loyalty_button_text = coalesce(welcome_loyalty_button_text, 'Check your loyalty');
