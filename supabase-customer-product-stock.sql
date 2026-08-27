-- Shizuku Lab customer stock display and overselling protection
-- Run this whole file once in Supabase SQL Editor.
-- Remaining stock = Products.Stock - quantities in this Singapore week only.
-- It refreshes automatically every Monday at 12:00 AM Singapore time.

create or replace function public.get_shizuku_product_stock()
returns table(product_id text, available_quantity bigint)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.id::text as product_id,
    greatest(
      0,
      floor(
        p.stock::numeric - coalesce(sum(oi.quantity) filter (
          where coalesce(lower(o.order_status), 'pending') <> 'cancelled'
            and o.created_at >= (date_trunc('week', now() at time zone 'Asia/Singapore') at time zone 'Asia/Singapore')
        ), 0)
      )
    )::bigint as available_quantity
  from public.products p
  left join public.order_items oi on oi.product_id::text = p.id::text
  left join public.orders o on o.id::text = oi.order_id::text
  where p.stock is not null and p.stock >= 0
  group by p.id, p.stock;
$$;

revoke all on function public.get_shizuku_product_stock() from public;
grant execute on function public.get_shizuku_product_stock() to anon, authenticated;

create or replace function public.prevent_shizuku_product_oversell()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  stock_limit numeric;
  already_ordered numeric;
  target_order_status text;
begin
  select p.stock::numeric into stock_limit
  from public.products p
  where p.id::text = new.product_id::text
  limit 1;

  if stock_limit is null or stock_limit < 0 then return new; end if;

  select lower(coalesce(o.order_status, 'pending')) into target_order_status
  from public.orders o
  where o.id::text = new.order_id::text
  limit 1;
  if target_order_status = 'cancelled' then return new; end if;

  if tg_op = 'UPDATE' then
    select coalesce(sum(oi.quantity), 0) into already_ordered
    from public.order_items oi
    join public.orders o on o.id::text = oi.order_id::text
    where oi.product_id::text = new.product_id::text
      and oi.id::text <> old.id::text
      and coalesce(lower(o.order_status), 'pending') <> 'cancelled'
      and o.created_at >= (date_trunc('week', now() at time zone 'Asia/Singapore') at time zone 'Asia/Singapore');
  else
    select coalesce(sum(oi.quantity), 0) into already_ordered
    from public.order_items oi
    join public.orders o on o.id::text = oi.order_id::text
    where oi.product_id::text = new.product_id::text
      and coalesce(lower(o.order_status), 'pending') <> 'cancelled'
      and o.created_at >= (date_trunc('week', now() at time zone 'Asia/Singapore') at time zone 'Asia/Singapore');
  end if;

  if already_ordered + new.quantity > stock_limit then
    raise exception 'Only % item(s) remaining for this product.', greatest(0, floor(stock_limit - already_ordered));
  end if;
  return new;
end;
$$;

drop trigger if exists prevent_shizuku_product_oversell on public.order_items;
create trigger prevent_shizuku_product_oversell
before insert or update of product_id, quantity on public.order_items
for each row execute function public.prevent_shizuku_product_oversell();

-- Save one product's complete food-cost recipe in one atomic request.
create or replace function public.save_shizuku_product_recipe(p_product_id text, p_recipe jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) then
    raise exception 'Admin sign-in required.';
  end if;

  delete from public.product_recipes where product_id = p_product_id;

  insert into public.product_recipes(product_id, inventory_item_id, quantity_used)
  select
    p_product_id,
    (row_data ->> 'inventory_item_id')::uuid,
    greatest(0, coalesce((row_data ->> 'quantity_used')::numeric, 0))
  from jsonb_array_elements(coalesce(p_recipe, '[]'::jsonb)) as row_data
  where coalesce((row_data ->> 'quantity_used')::numeric, 0) > 0;
end;
$$;

revoke all on function public.save_shizuku_product_recipe(text, jsonb) from public;
grant execute on function public.save_shizuku_product_recipe(text, jsonb) to authenticated;
