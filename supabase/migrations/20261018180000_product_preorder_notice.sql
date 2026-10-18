-- Per-product collection lead time, shared by the SG, MY and Partner stores.
alter table public.products
  add column if not exists preorder_notice_hours integer not null default 0;
alter table public.products
  add constraint products_preorder_notice_hours_range
  check (preorder_notice_hours between 0 and 168);

-- Customer ordering can insert an order and its items in separate requests.
-- Check again when each item is added; Partner RPCs roll back atomically.
create or replace function private.enforce_product_preorder_notice()
returns trigger
language plpgsql
set search_path = ''
as $function$
declare
  v_order public.orders%rowtype;
  v_product_hours integer;
  v_store_hours integer;
  v_zone text;
  v_pickup_at timestamptz;
begin
  select * into v_order from public.orders where id = new.order_id;
  if not found or coalesce(v_order.is_offline, false)
    or coalesce(v_order.is_b2b, false)
    or (v_order.fulfilment_method not in ('collection', 'self_delivery')
      and v_order.order_kind is distinct from 'matcha_pass_redemption') then
    return new;
  end if;

  select coalesce(preorder_notice_hours, 0) into v_product_hours
    from public.products where id = new.product_id;
  select case when v_order.market_code = 'MY'
      then coalesce(malaysia_minimum_order_notice_hours, 0)
      else coalesce(minimum_order_notice_hours, 0) end
    into v_store_hours from public.store_settings limit 1;

  if v_order.collection_date is null or nullif(trim(v_order.collection_time), '') is null then
    raise exception 'Choose a valid collection date and time.';
  end if;
  v_zone := case when v_order.market_code = 'MY'
    then 'Asia/Kuala_Lumpur' else 'Asia/Singapore' end;
  v_pickup_at := (v_order.collection_date + v_order.collection_time::time)
    at time zone v_zone;
  if v_pickup_at < now() + make_interval(hours => greatest(
    0, coalesce(v_store_hours, 0), coalesce(v_product_hours, 0))) then
    raise exception 'This drink needs % hour(s) pre-order notice. Choose a later time.',
      greatest(0, coalesce(v_store_hours, 0), coalesce(v_product_hours, 0));
  end if;
  return new;
end;
$function$;

drop trigger if exists enforce_product_preorder_notice on public.order_items;
create trigger enforce_product_preorder_notice
before insert on public.order_items
for each row execute function private.enforce_product_preorder_notice();
