-- Per-product Mix & Match price-display control.
-- Safe additive migration: no orders or product prices are changed.

begin;

alter table public.products
  add column if not exists bundle_show_choice_prices boolean not null default true;

-- Existing automatic Mix & Match products keep their “From” menu-card price,
-- while individual Drink 1 / Drink 2 prices are hidden until the owner turns them on.
update public.products
set show_price_on_menu = true,
    bundle_show_choice_prices = false
where coalesce(bundle_pricing_mode, 'fixed') = 'sum_selected';

comment on column public.products.bundle_show_choice_prices is
  'When true, show individual selectable drink prices inside a bundle; the final calculated total is always shown after selections are complete.';

notify pgrst, 'reload schema';
commit;

select id, name, show_price_on_menu, bundle_show_choice_prices
from public.products
where coalesce(bundle_pricing_mode, 'fixed') = 'sum_selected'
order by id;
