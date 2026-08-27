-- Run once to choose the Admin Welcome duration from Store settings.
alter table public.store_settings
add column if not exists admin_welcome_duration_seconds integer not null default 5;
