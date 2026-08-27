-- Shizuku Lab: persistent draggable Admin sidebar order
-- Safe to run more than once.
alter table public.store_settings
  add column if not exists admin_sidebar_order jsonb not null default '[]'::jsonb;

-- store_settings is already used by the authenticated Admin dashboard.
-- Explicit grant keeps the field reachable through the Supabase Data API.
grant select, update on public.store_settings to authenticated;
