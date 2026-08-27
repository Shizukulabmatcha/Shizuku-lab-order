-- Shizuku Lab · live order wording upgrade
-- Safe to run once. Existing order/payment statuses remain the single source of truth.

alter table public.store_settings
  add column if not exists track_stage_collected text not null default 'Collected';

grant select on public.store_settings to anon, authenticated;
grant update on public.store_settings to authenticated;

