-- Shizuku Lab: product-specific promo codes + Welcome announcement
-- Run once in Supabase SQL Editor, then refresh the Admin page.

alter table public.promo_codes
  add column if not exists applicable_product_ids jsonb not null default '[]'::jsonb;

alter table public.store_settings
  add column if not exists show_announcement boolean not null default false,
  add column if not exists announcement_title text default 'This week at Shizuku Lab',
  add column if not exists announcement_message text,
  add column if not exists announcement_promo_code text,
  add column if not exists announcement_button_text text default 'Continue';

notify pgrst, 'reload schema';
