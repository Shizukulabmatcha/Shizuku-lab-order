-- Preserve existing drink-count campaigns while allowing a spend threshold per market.
alter table public.store_settings
  add column if not exists cart_upsell_sg_trigger_type text not null default 'drinks',
  add column if not exists cart_upsell_sg_min_spend numeric(10,2) not null default 10.00,
  add column if not exists cart_upsell_my_trigger_type text not null default 'drinks',
  add column if not exists cart_upsell_my_min_spend numeric(10,2) not null default 10.00;

alter table public.store_settings
  add constraint store_settings_cart_upsell_sg_spend_valid
    check (cart_upsell_sg_trigger_type in ('drinks', 'spend') and cart_upsell_sg_min_spend >= 0.01),
  add constraint store_settings_cart_upsell_my_spend_valid
    check (cart_upsell_my_trigger_type in ('drinks', 'spend') and cart_upsell_my_min_spend >= 0.01);
