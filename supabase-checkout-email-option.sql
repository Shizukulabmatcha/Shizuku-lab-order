-- Run once in Supabase SQL Editor to let Admin show or hide the customer email field at Checkout.
alter table public.store_settings
  add column if not exists show_checkout_email boolean not null default true;
