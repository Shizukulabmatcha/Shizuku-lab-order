-- Lets each product decide whether its price is shown on the customer menu card.
-- Dynamic Mix & Match products start hidden; the live total remains visible inside the product.

alter table public.products
  add column if not exists show_price_on_menu boolean not null default true;

update public.products
set show_price_on_menu = false
where coalesce(bundle_pricing_mode, 'fixed') = 'sum_selected'
  and show_price_on_menu is distinct from false;

comment on column public.products.show_price_on_menu is
  'When false, the customer menu card hides the price. Product detail/cart totals are unchanged.';
