-- Run once. Blocks checkout from old browser carts after a product is disabled.
create or replace function public.block_disabled_shizuku_product()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare product_is_available boolean;
begin
  select p.is_available into product_is_available
  from public.products p
  where p.id::text = new.product_id::text
  limit 1;

  if not found or not coalesce(product_is_available, false) then
    raise exception 'This product is no longer available.';
  end if;
  return new;
end;
$$;

drop trigger if exists block_disabled_shizuku_product_order on public.order_items;
create trigger block_disabled_shizuku_product_order
before insert or update of product_id on public.order_items
for each row execute function public.block_disabled_shizuku_product();
