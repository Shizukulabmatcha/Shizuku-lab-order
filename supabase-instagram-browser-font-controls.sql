-- Run once in Supabase SQL Editor for the Instagram guidance and editable font sizes.
alter table public.store_settings
  add column if not exists show_instagram_browser_notice boolean not null default true,
  add column if not exists theme_heading_size integer not null default 25,
  add column if not exists theme_body_size integer not null default 14,
  add column if not exists theme_product_name_size integer not null default 15,
  add column if not exists theme_price_size integer not null default 14,
  add column if not exists theme_button_size integer not null default 14,
  add column if not exists welcome_title_size integer not null default 39;
