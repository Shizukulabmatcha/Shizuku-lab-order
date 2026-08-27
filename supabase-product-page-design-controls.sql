-- Run once in Supabase SQL Editor for editable product detail and option-card design.
alter table public.store_settings
  add column if not exists product_detail_image_height integer not null default 180,
  add column if not exists product_detail_image_fit text not null default 'cover',
  add column if not exists product_option_text_size integer not null default 15,
  add column if not exists product_option_compact boolean not null default true;
