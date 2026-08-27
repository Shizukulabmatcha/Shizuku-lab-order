-- Public storefront/workspace locale preferences.
alter table public.store_settings
  add column if not exists business_country text not null default 'Singapore',
  add column if not exists store_currency text not null default 'SGD',
  add column if not exists store_language text not null default 'English';

update public.store_settings
set business_country = coalesce(nullif(business_country, ''), 'Singapore'),
    store_currency = coalesce(nullif(store_currency, ''), 'SGD'),
    store_language = coalesce(nullif(store_language, ''), 'English'),
    updated_at = now();

alter table public.store_settings
  drop constraint if exists store_settings_currency_check,
  drop constraint if exists store_settings_language_check;

alter table public.store_settings
  add constraint store_settings_currency_check
    check (store_currency in ('SGD', 'MYR', 'USD', 'CNY')),
  add constraint store_settings_language_check
    check (store_language in ('English', 'Malay', 'Mandarin'));

