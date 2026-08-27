-- Run once in Supabase SQL Editor.
-- Reuses store_settings and does not alter authentication, RLS or order logic.
alter table public.store_settings
  add column if not exists show_dashboard_refresh boolean not null default true;

notify pgrst, 'reload schema';
