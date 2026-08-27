-- Run once in Supabase SQL Editor for PayNow QR mode and display controls.
alter table public.store_settings
  add column if not exists payment_qr_mode text not null default 'dynamic',
  add column if not exists show_paynow_name boolean not null default true,
  add column if not exists show_paynow_number boolean not null default true;
