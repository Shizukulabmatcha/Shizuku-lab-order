-- Run once in Supabase SQL Editor to control List and Gallery from Admin.
alter table public.store_settings
  add column if not exists default_menu_view text not null default 'list',
  add column if not exists show_menu_view_switch boolean not null default true;
