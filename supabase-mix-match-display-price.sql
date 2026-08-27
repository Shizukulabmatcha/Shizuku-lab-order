-- Independent menu-only "From" price for dynamic Mix & Matcha bundles.
-- This does not change bundle option prices or checkout calculations.

alter table public.products
  add column if not exists bundle_display_from_price numeric(10,2);

alter table public.products
  drop constraint if exists products_bundle_display_from_price_check;

alter table public.products
  add constraint products_bundle_display_from_price_check
  check (bundle_display_from_price is null or bundle_display_from_price >= 0);

update public.products
set bundle_display_from_price = 10.00,
    bundle_show_choice_prices = false
where lower(coalesce(name, '')) like '%mix%match%';

comment on column public.products.bundle_display_from_price is
  'Optional menu-only From price for dynamic bundles. Does not affect final calculated price.';
