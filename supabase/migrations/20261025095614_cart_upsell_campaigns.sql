-- Each shop can configure a separate, opt-in add-on offer at checkout.
alter table public.store_settings
  add column if not exists cart_upsell_sg_enabled boolean not null default false,
  add column if not exists cart_upsell_sg_min_drinks integer not null default 2,
  add column if not exists cart_upsell_sg_product_id bigint,
  add column if not exists cart_upsell_sg_price numeric(10,2),
  add column if not exists cart_upsell_my_enabled boolean not null default false,
  add column if not exists cart_upsell_my_min_drinks integer not null default 2,
  add column if not exists cart_upsell_my_product_id bigint,
  add column if not exists cart_upsell_my_price numeric(10,2);

alter table public.store_settings
  add constraint store_settings_cart_upsell_sg_valid
    check (cart_upsell_sg_min_drinks between 1 and 20 and (cart_upsell_sg_price is null or cart_upsell_sg_price >= 0)),
  add constraint store_settings_cart_upsell_my_valid
    check (cart_upsell_my_min_drinks between 1 and 20 and (cart_upsell_my_price is null or cart_upsell_my_price >= 0));
