alter table public.store_settings
  add column if not exists review_cta_label text not null default 'Share your Shizuku moment',
  add column if not exists review_cta_font text not null default 'work_sans',
  add column if not exists review_cta_size integer not null default 14,
  add column if not exists review_cta_color text not null default '#4B5D3A',
  add column if not exists review_portal_title text not null default 'Share your Shizuku experience',
  add column if not exists review_portal_title_font text not null default 'fraunces',
  add column if not exists review_portal_title_size integer not null default 27,
  add column if not exists review_portal_title_color text not null default '#2A2A22',
  add column if not exists review_portal_intro text not null default 'Enter either your order number or phone number. We will show the drinks you collected — your order number will never be shown publicly.',
  add column if not exists review_lookup_label text not null default 'Order number or phone number',
  add column if not exists review_lookup_placeholder text not null default 'SL-XXXXXX or 91234567',
  add column if not exists review_find_button_text text not null default 'Find my orders',
  add column if not exists review_choose_order_text text not null default 'Choose the drinks to review',
  add column if not exists review_name_label text not null default 'Name shown with review',
  add column if not exists review_rating_label text not null default 'Rating',
  add column if not exists review_experience_label text not null default 'Your experience',
  add column if not exists review_submit_button_text text not null default 'Send my review',
  add column if not exists review_back_button_text text not null default 'Back to menu',
  add column if not exists marketing_opt_in_enabled boolean not null default true,
  add column if not exists marketing_email_enabled boolean not null default true,
  add column if not exists marketing_whatsapp_enabled boolean not null default false,
  add column if not exists marketing_checkout_heading text not null default 'Shizuku updates',
  add column if not exists marketing_opt_in_label text not null default 'Keep me in the loop about monthly opening dates, new drinks and special offers.',
  add column if not exists marketing_opt_in_help_text text not null default 'Occasional Shizuku Lab updates by email. You can opt out anytime.';

alter table public.store_settings
  drop constraint if exists store_settings_review_cta_size_check,
  add constraint store_settings_review_cta_size_check check (review_cta_size between 10 and 32),
  drop constraint if exists store_settings_review_portal_title_size_check,
  add constraint store_settings_review_portal_title_size_check check (review_portal_title_size between 16 and 56);

alter table public.orders
  add column if not exists marketing_email_opt_in boolean not null default false,
  add column if not exists marketing_whatsapp_opt_in boolean not null default false,
  add column if not exists marketing_consent_text text,
  add column if not exists marketing_consent_at timestamptz;

comment on column public.orders.marketing_consent_text is 'Exact customer-facing consent wording accepted during checkout.';
comment on column public.orders.marketing_consent_at is 'Time the customer actively opted into marketing updates.';
