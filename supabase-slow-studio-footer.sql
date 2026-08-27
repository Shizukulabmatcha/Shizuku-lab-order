-- Shizuku Lab: editable Powered by Slow Studio footer.
-- Run this whole file once in Supabase SQL Editor.

alter table public.store_settings
  add column if not exists powered_by_text text default 'Powered by Slow Studio',
  add column if not exists powered_by_url text,
  add column if not exists show_powered_by boolean not null default true;

update public.store_settings
set powered_by_text = coalesce(nullif(trim(powered_by_text), ''), 'Powered by Slow Studio');

notify pgrst, 'reload schema';
