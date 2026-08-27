-- Run once in Supabase SQL Editor before using the new Admin CMS pages.
alter table public.store_settings
  add column if not exists store_tagline text default '雫ラボ · crafted drop by drop',
  add column if not exists theme_primary_color text default '#4B5D3A',
  add column if not exists theme_background_color text default '#F3EEE3',
  add column if not exists theme_card_color text default '#FFFFFF',
  add column if not exists theme_text_color text default '#2A2A22',
  add column if not exists theme_heading_font text default 'fraunces',
  add column if not exists theme_body_font text default 'work_sans',
  add column if not exists theme_heading_size integer not null default 25,
  add column if not exists theme_body_size integer not null default 14,
  add column if not exists theme_product_name_size integer not null default 15,
  add column if not exists theme_price_size integer not null default 14,
  add column if not exists theme_button_size integer not null default 14,
  add column if not exists welcome_title_size integer not null default 39,
  add column if not exists show_instagram_browser_notice boolean not null default true,
  add column if not exists default_menu_view text not null default 'list',
  add column if not exists show_menu_view_switch boolean not null default true,
  add column if not exists product_detail_image_height integer not null default 180,
  add column if not exists product_detail_image_fit text not null default 'cover',
  add column if not exists product_option_text_size integer not null default 15,
  add column if not exists product_option_compact boolean not null default true,
  add column if not exists payment_qr_mode text not null default 'dynamic',
  add column if not exists show_paynow_name boolean not null default true,
  add column if not exists show_paynow_number boolean not null default true,
  add column if not exists menu_heading text default 'メニュー · DRINK MENU',
  add column if not exists reviews_heading text default 'お客様の声 · REVIEWS',
  add column if not exists track_order_heading text default 'Track my order',
  add column if not exists loyalty_heading text default 'Shizuku Club',
  add column if not exists loyalty_card_background text default '#1E473E',
  add column if not exists loyalty_card_text_color text default '#F9F4E8',
  add column if not exists loyalty_card_accent_color text default '#CAE4B3',
  add column if not exists show_checkout_instagram boolean not null default true,
  add column if not exists show_checkout_notes boolean not null default true,
  add column if not exists show_checkout_email boolean not null default true,
  add column if not exists payment_instructions text default 'Scan with your banking app, or PayNow to the account below.',
  add column if not exists chat_enabled boolean not null default true,
  add column if not exists chat_heading text default 'Message us',
  add column if not exists chat_auto_reply text default 'Thanks for your message. We will reply as soon as possible.',
  add column if not exists chat_business_hours text default '',
  add column if not exists reviews_enabled boolean not null default true;

alter table public.store_settings
  add column if not exists admin_welcome_duration_seconds integer not null default 5;

alter table public.store_settings
  add column if not exists admin_mobile_nav_position text not null default 'left';
